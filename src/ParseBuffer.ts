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


 import { parserError, ErrorCode } from "./Parser";

 export const ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");

 export class ParseBuffer {
    private minSize : number = 1 * 1024 * 1024;
    private text = '';
    private offset = 0;
    private _length : number = 0;
    private _closed : boolean = false;

    get length(): number {
        return this._length;
    }

    get closed() : boolean {
        return this._closed;
    }

    constructor(textOrSize?:string|number) {
        if (typeof textOrSize == "string") {
            this.addChunk(textOrSize);
            this.close();
        } else if (typeof textOrSize == "number") {
            this.minSize = textOrSize * 1024 * 1024;
        }
    }

    addChunk(input:string) {
        let trim = 0;
        if (this.text.length > this.minSize) {
            trim = this.text.length - this.minSize;
        }
        this.text = this.text.substr(trim) + input;
        this.offset += trim;
        this._length += input.length;
    }

    substr(startIdx:number, length:number) : string {
        startIdx -= this.offset;
        if (startIdx < 0) {
            parserError(ErrorCode.InputFreed);
        }
        return this.text.substr(startIdx, length);
    }

    substrExact(startIdx:number, length:number) : string {
        let s = this.substr(startIdx, length);
        if (s.length != length) {
            throw ParseBufferExhaustedError;
        } else {
            return s;
        }
    }

    containsAt(text:string, idx:number) : boolean {
        return text == this.substrExact(idx, text.length);
    }

    charAt(idx:number) : string {
        idx -= this.offset;
        if (idx >= this.text.length) {
            throw ParseBufferExhaustedError;
        } else if(idx < 0) {
            parserError(ErrorCode.InputFreed);
        } else {
            return this.text[idx];
        }
    }

    findLineAndChar(pos:number) : { line: number|string, char: number, lineText: string, pointerText: string } {
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
                    } else {
                        leading++;
                    }
                }
                let detabbed = lineText.replace(/\t/g, ' '.repeat(4));
                return {
                    line: this.offset > 0 ? "unknown" : line,
                    char: pos + 1,
                    lineText: detabbed,
                    pointerText: ' '.repeat(leading) + '^'
                }
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
        }
    }

    close() {
        this._closed = true;
    }
 }