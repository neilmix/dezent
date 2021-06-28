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

import { Operation } from "./OpcodeCompiler";
import { ParseBuffer } from "./ParseBuffer";

export const Pass = -1;
export const Fail = -2;
export const WaitInput = -3;

export class Context {
    consumed:number = 0;
    position:number = 0;
    output:any;
    status:number;
    constructor() {
    }
}

export class Interpreter {
    rootOp:Operation;
    constructor(op:Operation) {
        this.rootOp = op;
    }

    execute(buf:ParseBuffer) {
        let ctx = new Context();
        let op = this.rootOp;
        do {
            op = op(ctx, buf);
        } while(op !== null);

        if (ctx.status == Pass) {
            return ctx.output;
        } else {
            throw new Error("not implemented");
        }
    }
}
