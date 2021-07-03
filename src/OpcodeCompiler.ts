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

import { notEqual } from "assert";
import {
    Node, DescriptorNode, Grammar, PatternNode, RuleNode, RulesetNode, SelectorNode, TokenNode, ValueNode
} from "./Grammar";
import { Context as InterpreterContext, Pass, Fail, WaitInput, Interpreter } from "./Interpreter";
import { ParseBuffer } from "./ParseBuffer";

export type Operation = (ictx:InterpreterContext, buf:ParseBuffer) => Operation|null;

class CompilerContext {
    currentRule:RuleNode;
}

export class OpcodeCompiler {
    grammar:Grammar;
    rulesetOps:{ [key:string] : Operation } = {};

    constructor(grammar:Grammar) {
        this.grammar = grammar;
    }

    audit(node:Node, action:string, op:Operation):Operation {
        function pad(s:string|number, len:number) {
            s = String(s).substr(0,len);
            return s + ' '.repeat(len - s.length);
        }
        if (Interpreter.debug) {
            return (ictx, buf) => {
                let entry = [pad(node ? node.type : "", 10), pad(action, 10), pad(ictx.position, 8), pad(ictx.consumed, 8), pad(ictx.scopes.length,5)];
                let result = op(ictx, buf)
                ictx.auditLog.push(entry.concat([" -> ", pad(ictx.position, 8), pad(ictx.consumed, 8), pad(ictx.scopes.length,5)]));
                return result;
            };
        } else {
            return op;
        }
    }

    compile():Operation {
        let cctx = new CompilerContext();
        return this.compileRuleset(
            cctx,
            this.grammar.rulesetLookup.return, 
            this.audit(null, "pass", (ictx, buf) => { ictx.status = Pass; return null; }), 
            this.audit(null, "fail", (ictx, buf) => { ictx.status = Fail; return null; }));
    }

    compileRuleset(cctx:CompilerContext, node:RulesetNode, pass:Operation, fail:Operation):Operation {
        if(node.rules.length == 1) {
            return this.compileRule(cctx, node.rules[0], pass, fail);
        } else {
            throw new Error("Not implemented");
        }
    }

    compileRule(cctx:CompilerContext, node:RuleNode, pass:Operation, fail:Operation):Operation {
        cctx.currentRule = node;
        let patterns = this.compilePatterns(cctx, node, this.compileValue(cctx, node.value, pass), pass);
        let captures = node.captures || [];
        return (ictx, buf) => {
            ictx.captures.length = captures.length;
            ictx.captures.fill(null, captures.length);
            return patterns;
        };
    }

    compilePatterns(cctx:CompilerContext, node:SelectorNode, pass: Operation, fail:Operation):Operation {
        if (node.patterns.length == 1) {
            let patternOp = this.compilePattern(
                cctx,
                node.patterns[0],
                this.audit(node, "pass", (ictx, buf) => { ictx.commitScope(); return pass; }),
                this.audit(node, "fail", (ictx, buf) => { ictx.rollbackScope(); return fail; }),
            );
            return this.audit(node, "run", (ictx, buf) => { ictx.beginScope(); return patternOp; });
        } else {
            throw new Error("Not implemented");
        }
    }

    compilePattern(cctx:CompilerContext, node:PatternNode, pass:Operation, fail:Operation):Operation {
        let prev = pass;
        for (let i = node.tokens.length - 1; i >= 0; i--) {
            prev = this.compileToken(cctx,node.tokens[i], prev, fail);
        }
        return prev;
    }

    compileToken(cctx:CompilerContext, node:TokenNode, pass:Operation, fail:Operation):Operation {
        if (node.not) {
            let tmp = pass;
            pass = fail;
            fail = tmp;
        }
        
        let newPass;
        if (node.and || node.not) {
            newPass = this.audit(node, "pass", (ictx, buf) => {
                ictx.consumed = 0;
                return pass;
            });
        } else {
            newPass = this.audit(node, "pass", (ictx, buf) => {
                ictx.position += ictx.consumed;
                ictx.consumed = 0;
                return pass;
            });
        }

        if (node.repeat) {
            let repeat = this.compileDescriptor(
                cctx,
                node.descriptor, 
                this.audit(node, "pass", () => { return repeat; }), 
                newPass);
            if (node.required) {
                // first time through must match, optionally thereafter
                return this.compileDescriptor(cctx, node.descriptor, repeat, fail);
            } else {
                // always passes
                return repeat;
            }
        } else {
            return this.compileDescriptor(cctx, node.descriptor, newPass, node.required ? fail : pass);
        }
    }

    compileDescriptor(cctx:CompilerContext, node:DescriptorNode, pass:Operation, fail:Operation):Operation {
        switch (node.type) {
            case "group":
                return this.compilePatterns(cctx, node, pass, fail);
            case "capture":
                let useOutput = node.useOutput;
                let captureIndex = node.index;
                let setCapture;
                if (cctx.currentRule.captures[captureIndex]) {
                    setCapture = (ictx, value) => {
                        if (ictx.captures[captureIndex] === null) {
                            ictx.captures[captureIndex] = [];
                        }
                        ictx.captures[captureIndex].push(value);
                    }
                } else {
                    setCapture = (ictx, value) => {
                        ictx.captures[captureIndex] = value;
                    }
                }
                let setCaptureHook = useOutput ? 
                    (ictx, buf) => { setCapture(ictx, ictx.output); return pass; }
                    : (ictx, buf) => { setCapture(ictx, buf.substr(ictx.position, ictx.consumed)); return pass; }
                return this.compilePatterns(cctx, node, this.audit(node, "pass", setCaptureHook), fail);
            case "ruleref":
                let name = node.name;
                let rulesetOps = this.rulesetOps;
                if (rulesetOps[name] === undefined) {
                    // set a null value so that we don't get infinite compilation recursion in 
                    // the case where our rule calls itself
                    rulesetOps[name] = null;
                    rulesetOps[name] = this.compileRuleset(
                        cctx,
                        this.grammar.rulesetLookup[name],
                        this.audit(node, "pass", (ictx, buf) => { return ictx.popFrame().pass }),
                        this.audit(node, "fail", (ictx, buf) => { return ictx.popFrame().fail })
                    )
                }
                return this.audit(node, "run", (ictx, buf) => { 
                    ictx.pushFrame(pass, fail);
                    return rulesetOps[name];
                });
            case "string":
                let matchStr = node.pattern;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.position + ictx.consumed + matchStr.length <= buf.length) {
                        if (buf.containsAt(matchStr, ictx.position + ictx.consumed)) {
                            ictx.consumed += matchStr.length;
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
            case "any":
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.position + ictx.consumed < buf.length) {
                        ictx.consumed++;
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
        let builder = this.compileValueBuilder(cctx, node);
        return this.audit(node, "output", (ictx,buf) => {
            ictx.output = builder(ictx, buf);
            return pass;
        });
    }

    compileValueBuilder(cctx:CompilerContext, node:ValueNode):(ictx:InterpreterContext, buf:ParseBuffer) => any {
        switch (node.type) {
            case "null":
                return (ictx, buf) => {
                    return null;
                }
            case "array":
                let elemBuilders = [];
                for (let item of node.elements) {
                    elemBuilders.push(this.compileValueBuilder(cctx, item));
                }
                return (ictx, buf) => {
                    return elemBuilders.map(item => item(ictx,buf));
                }
            case "backref":
                let index = node.index;
                if (index == "0") {
                    return (ictx, buf) => {
                        return buf.substrExact(ictx.position, ictx.consumed);
                    }
                } else {
                    if (cctx.currentRule.captures[index]) {
                        return (ictx, buf) => {
                            return ictx.captures[index] || [];
                        }
                    } else {
                        return (ictx, buf) => {
                            return ictx.captures[index];
                        }
                    }
                }
            default:
                throw new Error("not implemented");
        }
    }
}