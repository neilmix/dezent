"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpcodeCompiler = void 0;
const GrammarCompiler_1 = require("./GrammarCompiler");
const Interpreter_1 = require("./Interpreter");
const Parser_1 = require("./Parser");
class CompilerContext {
}
class OpcodeCompiler {
    constructor(grammar) {
        this.rulesetOps = {};
        this.grammar = grammar;
    }
    audit(node, action, op) {
        function pad(s, len) {
            s = String(s).substr(0, len);
            return s + ' '.repeat(len - s.length);
        }
        if (Interpreter_1.Interpreter.debug) {
            return (ictx, buf) => {
                let entry = [pad(node ? node.type : "", 10), pad(action, 10), pad(ictx.position, 8), pad(ictx.consumed, 8), pad(ictx.scopes.length, 5)];
                let result = op(ictx, buf);
                ictx.auditLog.push(entry.concat([" -> ", pad(ictx.position, 8), pad(ictx.consumed, 8), pad(ictx.scopes.length, 5)]));
                return result;
            };
        }
        else {
            return op;
        }
    }
    compile() {
        let cctx = new CompilerContext();
        let op = this.compileRuleset(cctx, this.grammar.rulesetLookup.return, this.audit(null, "pass", (ictx, buf) => { ictx.status = Interpreter_1.Pass; return null; }), this.audit(null, "fail", (ictx, buf) => { ictx.status = Interpreter_1.Fail; return null; }));
        let iteration = 0;
        return (ctx, buf) => {
            ctx.iteration = ++iteration;
            return op;
        };
    }
    compileRuleset(cctx, node, pass, fail) {
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
    compileRule(cctx, node, pass, fail) {
        cctx.currentRule = node;
        let patterns = this.compilePatterns(cctx, node, this.compileValue(cctx, node.value, pass), fail);
        let captures = node.captures || [];
        return (ictx, buf) => {
            ictx.captures.length = captures.length;
            ictx.captures.fill(null);
            return patterns;
        };
    }
    compilePatterns(cctx, node, pass, fail) {
        // this looks a little convoluted, but basically we're creating a chain of pattern parsers
        // that on fail go to the next pattern parser and the final pattern goes to the fail
        // that was passed in. The convolution comes from the need to manage variable scoping carefully.
        let nextOp = fail;
        for (let i = node.patterns.length - 1; i >= 0; i--) {
            nextOp = ((failOp) => {
                let patternOp = this.compilePattern(cctx, node.patterns[i], this.audit(node, "pass", (ictx, buf) => { ictx.commitScope(); return pass; }), this.audit(node, "fail", (ictx, buf) => { ictx.rollbackScope(); return failOp; }));
                return this.audit(node, "run", (ictx, buf) => { ictx.beginScope(); return patternOp; });
            })(nextOp);
        }
        return nextOp;
    }
    compilePattern(cctx, node, pass, fail) {
        let prev = pass;
        for (let i = node.tokens.length - 1; i >= 0; i--) {
            prev = this.compileToken(cctx, node.tokens[i], prev, fail);
        }
        return prev;
    }
    compileToken(cctx, node, pass, fail) {
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
        }
        else {
            newPass = this.audit(node, "pass", (ictx, buf) => {
                ictx.position += ictx.consumed;
                ictx.consumed = 0;
                return pass;
            });
        }
        if (node.repeat) {
            let repeat = this.compileDescriptor(cctx, node.descriptor, this.audit(node, "pass", (ictx, buf) => {
                ictx.position += ictx.consumed;
                ictx.consumed = 0;
                return repeat;
            }), newPass);
            if (node.required) {
                // first time through must match, optionally thereafter
                return this.compileDescriptor(cctx, node.descriptor, repeat, fail);
            }
            else {
                // always passes
                return repeat;
            }
        }
        else {
            return this.compileDescriptor(cctx, node.descriptor, newPass, node.required ? fail : pass);
        }
    }
    compileDescriptor(cctx, node, pass, fail) {
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
                    };
                }
                else {
                    setCapture = (ictx, value) => {
                        ictx.captures[captureIndex] = value;
                    };
                }
                let setCaptureHook = useOutput ?
                    (ictx, buf) => { setCapture(ictx, ictx.output); return pass; }
                    : (ictx, buf) => { setCapture(ictx, buf.substr(ictx.position, ictx.consumed)); return pass; };
                return this.compilePatterns(cctx, node, this.audit(node, "pass", setCaptureHook), fail);
            case "ruleref":
                let name = node.name;
                let rulesetOps = this.rulesetOps;
                if (rulesetOps[name] === undefined) {
                    // set a null value so that we don't get infinite compilation recursion in 
                    // the case where our rule calls itself
                    rulesetOps[name] = null;
                    rulesetOps[name] = this.compileRuleset(cctx, this.grammar.rulesetLookup[name], this.audit(node, "pass", (ictx, buf) => { return ictx.popFrame().pass; }), this.audit(node, "fail", (ictx, buf) => { return ictx.popFrame().fail; }));
                }
                // detect left recursion by checking the current position against the previous position
                // when this ruleref is executed - if the position is unchanged, we have left recursion.
                // But, double-check our context iteration so that we don't conflict across parses.
                let prevIteration = -1;
                let prevPos = -1;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.iteration == prevIteration && ictx.position == prevPos) {
                        throw "left recursion not yet implemented";
                    }
                    prevIteration = ictx.iteration;
                    prevPos = ictx.position;
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
                        }
                        else {
                            return fail;
                        }
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            case "class":
                let ranges = node.ranges;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.position + ictx.consumed < buf.length) {
                        let c = buf.charAt(ictx.position + ictx.consumed);
                        for (let range of ranges) {
                            if (c >= range[0].match && c <= range[1].match) {
                                ictx.consumed++;
                                return pass;
                            }
                        }
                        return fail;
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            case "any":
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.position + ictx.consumed < buf.length) {
                        ictx.consumed++;
                        return pass;
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            default:
                throw new Error("not implemented");
        }
    }
    compileValue(cctx, node, pass) {
        let builder = this.compileValueBuilder(cctx, node);
        return this.audit(node, "output", (ictx, buf) => {
            ictx.output = builder(ictx, buf);
            return pass;
        });
    }
    compileValueBuilder(cctx, node) {
        switch (node.type) {
            case "null":
                return (ictx, buf) => {
                    return null;
                };
            case "boolean":
                let b = node.value;
                return (ictx, buf) => {
                    return b;
                };
            case "number":
                let n = node.value;
                return (ictx, buf) => {
                    return Number(n);
                };
            case "string":
                let strBuilders = node.tokens.map((node) => {
                    let value = node.value;
                    if (node.type == "text") {
                        return () => value;
                    }
                    else if (node.value[0] == 'u') {
                        return () => String.fromCharCode(Number(`0x${value.substr(1)}`));
                    }
                    else if (node.value.length > 1) {
                        Parser_1.parserError(Parser_1.ErrorCode.Unreachable);
                    }
                    else if ("bfnrt".indexOf(value) >= 0) {
                        return () => ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[value];
                    }
                    else {
                        return () => value;
                    }
                });
                return (ictx, buf) => {
                    return strBuilders.map((b) => b()).join('');
                };
            case "array":
                let elemBuilders = node.elements.map((item) => {
                    let builder = this.compileValueBuilder(cctx, item);
                    if (item.type == "spread") {
                        return (ictx, buf, array) => array.concat(builder(ictx, buf));
                    }
                    else {
                        return (ictx, buf, array) => {
                            array.push(builder(ictx, buf));
                            return array;
                        };
                    }
                });
                return (ictx, buf) => {
                    return elemBuilders.reduce((a, f) => f(ictx, buf, a), []);
                };
            case "object":
                let ret = {};
                let objBuilders = node.members.map((member) => {
                    if (member.type == "spread") {
                        let tupleBuilder = this.compileValueBuilder(cctx, member);
                        return (ictx, buf, retval) => {
                            return tupleBuilder(ictx, buf).reduce((o, tuple) => {
                                if (!Array.isArray(tuple) || tuple.length != 2) {
                                    GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                                }
                                o[tuple[0]] = tuple[1];
                                return o;
                            }, retval);
                        };
                    }
                    else {
                        let keyOp = this.compileValueBuilder(cctx, member.name);
                        let valueOp = this.compileValueBuilder(cctx, member.value);
                        return (ictx, buf, retval) => {
                            retval[keyOp(ictx, buf)] = valueOp(ictx, buf);
                            return retval;
                        };
                    }
                });
                return (ictx, buf) => objBuilders.reduce((o, f) => f(ictx, buf, o), {});
            case "backref":
                let index = node.index;
                if (index == "0") {
                    return (ictx, buf) => {
                        return buf.substrExact(ictx.position, ictx.consumed);
                    };
                }
                else {
                    if (cctx.currentRule.captures[index]) {
                        return (ictx, buf) => {
                            return ictx.captures[index] || [];
                        };
                    }
                    else {
                        return (ictx, buf) => {
                            return ictx.captures[index];
                        };
                    }
                }
            case "call":
                let callback = this.grammar.callbacks[node.name];
                let argBuilders = node.args.map((arg) => this.compileValueBuilder(cctx, arg));
                if (!callback) {
                    GrammarCompiler_1.grammarError(Parser_1.ErrorCode.FunctionNotFound, this.grammar.text, node.meta, node.name);
                }
                return (ictx, buf) => {
                    try {
                        return callback.apply(null, argBuilders.map((arg) => arg(ictx, buf)));
                    }
                    catch (e) {
                        GrammarCompiler_1.grammarError(Parser_1.ErrorCode.CallbackError, this.grammar.text, node.meta, String(e));
                    }
                };
            case "spread":
                let spreader = this.compileValueBuilder(cctx, node.value);
                return (ictx, buf) => {
                    let value = spreader(ictx, buf);
                    if (value === null || value === undefined || (typeof value != 'object' && typeof value != 'string')) {
                        GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
                    }
                    if (Array.isArray(value)) {
                        return value;
                    }
                    else if (typeof value == "string") {
                        return value.split('');
                    }
                    else {
                        return Object.entries(value);
                    }
                };
            default:
                throw new Error("not implemented");
        }
    }
}
exports.OpcodeCompiler = OpcodeCompiler;
