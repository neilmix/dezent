/*
 * Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *
 * Copyright (c) 2021 Neil Mix <neilmix@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE. 
 */

import {
    Node, DescriptorNode, Grammar, PatternNode, RuleNode, RulesetNode, SelectorNode, TokenNode, ValueNode, StringTextNode, BackRefNode, EscapeNode, RuleRefNode, GrammarDefaultCallbacks
} from "./Grammar";
import { ErrorCode, parserError, grammarError } from "./Error";
import { Context as InterpreterContext, Pass, Fail, WaitInput, Interpreter } from "./Interpreter";
import { ParseBuffer } from "./ParseBuffer";
import { Callbacks } from "./Dezent";

export type Operation = (ictx:InterpreterContext, buf:ParseBuffer) => Operation|null;
export type ValueBuilder = (ictx:InterpreterContext, buf:ParseBuffer) => any;

class CompilerContext {
    activeRules:RuleNode[] = [];
    currentRule:RuleNode;
    callbacks:Callbacks;

    constructor(callbacks?:Callbacks) {
        this.callbacks = {
            ...GrammarDefaultCallbacks,
            ...(callbacks||{})
        };
    }

    pushRule(rule:RuleNode) {
        if (this.currentRule) {
            this.activeRules.push(this.currentRule);
        }
        this.currentRule = rule;
    }

    popRule() {
        this.currentRule = this.activeRules.pop();
    }
}

export class OpcodeCompiler {
    grammar:Grammar;
    enableProfiling:boolean = false;
    rulesetOps:{ [key:string] : Operation } = {};
    rulerefOpFactories:{ [key:string] : (pass:Operation, fail:Operation) => Operation } = {};

    constructor(grammar:Grammar, enableProfiling:boolean) {
        this.grammar = grammar;
        this.enableProfiling = enableProfiling;
    }

    audit(node:Node, action:string, op:Operation):Operation {
        function pad(s:string|number, len:number) {
            s = String(s).substr(0,len);
            return s + ' '.repeat(len - s.length);
        }

        let debugOp = op;
        if (Interpreter.debug) {
            debugOp = (ictx, buf) => {
                let desc = node ? node["name"] || node["pattern"] || "" : "";
                const entry = [
                    pad((node&&node.id)||'', 8), 
                    pad(node ? node.type : "", 10), 
                    pad(desc, 10), 
                    pad(buf.substr(ictx.startPos, 10).replace(/\n/g, " "), 10),
                    "  ",
                    pad(action, 10), 
                    pad(ictx.startPos, 6), 
                    pad(ictx.endPos, 6), 
                    pad(ictx.lastConsumed, 6), 
                    pad(ictx.scopes.length,5)
                ];
                const result = op(ictx, buf)
                ictx.auditLog.push(entry.concat([
                    " -> ", 
                    pad(ictx.startPos, 6), 
                    pad(ictx.endPos, 6), 
                    pad(ictx.lastConsumed, 6), 
                    pad(ictx.scopes.length,5)
                ]));
                return result;
            };
        } 
        
        let profileOp = debugOp;
        if (this.enableProfiling && node && node.type == "ruleref") {
            profileOp = (ictx, buf) => {
                ictx.profileRules.push((<RuleRefNode>node).name);
                ictx.profileActions.push(action);
                ictx.profileTimes.push(Date.now());
                ictx.profilePositions.push(ictx.startPos);
                return op(ictx, buf);
            }
        }

        return profileOp;
    }

    compile(callbacks?:Callbacks):Operation {
        const cctx = new CompilerContext(callbacks);
        const op = this.compileRuleset(
            cctx,
            this.grammar.rulesetLookup.return, 
            this.audit(null, "pass", (ictx, buf) => { ictx.status = Pass; return null; }), 
            this.audit(null, "fail", (ictx, buf) => { ictx.status = Fail; return null; }));
        let iteration = 0;
        return (ctx, buf) => {
            ctx.iteration = ++iteration;
            return op;
        }
    }

    compileRuleset(cctx:CompilerContext, node:RulesetNode, pass:Operation, fail:Operation):Operation {
        // this looks a little convoluted, but basically we're creating a chain of rule parsers
        // that on fail go to the next prule parser and the final rule goes to the fail
        // that was passed in. The convolution comes from the need to manage variable scoping carefully.
        let nextOp = fail;
        for (let i = node.rules.length - 1; i >= 0; i--) {
            nextOp = ((failOp) => {
                return this.compileRule(cctx, node.rules[i], pass, failOp);
            })(nextOp);
        }
        return nextOp;
    }

    compileRule(cctx:CompilerContext, node:RuleNode, pass:Operation, fail:Operation):Operation {
        cctx.pushRule(node);
        const patterns = this.compilePatterns(cctx, node, this.compileValue(cctx, node.value, pass), fail);
        cctx.popRule();
        const captures = node.captures || [];
        return (ictx, buf) => {
            ictx.captures.length = 0;
            return patterns;
        };
    }

    compilePatterns(cctx:CompilerContext, node:SelectorNode, pass: Operation, fail:Operation):Operation {
        // this looks a little convoluted, but basically we're creating a chain of pattern parsers
        // that on fail go to the next pattern parser and the final pattern goes to the fail
        // that was passed in. The convolution comes from the need to manage variable scoping carefully.
        let nextOp = fail;
        for (let i = node.patterns.length - 1; i >= 0; i--) {
            nextOp = ((failOp) => {
                const patternOp = this.compilePattern(
                    cctx,
                    node.patterns[i],
                    this.audit(node, "pass", (ictx, buf) => { 
                        ictx.commitScope();
                        return pass; 
                    }),
                    this.audit(node, "fail", (ictx, buf) => { ictx.rollbackScope(); return failOp; })
                );
                return this.audit(node, "run", (ictx, buf) => { ictx.beginScope(); return patternOp; });
            })(nextOp);
        }
        return nextOp;
    }

    compilePattern(cctx:CompilerContext, node:PatternNode, pass:Operation, fail:Operation):Operation {
        let prev = pass;
        for (let i = node.tokens.length - 1; i >= 0; i--) {
            prev = this.compileToken(cctx,node.tokens[i], prev, fail);
        }
        return prev;
    }

    compileToken(cctx:CompilerContext, node:TokenNode, pass:Operation, fail:Operation):Operation {
        let pattern = node.descriptor["pattern"];
        if (node.not && pattern) pattern = "not: " + pattern;

        // do this *before* swapping pass and fail (in the case of node.not) or otherwise
        // failed tokens will get mapped opposite their actual meaning.
        if (node.required && node.descriptor["pattern"]) {
            fail = ((failOp) => {
                return (ictx:InterpreterContext, buf) => {
                    if (ictx.disableFailedPatternLevel == 0 && ictx.endPos >= ictx.errorPos) {
                        if (ictx.endPos > ictx.errorPos) {
                            ictx.failedPatterns.length = 0;
                            ictx.errorPos = ictx.endPos;
                        }
                        ictx.failedPatterns.push(pattern);
                    }
                    return failOp;
                }
            })(fail);
        }

        if (node.not) {
            let tmp = pass;
            pass = fail;
            fail = tmp;
        }

        const newPass = (node.and || node.not)
            ? this.audit(node, "pass", (ictx, buf) => {
                ictx.endPos = ictx.startPos;
                return pass;
            })
            : this.audit(node, "pass", (ictx, buf) => {
                ictx.startPos = ictx.endPos;
                return pass;
            });

        if (node.repeat) {
            let repeat;
            let repeatPass = this.audit(node, "repeat", (ictx, buf) => { 
                // make sure we consumed so we don't get into an infinite loop
                if (ictx.endPos > ictx.startPos) {
                    ictx.startPos = ictx.endPos;
                    return repeat;
                } else {
                    return newPass;
                }
            });
            repeat = this.compileDescriptor(cctx, node.descriptor, repeatPass, newPass);
            if (node.required) {
                // first time through must match, optionally thereafter
                return this.compileDescriptor(cctx, node.descriptor, repeatPass, fail);
            } else {
                // always passes
                return repeat;
            }
        } else {
            if (!node.required && node.descriptor.type == "capture" && cctx.currentRule.captures[node.descriptor.index]) {
                // a non-required capture that fails should return null in a non-collapsed array
                let index = String(node.descriptor.index);
                return this.compileDescriptor(
                    cctx, 
                    node.descriptor, 
                    newPass, this.audit(node, "pass", (ictx, buf) => {
                        ictx.captures.push({index: index, value: null});
                        return pass;
                    }));
            } else {
                return this.compileDescriptor(cctx, node.descriptor, newPass, node.required ? fail : pass);
            }
        }
    }

    compileDescriptor(cctx:CompilerContext, node:DescriptorNode, pass:Operation, fail:Operation):Operation {
        switch (node.type) {
            case "group":
                if (node.canFail) {
                    return this.compilePatterns(cctx, node, pass, fail);
                } else {
                    const runOps = this.compilePatterns(
                        cctx, 
                        node, 
                        (ictx, buf) => { ictx.disableFailedPatternLevel--; return pass; }, 
                        (ictx, buf) => { ictx.disableFailedPatternLevel--; return fail; }
                    );
                    return (ictx, buf) => {
                        ictx.disableFailedPatternLevel++;
                        return runOps;
                    }
                }
            case "capture":
                { // new scope
                    const useOutput = node.useOutput;
                    const captureIndex = node.index;
                    let id = cctx.currentRule.id;
                    const newPass = useOutput ? 
                        (ictx, buf) => { 
                            ictx.captures.push({index: captureIndex, value: ictx.output});
                            return pass; 
                        }
                        : (ictx, buf) => {
                            ictx.captures.push({index: captureIndex, value: buf.substr(ictx.endPos - ictx.lastConsumed, ictx.lastConsumed)});
                            return pass; 
                        }
                    
                    if (node.canFail) {
                        return this.compilePatterns(cctx, node, newPass, fail);
                    } else {
                        const runOps = this.compilePatterns(
                            cctx, 
                            node, 
                            (ictx, buf) => { ictx.disableFailedPatternLevel--; return newPass; }, 
                            (ictx, buf) => { ictx.disableFailedPatternLevel--; return fail; }
                        );
                        return (ictx, buf) => {
                            ictx.disableFailedPatternLevel++;
                            return runOps;
                        }                           
                    }
                }
            case "ruleref":
                { // new scope
                    const name = node.name;
                    const rulesetOps = this.rulesetOps;
                    const ruleset = this.grammar.rulesetLookup[name];
                    const disableFailedPatternTracking = !ruleset.canFail;
                    
                    // detect left recursion by checking the current position against the previous position
                    // when this ruleref is executed - if the position is unchanged, we have left recursion.
                    // But, double-check our context iteration so that we don't conflict across parses.
                    let prevIteration = -1;
                    let prevPos = -1;
                    let left:{returning:boolean, calling:boolean, output:any, endPos:number, consumed:number} = null;
                    let leftStack = [];

                    // In order to detect left recursion we need access to prevPos (defined above) in our scope.
                    // But, pass and fail may be different for every invocation of a ruleref. So, we need to use
                    // factories to generator our op so that we retain prevPos in scope while generating a
                    // unique op for each invokation.
                    // Do this prior to creating the rulesetOp so that we're creating the factory at the first
                    // invokation and not a later invokation, that way all invokations share the same prevPos.
                    if (!this.rulerefOpFactories[name]) {
                        this.rulerefOpFactories[name] = (pass, fail) => {
                            return this.audit(node, "run", (ictx, buf) => {
                                if (left && left.calling) {
                                    left.calling = false;
                                    left.returning = true;
                                    ictx.output = left.output;
                                    ictx.endPos = left.endPos;
                                    ictx.lastConsumed = left.consumed;
                                    return pass;
                                } else if (ictx.iteration == prevIteration && ictx.startPos == prevPos) {
                                    if (left) {
                                        leftStack.push(left);
                                    }
                                    left = {
                                        returning: true,
                                        calling: false,
                                        output: undefined,
                                        endPos: 0,
                                        consumed: 0
                                    };
                                    return fail;
                                }
                                prevIteration = ictx.iteration;
                                prevPos = ictx.startPos;
                                ictx.pushFrame(pass, fail);
                                if (disableFailedPatternTracking) ictx.disableFailedPatternLevel++;
                                return rulesetOps[name];
                            });
                        };
                    }

                    // a null rulesetOp indicates that we've been call recursively during ruleset compilation,
                    // so check specifically for undefined here
                    if (rulesetOps[name] === undefined) {
                        // set a null value so that we don't get infinite compilation recursion in 
                        // the case where our rule calls itself
                        rulesetOps[name] = null;
                        rulesetOps[name] = this.compileRuleset(
                            cctx,
                            ruleset,
                            this.audit(node, "pass", (ictx, buf) => { 
                                if (left && left.returning) {
                                    left.returning = false;
                                    if (ictx.lastConsumed > left.consumed) {
                                        left.calling = true;
                                        left.output = ictx.output;
                                        left.endPos = ictx.endPos;
                                        left.consumed = ictx.lastConsumed;
                                        return rulesetOps[name];
                                    } else {
                                        ictx.output = left.output;
                                        ictx.endPos = left.endPos;
                                        ictx.lastConsumed = left.consumed;
                                        left = leftStack.pop();
                                        // fall through
                                    }
                                }
                                prevPos = -1; 
                                if (disableFailedPatternTracking) ictx.disableFailedPatternLevel--;
                                return ictx.popFrame().pass; 
                            }),
                            this.audit(node, "fail", (ictx, buf) => { 
                                if (left && left.returning) {
                                    ictx.output = left.output;
                                    ictx.endPos = left.endPos;
                                    ictx.lastConsumed = left.consumed;
                                    left = leftStack.pop();
                                    prevPos = -1;
                                    if (disableFailedPatternTracking) ictx.disableFailedPatternLevel--;
                                    return ictx.popFrame().pass;
                                } else {
                                    prevPos = -1; 
                                    if (disableFailedPatternTracking) ictx.disableFailedPatternLevel--;
                                    return ictx.popFrame().fail;
                                }
                            })
                        )
                    }

                    return this.rulerefOpFactories[name](pass, fail);
                }
            case "string":
                const matchStr = node.pattern;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos + matchStr.length <= buf.length) {
                        if (buf.containsAt(matchStr, ictx.endPos)) {
                            ictx.endPos += matchStr.length;
                            return pass;
                        } else {
                            return fail;
                        }
                    } else if (buf.closed) {
                        return fail;
                    } else {
                        ictx.status = WaitInput;
                        return null;
                    }
                });
            case "class":
                const ranges = node.ranges;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos < buf.length) {
                        const c = buf.charAt(ictx.endPos);
                        for (const range of ranges) {
                            if (c >= range[0].match && c <= range[1].match) {
                                ictx.endPos++;
                                return pass;
                            }
                        }
                        return fail;
                    } else if (buf.closed) {
                        return fail;
                    } else {
                        ictx.status = WaitInput;
                        return null;
                    }
                });
            case "any":
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos < buf.length) {
                        ictx.endPos++;
                        return pass;
                    } else if (buf.closed) {
                        return fail;
                    } else {
                        ictx.status = WaitInput;
                        return null;
                    }
                });
            default:
                throw new Error("not implemented");
        }
    }

    compileValue(cctx:CompilerContext, node:ValueNode, pass:Operation):Operation {
        const builder = this.compileValueBuilder(cctx, node);
        return this.audit(node, "output", (ictx,buf) => {
            ictx.output = builder(ictx, buf);
            return pass;
        });
    }

    compileValueBuilder(cctx:CompilerContext, node:ValueNode):ValueBuilder {
        switch (node.type) {
            case "null":
                return (ictx, buf) => {
                    return null;
                }
            case "boolean":
                const b = node.value;
                return (ictx, buf) => {
                    return b;
                }
            case "number":
                const n = node.value;
                return (ictx, buf) => {
                    return Number(n);
                }
            case "string":
                const strBuilders = node.tokens.map((node:StringTextNode|BackRefNode|EscapeNode) => {
                    if (node.type == "backref") {
                        let retval = this.compileValueBuilder(cctx, node);
                        return retval;
                    }

                    const value = node.value;
                    if (node.type == "text") {
                        return () => value;
                    } else if (node.value[0] == 'u') {
                        return () => String.fromCharCode(Number(`0x${value.substr(1)}`));
                    } else if(node.value.length > 1) {
                        parserError(ErrorCode.Unreachable);
                    } else if ("bfnrt".indexOf(value) >= 0) {
                        return () => ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[value];
                    } else {
                        return () => value;
                    }
                });
                return (ictx, buf) => {
                    return strBuilders.map((b) => stringifyOutput(b(ictx, buf))).join('');
                }
            case "constref":
                return this.compileAccess(cctx, node, this.compileValueBuilder(cctx, this.grammar.vars[node.name]));
            case "metaref":
                const metaName = node.name;
                switch (metaName) {
                    case "position": return (ictx, buf) => ictx.startPos;
                    case "length": return (ictx, buf) => ictx.endPos - ictx.startPos;
                    default: parserError(ErrorCode.Unreachable); return null;
                }
            case "array":
                const elemBuilders = node.elements.map((item) => {
                    const builder = this.compileValueBuilder(cctx, item);
                    if (item.type == "spread") {
                        return (ictx, buf, array) => array.concat(builder(ictx, buf));
                    } else if (item.type == "backref" && item.collapse) {
                        return (ictx, buf, array) => { 
                            let value = builder(ictx, buf);
                            if (value !== null) {
                                array.push(value); 
                            }
                            return array; 
                        };
                    } else{
                        return (ictx, buf, array) => { 
                            array.push(builder(ictx, buf)); 
                            return array; 
                        };
                    }
                });
                return this.compileAccess(cctx, node, (ictx, buf) => {
                    return elemBuilders.reduce((a,f) => f(ictx,buf,a), []);
                });
            case "object":
                const ret = {};
                const objBuilders = node.members.map((member) => {
                    if (member.type == "spread") {
                        const tupleBuilder = this.compileValueBuilder(cctx, member);
                        return (ictx,buf, retval) => {
                            return tupleBuilder(ictx,buf).reduce((o,tuple) => {
                                if (!Array.isArray(tuple) || tuple.length != 2) {
                                    grammarError(ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                                }
                                o[tuple[0]] = tuple[1];
                                return o;
                            }, retval);
                        }
                    } else {
                        const keyOp = this.compileValueBuilder(cctx, member.name);
                        const valueOp = this.compileValueBuilder(cctx, member.value);
                        return (ictx, buf, retval) => {
                            retval[keyOp(ictx,buf)] = valueOp(ictx,buf);
                            return retval;
                        }
                    }
                });
                return this.compileAccess(cctx, node, (ictx, buf) => objBuilders.reduce((o,f) => f(ictx,buf,o), {}));
            case "backref":
                const index = node.index;
                if (index == "0") {
                    return this.compileAccess(cctx, node, (ictx, buf) => {
                        return buf.substrExact(ictx.startPos, ictx.endPos - ictx.startPos);
                    });
                } else {
                    if (cctx.currentRule.captures[index]) {
                        if (node.collapse) {
                            return this.compileAccess(cctx, node, (ictx, buf) => {
                                return ictx.captures.reduce((ret, cap) => {
                                    if (cap.index == index && cap.value !== null) ret.push(cap.value);
                                    return ret;
                                }, []);
                            });
                        } else {
                            return this.compileAccess(cctx, node, (ictx, buf) => {
                                return ictx.captures.reduce((ret, cap) => {
                                    if (cap.index == index) ret.push(cap.value);
                                    return ret;
                                }, [])
                            });
                        }
                    } else {
                        return this.compileAccess(cctx, node, (ictx, buf) => {
                            let cap = ictx.captures.find((cap) => cap.index == index);
                            return cap ? cap.value : null;
                        });
                    }
                }
            case "call":
                const callback = cctx.callbacks[node.name];
                const argBuilders = node.args.map((arg) => this.compileValueBuilder(cctx, arg));

                if (!callback) {
                    grammarError(ErrorCode.FunctionNotFound, this.grammar.text, node.meta, node.name);
                }

                return (ictx, buf) => {
                    try {
                        return callback.apply(null, argBuilders.map((arg) => arg(ictx, buf)));
                    } catch(e) {
                        grammarError(ErrorCode.CallbackError, this.grammar.text, node.meta, String(e));
                    }                    
                }
            case "spread":
                const spreader = this.compileValueBuilder(cctx, node.value);
                return (ictx, buf) => {
                    const value = spreader(ictx, buf);
                    if (value === null || value === undefined || (typeof value != 'object' && typeof value != 'string')) {
                        grammarError(ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
                    }
                    if (Array.isArray(value)) {
                        return value;
                    } else if (typeof value == "string") {
                        return value.split('');
                    } else {
                        return Object.entries(value);
                    }
                }
        
            default:
                throw new Error("not implemented");
        }
    }

    compileAccess(cctx:CompilerContext, node:ValueNode, builder:ValueBuilder):ValueBuilder {
        if (node.access) for (let prop of node.access) {
            builder = ((prevBuilder:ValueBuilder, prop) => {
                if (prop.value) {
                    let indexBuilder = this.compileValueBuilder(cctx, prop.value);
                    return (ictx, buf) => {
                        let out = prevBuilder(ictx, buf);
                        if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                            grammarError(ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                        }
                        let index = indexBuilder(ictx, buf);
                        if (typeof index != 'string' && typeof index != 'number') {
                            grammarError(ErrorCode.InvalidAccessIndex, this.grammar.text, prop.meta, JSON.stringify(index));
                        }
                        if (!out.hasOwnProperty(index)) {
                            grammarError(ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                        }
                        return out[index];
                    }
                } else {
                    return (ictx, buf) => {
                        let out = prevBuilder(ictx, buf);
                        if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                            grammarError(ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                        }
                        let index = prop.name;
                        if (!out.hasOwnProperty(index)) {
                            grammarError(ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                        }
                        return out[index];
                    }
                }
            })(builder, prop);
        }
        return builder;
    }
}

function stringifyOutput(x) {
    if (x === null || x === undefined) {
        return '';
    } else if (typeof x == 'object') {
        return Object.values(x).map((v) => stringifyOutput(v)).join('');
    } else {
        return String(x);
    }
}