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
    AnyNode, Grammar, PatternNode, RuleNode, RulesetNode, TokenNode, ValueNode
} from "./Grammar";
import { Context, Pass, Fail, WaitInput } from "./Interpreter";
import { ParseBuffer } from "./ParseBuffer";

export type Operation = (ctx:Context, buf:ParseBuffer) => Operation|null;

export class OpcodeCompiler {
    constructor() {
    }

    compileGrammar(grammar:Grammar):Operation {
        return this.compileRuleset(
            grammar.rulesetLookup.return, 
            (ctx, buf) => { ctx.status = Pass; return null; }, 
            (ctx, buf) => { ctx.status = Fail; return null; });
    }

    compileRuleset(node:RulesetNode, pass:Operation, fail:Operation):Operation {
        if(node.rules.length == 1) {
            return this.compileRule(node.rules[0], pass, fail);
        } else {
            throw new Error("Not implemented");
        }
    }

    compileRule(node:RuleNode, pass:Operation, fail:Operation):Operation {
        if (node.patterns.length == 1) {
            return this.compilePattern(
                node.patterns[0], 
                this.compileValue(node.value, pass), 
                fail
            );
        } else {
            throw new Error("Not implemented");
        }
    }

    compilePattern(node:PatternNode, pass:Operation, fail:Operation):Operation {
        if (node.tokens.length == 1) {
            return this.compileToken(node.tokens[0], pass, fail);
        } else {
            throw new Error("not implemented");
        }
    }

    compileToken(node:TokenNode, pass:Operation, fail:Operation):Operation {
        if (node.and || node.not || node.repeat || !node.required || node.descriptor.type != "any") {
            throw new Error("not implemented");
        }

        if (node.descriptor.type == "any") {
            return this.compileAny(node.descriptor, pass);
        }
    }

    compileAny(node:AnyNode, pass:Operation):Operation {
        return function(ctx, buf) {
            if (ctx.position < buf.length) {
                ctx.consumed++;
                return pass;
            } else {
                ctx.status = WaitInput;
                return null;
            }
        };
    }

    compileValue(node:ValueNode, pass:Operation):Operation {
        let builder = this.compileValueBuilder(node);
        return function(ctx,buf) {
            ctx.output = builder(ctx, buf);
            return pass;
        };
    }

    compileValueBuilder(node:ValueNode) {
        switch (node.type) {
            case "null":
                return function(ctx, buf) {
                    return null;
                }
            default:
                throw new Error("not implemented");
        }
    }
}