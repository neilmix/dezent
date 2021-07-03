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
import { assert, ErrorCode, parsingError } from "./Parser";

export const Pass = -1;
export const Fail = -2;
export const WaitInput = -3;

export type Frame = {
    pass:Operation;
    fail:Operation;
}

export class Context {
    position:number = 0;
    consumed:number = 0;
    output:any;
    captures:any[] = [];
    status:number;
    scopes = [];
    frames = [];
    auditLog = [];
    constructor() {
    }
    
    beginScope() {
        this.scopes.push({ position: this.position, consumed: this.consumed })
        this.position += this.consumed;
        this.consumed = 0;
    }

    commitScope() {
        let scope = this.scopes.pop();
        assert(scope !== undefined);
        this.consumed = (this.position + this.consumed) - scope.position;
        this.position = scope.position;
    }

    rollbackScope() {
        let scope = this.scopes.pop();
        this.position = scope.position;
        this.consumed = scope.consumed;
    }

    pushFrame(pass:Operation, fail:Operation) {
        this.frames.push({ pass: pass, fail: fail, captures: this.captures });
        this.captures = [];
    }

    popFrame() {
        let frame = this.frames.pop();
        this.captures = frame.captures;
        return frame;
    }
}

export class Interpreter {
    public static debug = false;
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

        if (Interpreter.debug) {
            console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            console.log("status: ", ctx.status);
        }
        if (ctx.status == Pass) {
            assert(ctx.position == 0);
            if (ctx.consumed < buf.length) {
                parsingError(ErrorCode.TextParsingError, buf, ctx.consumed, ["<EOF>"]);
            }
            return ctx.output;
        } else {
            throw new Error("not implemented");
        }
    }
}
