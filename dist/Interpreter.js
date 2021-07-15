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
exports.Interpreter = exports.Context = exports.WaitInput = exports.Fail = exports.Pass = exports.Run = void 0;
const Error_1 = require("./Error");
exports.Run = -1;
exports.Pass = -2;
exports.Fail = -3;
exports.WaitInput = -4;
class Context {
    constructor() {
        this.iteration = 0;
        this.startPos = 0;
        this.endPos = 0;
        this.lastConsumed = 0;
        this.captures = [];
        this.status = exports.Run;
        this.scopes = [];
        this.frames = [];
        this.auditLog = [];
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
    pushFrame(pass, fail) {
        this.frames.push({ pass: pass, fail: fail, captures: this.captures });
        this.captures = [];
    }
    popFrame() {
        let frame = this.frames.pop();
        this.captures = frame.captures;
        return frame;
    }
}
exports.Context = Context;
class Interpreter {
    constructor(op, buf) {
        this.context = new Context();
        this.resumeOp = op;
        this.buffer = buf;
    }
    resume() {
        let ctx = this.context;
        let result = this.resumeOp;
        let op;
        let buf = this.buffer;
        try {
            do {
                op = result;
                result = op(ctx, buf);
            } while (result !== null);
        }
        catch (e) {
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
            case exports.Pass:
                if (ctx.endPos < buf.length) {
                    Error_1.parsingError(Error_1.ErrorCode.TextParsingError, buf, ctx.endPos, ["<EOF>"]);
                }
                if (!buf.closed) {
                    this.resumeOp = op;
                    ctx.status = exports.WaitInput;
                    return;
                }
                return ctx.output;
            case exports.Fail:
                throw new Error("Parse Error");
            case exports.WaitInput:
                this.resumeOp = op;
                return;
            default:
                Error_1.parserError(Error_1.ErrorCode.Unreachable);
        }
    }
}
exports.Interpreter = Interpreter;
Interpreter.debug = false;
