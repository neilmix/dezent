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
exports.parseGrammar = exports.DezentStream = exports.Dezent = void 0;
const Error_1 = require("./Error");
const GrammarCompiler_1 = require("./GrammarCompiler");
const ParseBuffer_1 = require("./ParseBuffer");
const OpcodeCompiler_1 = require("./OpcodeCompiler");
const Interpreter_1 = require("./Interpreter");
class Dezent {
    constructor(grammarStr, options) {
        this.options = fillOptions(options);
        this.grammar = parseGrammar(grammarStr, this.options);
        this.error = null;
    }
    parse(text) {
        try {
            let stream = new DezentStream(this.grammar, this.options);
            stream.write(text);
            return stream.close();
        }
        catch (e) {
            this.error = e;
            if (this.options.debugErrors) {
                throw e;
            }
            return undefined;
        }
    }
}
exports.Dezent = Dezent;
class DezentStream {
    constructor(grammar, options) {
        this.options = fillOptions(options);
        this.buffer = new ParseBuffer_1.ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? parseGrammar(grammar, this.options) : grammar;
        this.opcode = new OpcodeCompiler_1.OpcodeCompiler(grammar, this.options.enableProfiling).compile();
        this.interpreter = new Interpreter_1.Interpreter(this.opcode, this.buffer);
    }
    write(text) {
        this.buffer.addChunk(text);
        this.interpreter.resume();
    }
    close() {
        this.buffer.close();
        return this.interpreter.resume();
    }
}
exports.DezentStream = DezentStream;
function fillOptions(options) {
    options = options || {};
    return {
        minBufferSizeInMB: options.minBufferSizeInMB || 1,
        callbacks: options.callbacks || {},
        enableProfiling: options.enableProfiling || false,
    };
}
let dezentOpcode;
function parseGrammar(text, options) {
    if (!dezentOpcode) {
        dezentOpcode = new OpcodeCompiler_1.OpcodeCompiler(GrammarCompiler_1.findDezentGrammar(), false).compile();
    }
    let buf = new ParseBuffer_1.ParseBuffer(text);
    let interpreter = new Interpreter_1.Interpreter(dezentOpcode, new ParseBuffer_1.ParseBuffer(text));
    try {
        let grammar = interpreter.resume();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text, options.callbacks);
        return grammar;
    }
    catch (e) {
        if (e["code"] == Error_1.ErrorCode.TextParsingError) {
            Error_1.parsingError(Error_1.ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        }
        else {
            throw e;
        }
    }
}
exports.parseGrammar = parseGrammar;
