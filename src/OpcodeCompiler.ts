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
    Node, DescriptorNode, Grammar, PatternNode, RuleNode, RulesetNode, SelectorNode, TokenNode, ValueNode
} from "./Grammar";
import { Context, Pass, Fail, WaitInput, Interpreter } from "./Interpreter";
import { ParseBuffer } from "./ParseBuffer";

export type Operation = (ctx:Context, buf:ParseBuffer) => Operation|null;

export class OpcodeCompiler {
    constructor() {
    }

    audit(node:Node, action:string, op:Operation):Operation {
        function pad(s:string|number, len:number) {
            s = String(s).substr(0,len);
            return s + ' '.repeat(len - s.length);
        }
        if (Interpreter.debug) {
            return (ctx, buf) => {
                ctx.auditLog.push([pad(node ? node.type : "", 10), pad(action, 10), pad(ctx.position, 8), pad(ctx.consumed, 8), pad(ctx.scopes.length,5)]);
                return op(ctx, buf);
            };
        } else {
            return op;
        }
    }

    compileGrammar(grammar:Grammar):Operation {
        return this.compileRuleset(
            grammar.rulesetLookup.return, 
            this.audit(null, "pass", (ctx, buf) => { ctx.status = Pass; return null; }), 
            this.audit(null, "fail", (ctx, buf) => { ctx.status = Fail; return null; }));
    }

    compileRuleset(node:RulesetNode, pass:Operation, fail:Operation):Operation {
        if(node.rules.length == 1) {
            return this.compileRule(node.rules[0], pass, fail);
        } else {
            throw new Error("Not implemented");
        }
    }

    compileRule(node:RuleNode, pass:Operation, fail:Operation):Operation {
        return this.compilePatterns(node, this.compileValue(node.value, pass), pass);
    }

    compilePatterns(node:SelectorNode, pass: Operation, fail:Operation):Operation {
        if (node.patterns.length == 1) {
            let patternOp = this.compilePattern(
                node.patterns[0],
                this.audit(node, "pass", (ctx, buf) => { ctx.commit(); return pass; }),
                this.audit(node, "fail", (ctx, buf) => { ctx.rollback(); return fail; }),
            );
            return this.audit(node, "run", (ctx, buf) => {
                ctx.begin();
                return patternOp;
            });
        } else {
            throw new Error("Not implemented");
        }
    }

    compilePattern(node:PatternNode, pass:Operation, fail:Operation):Operation {
        let prev = pass;
        for (let i = node.tokens.length - 1; i >= 0; i--) {
            prev = this.compileToken(node.tokens[i], prev, fail);
        }
        return prev;
    }

    compileToken(node:TokenNode, pass:Operation, fail:Operation):Operation {
        if (node.and || node.not) {
            throw new Error("not implemented");
        }
        
        let repeat;
        if (node.repeat) {
            return repeat = this.compileDescriptor(node.descriptor, this.audit(node, "pass", () => { return repeat; }), pass);
        } else {
            return this.compileDescriptor(node.descriptor, pass, fail);
        }
    }

    compileDescriptor(node:DescriptorNode, pass:Operation, fail:Operation):Operation {
        switch (node.type) {
            case "group":
                return this.compilePatterns(node, pass, fail);
            case "string":
                let matchStr = node.pattern;
                return this.audit(node, "run", (ctx, buf) => {
                    if (ctx.position + ctx.consumed + matchStr.length <= buf.length) {
                        if (buf.containsAt(matchStr, ctx.position + ctx.consumed)) {
                            ctx.consumed += matchStr.length;
                            return pass;
                        } else {
                            return fail;
                        }
                    } else if (buf.closed) {
                        return fail;
                    } else {
                        ctx.status = WaitInput;
                        return null;
                    }
                });
            case "any":
                return this.audit(node, "run", (ctx, buf) => {
                    if (ctx.position + ctx.consumed < buf.length) {
                        ctx.consumed++;
                        return pass;
                    } else if (buf.closed) {
                        return fail;
                    } else {
                        ctx.status = WaitInput;
                        return null;
                    }
                });
            default:
                throw new Error("not implemented");
        }
    }

    compileValue(node:ValueNode, pass:Operation):Operation {
        let builder = this.compileValueBuilder(node);
        return this.audit(node, "output", (ctx,buf) => {
            ctx.output = builder(ctx, buf);
            return pass;
        });
    }

    compileValueBuilder(node:ValueNode):(ctx:Context, buf:ParseBuffer) => any {
        switch (node.type) {
            case "null":
                return (ctx, buf) => {
                    return null;
                }
            case "backref":
                if (node.index == "0") {
                    return (ctx, buf) => {
                        return buf.substrExact(ctx.position, ctx.consumed);
                    }
                } else {
                    throw new Error("not implemented");
                }
            default:
                throw new Error("not implemented");
        }
    }
}