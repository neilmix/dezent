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
exports.ParseBuffer = exports.ParseBufferExhaustedError = void 0;
const Error_1 = require("./Error");
exports.ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");
class ParseBuffer {
    get length() {
        return this._length;
    }
    get closed() {
        return this._closed;
    }
    constructor(textOrSize) {
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
    addChunk(input) {
        let trim = 0;
        if (this.text.length > this.minSize) {
            trim = this.text.length - this.minSize;
        }
        this.text = this.text.substr(trim) + input;
        this.offset += trim;
        this._length += input.length;
    }
    substr(startIdx, length) {
        startIdx -= this.offset;
        if (startIdx < 0) {
            (0, Error_1.parserError)(Error_1.ErrorCode.InputFreed);
        }
        return this.text.substr(startIdx, length);
    }
    substrExact(startIdx, length) {
        let s = this.substr(startIdx, length);
        if (s.length != length) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return s;
        }
    }
    containsAt(text, idx) {
        return text == this.substrExact(idx, text.length);
    }
    charAt(idx) {
        idx -= this.offset;
        if (idx >= this.text.length) {
            throw exports.ParseBufferExhaustedError;
        }
        else if (idx < 0) {
            (0, Error_1.parserError)(Error_1.ErrorCode.InputFreed);
        }
        else {
            return this.text[idx];
        }
    }
    findLineAndChar(pos) {
        let lineText = '';
        let line = 0;
        pos -= this.offset;
        for (lineText of this.text.split('\n')) {
            line++;
            if (pos <= lineText.length) {
                let leading = 0;
                for (let i = 0; i < pos; i++) {
                    if (lineText[i] == '\t') {
                        leading += 4;
                    }
                    else {
                        leading++;
                    }
                }
                let detabbed = lineText.replace(/\t/g, ' '.repeat(4));
                return {
                    line: this.offset > 0 ? "unknown" : line,
                    char: pos + 1,
                    lineText: detabbed,
                    pointerText: ' '.repeat(leading) + '^'
                };
            }
            pos -= lineText.length + 1;
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: this.offset > 0 ? "unknown" : line,
            char: lineText.length,
            lineText: lineText,
            pointerText: ' '.repeat(lineText.length) + '^'
        };
    }
    close() {
        this._closed = true;
    }
}
exports.ParseBuffer = ParseBuffer;
