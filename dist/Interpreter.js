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
const Parser_1 = require("./Parser");
exports.Run = -1;
exports.Pass = -2;
exports.Fail = -3;
exports.WaitInput = -4;
class Context {
    constructor() {
        this.iteration = 0;
        this.position = 0;
        this.consumed = 0;
        this.captures = [];
        this.status = exports.Run;
        this.scopes = [];
        this.frames = [];
        this.auditLog = [];
    }
    beginScope() {
        this.scopes.push({ position: this.position, consumed: this.consumed });
        this.position += this.consumed;
        this.consumed = 0;
    }
    commitScope() {
        let scope = this.scopes.pop();
        Parser_1.assert(scope !== undefined);
        this.consumed = (this.position + this.consumed) - scope.position;
        this.position = scope.position;
    }
    rollbackScope() {
        let scope = this.scopes.pop();
        this.position = scope.position;
        this.consumed = scope.consumed;
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
        do {
            op = result;
            result = op(ctx, buf);
        } while (result !== null);
        if (Interpreter.debug) {
            console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            console.log("status: ", ctx.status);
        }
        switch (ctx.status) {
            case exports.Pass:
                Parser_1.assert(ctx.position == 0);
                if (!buf.closed) {
                    this.resumeOp = op;
                    ctx.status = exports.Run;
                    return;
                }
                if (ctx.consumed < buf.length) {
                    Parser_1.parsingError(Parser_1.ErrorCode.TextParsingError, buf, ctx.consumed, ["<EOF>"]);
                }
                return ctx.output;
            case exports.Fail:
                throw new Error("Parse Error");
            case exports.WaitInput:
                this.resumeOp = op;
                return;
            default:
                Parser_1.parserError(Parser_1.ErrorCode.Unreachable);
        }
    }
}
exports.Interpreter = Interpreter;
Interpreter.debug = false;
