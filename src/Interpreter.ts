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
import { assert, ErrorCode, parserError, parsingError } from "./Error";

export const Run = -1;
export const Pass = -2;
export const Fail = -3;
export const WaitInput = -4;

export type Frame = {
    pass:Operation;
    fail:Operation;
}

export class Context {
    iteration:number = 0;
    startPos:number = 0;
    endPos:number = 0;
    errorPos:number = 0;
    lastConsumed:number = 0;
    output:any;
    captures:{index: string, value: any}[] = [];
    status:number = Run;
    disableFailedPatternLevel = 0;
    scopes = [];
    frames = [];
    failedPatterns = [];
    auditLog = [];
    constructor() {
    }
    
    beginScope() {
        this.scopes.push({ startPos: this.startPos, endPos: this.endPos, captureCount: this.captures.length });
        this.startPos = this.endPos;
    }

    commitScope() {
        this.lastConsumed = this.endPos - (this.startPos = this.scopes.pop().startPos);
    }

    rollbackScope() {
        let scope = this.scopes.pop();
        this.startPos = scope.startPos;
        this.endPos = scope.endPos;
        this.captures.length = scope.captureCount;
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
    resumeOp:Operation;
    buffer:ParseBuffer;
    context:Context = new Context();
    constructor(op:Operation, buf:ParseBuffer) {
        this.resumeOp = op;
        this.buffer = buf;
    }

    resume() {
        let ctx = this.context;
        let result = this.resumeOp;
        let op:Operation;
        let buf = this.buffer;
        try {
            do {
                op = result;
                result = op(ctx, buf);
            } while(result !== null);
        } catch(e) {
            if (Interpreter.debug) {
                console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            }
            throw e;
        }

        if (Interpreter.debug) {
            console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            console.log("status: ", ctx.status);
            ctx.auditLog.length = 0;
        }
        
        switch (ctx.status) {
            case Pass:
                if (ctx.endPos < buf.length) {
                    parsingError(ErrorCode.TextParsingError, buf, ctx.endPos, buildExpectedTerminals(ctx.failedPatterns));
                }
                if (!buf.closed) {
                    this.resumeOp = op;
                    ctx.status = WaitInput;
                    return;
                }
                return ctx.output;
            case Fail:
                parsingError(ErrorCode.TextParsingError, buf, ctx.endPos, buildExpectedTerminals(ctx.failedPatterns));
            case WaitInput:
                this.resumeOp = op;
                return;
            default:
                parserError(ErrorCode.Unreachable);
        }
    }
}


function buildExpectedTerminals(failedPatterns) {
    let lookup = {};
    let out = [];
    for (let terminal of failedPatterns) {
        if (!lookup[terminal]) {
            out.push(terminal);
            lookup[terminal] = true;
        }
    }
    return out;
}
