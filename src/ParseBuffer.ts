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

 export class ParseBuffer {
    private chunks : string[] = [];
    private indices : number[] = [];
    private chunkIndex : number = 0;
    private _length : number = 0;

    get length(): number {
        return this._length;
    }

    constructor(text?:string) {
        if (text) {
            this.addChunk(text);
        }
    }

    addChunk(text:string) {
        this.chunks.unshift(text);
        this.indices.unshift(this.indices.length ? this.indices[0] + text.length : 0);
        this._length += text.length;
    }

    substr(startIdx:number, length:number) : string {
        let [chunkIdx, charIdx] = this.chunkIndexFor(startIdx);
        if (chunkIdx < 0) {
            return '';
        }

        let chunk = this.chunks[chunkIdx];
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

    containsAt(text:string, idx:number) : boolean {
        return text == this.substr(idx, text.length);
    }

    charAt(idx:number) : string {
        let [chunkIdx, charIdx] = this.chunkIndexFor(idx);
        if (chunkIdx < 0) {
            return '';
        } else {
            return this.chunks[chunkIdx].charAt(charIdx);
        }
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

    *lineIterator() : IterableIterator<{ line: number, char: number, length: number, lineText: string }> {
        let linenum = 0, char = 0, remainder = '';
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            let lines = this.chunks[i].split('\n');
            for (let j = 0; j < lines.length; j++) {
                let line = j == 0 ? remainder + lines[j] : lines[j];
                if (j < lines.length - 1) {
                    linenum++;
                    yield { line: linenum, char: char, length: lines[j].length + 1, lineText: lines[j] };
                    char += lines[j].length + 1;    
                } else {
                    remainder = lines[j];
                }
            }
        }
        yield { line: ++linenum, char: char, length: remainder.length, lineText: remainder };
    }

    findLineAndChar(pos:number) : { line: number, char: number, lineText: string, pointerText: string } {
        let lineData;
        for (lineData of this.lineIterator()) {
            if (lineData.char + lineData.length >= pos) {
                let char = pos - lineData.char;
                let leading = 0;
                for (let i = 0; i < char; i++) {
                    if (lineData.lineText[i] == '\t') {
                        leading += 4;
                    } else {
                        leading++;
                    }
                }
                let detabbed = lineData.lineText.replace(/\t/g, ' '.repeat(4));
                return {
                    line: lineData.line,
                    char: pos - lineData.char + 1,
                    lineText: detabbed,
                    pointerText: ' '.repeat(leading) + '^'
                }
            }
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: lineData.line,
            char: lineData.length,
            lineText: lineData.lineText,
            pointerText: ' '.repeat(lineData.length) + '^'
        }
    }
 }