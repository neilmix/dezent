/*
 *  Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *  Copyright (C) 2020  Neil Mix  <neilmix@gmail.com>
 *  Commercial licensing and support are available, please contact neilmix@gmail.com.
 * 
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>. 
 */

 import { parserError, ErrorCode } from "./Parser";

 export const ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");

 export class ParseBuffer {
    private minSizeInMB : number = 1;
    private chunks : string[] = [];
    private indices : number[] = [];
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
            this.minSizeInMB = textOrSize;
        }
    }

    addChunk(text:string) {
        let buffered = 0;
        for (let i = 0; i < this.chunks.length; i++) {
            if (buffered > this.minSizeInMB * 1024 * 1024) {
                if (this.chunks[i]) {
                    this.chunks[i] = null;
                } else {
                    // we've already freed everything here on out
                    break;
                }
            }
            if (this.chunks[i]) buffered += this.chunks[i].length;
        }
        this.indices.unshift(this.indices.length ? this.indices[0] + this.chunks[0].length : 0);
        this.chunks.unshift(text);
        this._length += text.length;
    }

    substr(startIdx:number, length:number) : string {
        let [chunkIdx, charIdx] = this.chunkIndexFor(startIdx);
        if (chunkIdx < 0) {
            return '';
        }

        let chunk = this.chunks[chunkIdx];
        if (chunk == null) {
            parserError(ErrorCode.InputFreed);
        }
        let text = chunk.substr(charIdx, length);
        while (text.length < length) {
            chunkIdx--;
            if (chunkIdx < 0) {
                return text;
            }
            text += this.chunks[chunkIdx].substr(0, length-text.length);
        }
        return text;
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
        let [chunkIdx, charIdx] = this.chunkIndexFor(idx);
        if (chunkIdx < 0) {
            throw ParseBufferExhaustedError;
        }
        let chunk = this.chunks[chunkIdx];
        if (chunk == null) {
            parserError(ErrorCode.InputFreed);
        }
        return this.chunks[chunkIdx].charAt(charIdx);
    }

    chunkIndexFor(idx:number) : [number, number] {
        if (this.indices.length == 0 || idx >= this.indices[0] + this.chunks[0].length) {
            return [-1, -1];
        }
        for (let i = 0; i < this.indices.length; i++) {
            if (idx >= this.indices[i]) {
                return [i, idx - this.indices[i]];
            }
        }
        throw parserError(ErrorCode.Unreachable);
    }

    findLineAndChar(pos:number) : { line: number, char: number, lineText: string, pointerText: string } {
        let lineText = '';
        let line = 0;
        for (lineText of this.chunks.reverse().join('').split('\n')) {
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
                    line: line,
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
            line: line,
            char: lineText.length,
            lineText: lineText,
            pointerText: ' '.repeat(lineText.length) + '^'
        }
    }

    close() {
        this._closed = true;
    }
 }