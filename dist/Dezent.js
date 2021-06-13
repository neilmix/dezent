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
exports.DezentStream = exports.Dezent = void 0;
var Parser_1 = require("./Parser");
var ParseBuffer_1 = require("./ParseBuffer");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, options) {
        this.grammar = Parser_1.parseGrammar(grammarStr, grammarOptions(options));
        this.options = options || {};
        this.error = null;
    }
    Dezent.prototype.parse = function (text) {
        try {
            var stream = new DezentStream(this.grammar, this.options);
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
    };
    return Dezent;
}());
exports.Dezent = Dezent;
var DezentStream = /** @class */ (function () {
    function DezentStream(grammar, options) {
        this.options = options || {};
        this.buffer = new ParseBuffer_1.ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? Parser_1.parseGrammar(grammar, grammarOptions(this.options)) : grammar;
        this.parser = new Parser_1.Parser(grammar, this.buffer, this.options);
    }
    DezentStream.prototype.write = function (text) {
        this.buffer.addChunk(text);
        this.parser.parse();
    };
    DezentStream.prototype.close = function () {
        this.buffer.close();
        return this.parser.parse();
    };
    return DezentStream;
}());
exports.DezentStream = DezentStream;
function grammarOptions(opt) {
    // don't dumpDebug when parsing the grammar
    var gOpt = Object.assign({}, opt);
    gOpt.dumpDebug = false;
    return gOpt;
}
