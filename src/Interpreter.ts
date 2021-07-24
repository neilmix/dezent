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
    profileRules = [];
    profileActions = [];
    profileTimes = [];
    profilePositions = [];

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

    dumpDebug() {
        console.log(this.auditLog.map((line) => line.join(' ')).join('\n'));
        console.log("status: ", this.status);
        this.auditLog.length = 0;
    }

    dumpProfile() {
        if (this.profileActions.length == 0) {
            return;
        }
        
        let stack = [];
        let calls = [];
        for (let i = 0; i < this.profileRules.length; i++) {
            if (this.profileActions[i] == "run") {
                stack.push({
                    name: this.profileRules[i],
                    startTime: this.profileTimes[i],
                    endTime: 0,
                    position: this.profilePositions[i],
                    duration: 0,
                    result: ""
                });
            } else {
                let out = stack.pop();
                assert(!!out);
                assert(out.name == this.profileRules[i]);
                assert(out.position == this.profilePositions[i]);
                out.endTime = this.profileTimes[i];
                out.duration = out.endTime - out.startTime;
                out.result = this.profileActions[i];
                calls.push(out);
            }
        }

        let summaries = {};
        let callPositions = {};
        for (let call of calls) {
            let summary = summaries[call.name];
            if (!summary) {
                summary = summaries[call.name] = {
                    name: call.name,
                    callCount: 0,
                    callTime: 0,
                    passCount: 0,
                    passTime: 0,
                    failCount: 0,
                    failTime: 0,
                    redundantCalls: 0,
                }
            }
            summary.callCount++;
            summary.callTime += call.duration;
            if (call.result == "pass") {
                summary.passCount++;
                summary.passTime += call.duration;
            } else {
                assert(call.result == "fail");
                summary.failCount++;
                summary.failTime += call.duration;
            }
            
            let key = `${call.name}-${call.position}`;
            if (callPositions[key]) {
                summary.redundantCalls++;
            } else {
                callPositions[key] = true;
            }
        }

        let atoms = [];
        function w(s:string|number, padding?:number) {
            padding = padding || 10;
            s = String(s).substr(0,padding);
            atoms.push(' '.repeat(padding - s.length));
            atoms.push(s);
            atoms.push("  ");
        }

        function nl() {
            atoms.push("\n");
        }

        w("rule name", 15), w("call count"), w("call time"), w("pass count"), w("pass time"), w("fail count"), w("fail time"), w("redundant"), nl();
        w("---------", 15), w("----------"), w("---------"), w("----------"), w("---------"), w("----------"), w("---------"), w("---------"), nl();
        for (let name of Object.keys(summaries).sort()) {
            let s = summaries[name];
            w(s.name, 15), w(s.callCount), w(s.callTime), w(s.passCount), w(s.passTime), w(s.failCount), w(s.failTime), w(s.redundantCalls), nl();
        }

        console.log(atoms.join(""));

        this.profileRules.length = 0;
        this.profileActions.length = 0;
        this.profileTimes.length = 0;
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
            ctx.dumpDebug();
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
                ctx.dumpProfile();
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
