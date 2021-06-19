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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseBuffer = exports.ParseBufferExhaustedError = void 0;
var Parser_1 = require("./Parser");
exports.ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");
var ParseBuffer = /** @class */ (function () {
    function ParseBuffer(textOrSize) {
        this.minSize = 1 * 1024 * 1024;
        this.text = '';
        this.offset = 0;
        this._length = 0;
        this._closed = false;
        if (typeof textOrSize == "string") {
            this.addChunk(textOrSize);
            this.close();
        }
        else if (typeof textOrSize == "number") {
            this.minSize = textOrSize * 1024 * 1024;
        }
    }
    Object.defineProperty(ParseBuffer.prototype, "length", {
        get: function () {
            return this._length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ParseBuffer.prototype, "closed", {
        get: function () {
            return this._closed;
        },
        enumerable: false,
        configurable: true
    });
    ParseBuffer.prototype.addChunk = function (input) {
        var trim = 0;
        if (this.text.length > this.minSize) {
            trim = this.text.length - this.minSize;
        }
        this.text = this.text.substr(trim) + input;
        this.offset += trim;
        this._length += input.length;
    };
    ParseBuffer.prototype.substr = function (startIdx, length) {
        startIdx -= this.offset;
        if (startIdx < 0) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        return this.text.substr(startIdx, length);
    };
    ParseBuffer.prototype.substrExact = function (startIdx, length) {
        var s = this.substr(startIdx, length);
        if (s.length != length) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return s;
        }
    };
    ParseBuffer.prototype.containsAt = function (text, idx) {
        return text == this.substrExact(idx, text.length);
    };
    ParseBuffer.prototype.charAt = function (idx) {
        idx -= this.offset;
        if (idx >= this.text.length) {
            throw exports.ParseBufferExhaustedError;
        }
        else if (idx < 0) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        else {
            return this.text[idx];
        }
    };
    ParseBuffer.prototype.findLineAndChar = function (pos) {
        var e_1, _a;
        var lineText = '';
        var line = 0;
        pos -= this.offset;
        try {
            for (var _b = __values(this.text.split('\n')), _c = _b.next(); !_c.done; _c = _b.next()) {
                lineText = _c.value;
                line++;
                if (pos <= lineText.length) {
                    var leading = 0;
                    for (var i = 0; i < pos; i++) {
                        if (lineText[i] == '\t') {
                            leading += 4;
                        }
                        else {
                            leading++;
                        }
                    }
                    var detabbed = lineText.replace(/\t/g, ' '.repeat(4));
                    return {
                        line: this.offset > 0 ? "unknown" : line,
                        char: pos + 1,
                        lineText: detabbed,
                        pointerText: ' '.repeat(leading) + '^'
                    };
                }
                pos -= lineText.length + 1;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: this.offset > 0 ? "unknown" : line,
            char: lineText.length,
            lineText: lineText,
            pointerText: ' '.repeat(lineText.length) + '^'
        };
    };
    ParseBuffer.prototype.close = function () {
        this._closed = true;
    };
    return ParseBuffer;
}());
exports.ParseBuffer = ParseBuffer;
