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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
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
        this.minSizeInMB = 1;
        this.chunks = [];
        this.indices = [];
        this._length = 0;
        this._closed = false;
        if (typeof textOrSize == "string") {
            this.addChunk(textOrSize);
            this.close();
        }
        else if (typeof textOrSize == "number") {
            this.minSizeInMB = textOrSize;
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
    ParseBuffer.prototype.addChunk = function (text) {
        var buffered = 0;
        for (var i = 0; i < this.chunks.length; i++) {
            if (buffered >= this.minSizeInMB * 1024 * 1024) {
                if (this.chunks[i]) {
                    this.chunks[i] = null;
                }
                else {
                    // we've already freed everything here on out
                    break;
                }
            }
            if (this.chunks[i])
                buffered += this.chunks[i].length;
        }
        this.indices.unshift(this.indices.length ? this.indices[0] + this.chunks[0].length : 0);
        this.chunks.unshift(text);
        this._length += text.length;
    };
    ParseBuffer.prototype.substr = function (startIdx, length) {
        var _a = __read(this.chunkIndexFor(startIdx), 2), chunkIdx = _a[0], charIdx = _a[1];
        if (chunkIdx < 0) {
            return '';
        }
        var chunk = this.chunks[chunkIdx];
        if (chunk == null) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        var text = chunk.substr(charIdx, length);
        while (text.length < length) {
            chunkIdx--;
            if (chunkIdx < 0) {
                return text;
            }
            text += this.chunks[chunkIdx].substr(0, length - text.length);
        }
        return text;
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
        var _a = __read(this.chunkIndexFor(idx), 2), chunkIdx = _a[0], charIdx = _a[1];
        if (chunkIdx < 0) {
            throw exports.ParseBufferExhaustedError;
        }
        var chunk = this.chunks[chunkIdx];
        if (chunk == null) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        return this.chunks[chunkIdx].charAt(charIdx);
    };
    ParseBuffer.prototype.chunkIndexFor = function (idx) {
        if (this.indices.length == 0 || idx >= this.indices[0] + this.chunks[0].length) {
            return [-1, -1];
        }
        for (var i = 0; i < this.indices.length; i++) {
            if (idx >= this.indices[i]) {
                return [i, idx - this.indices[i]];
            }
        }
        throw Parser_1.parserError(Parser_1.ErrorCode.Unreachable);
    };
    ParseBuffer.prototype.findLineAndChar = function (pos) {
        var e_1, _a;
        var lineText = '';
        var line = 0;
        try {
            for (var _b = __values(this.chunks.reverse().join('').split('\n')), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                        line: line,
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
            line: line,
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
