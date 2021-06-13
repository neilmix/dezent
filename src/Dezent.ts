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


import { parseGrammar, Parser, ParserOptions } from './Parser';

import { Grammar } from './Grammar';
import { Callbacks } from './Output';
import { ParseBuffer } from './ParseBuffer';

export interface DezentError extends Error {
    code: number
}

export interface GrammarError extends DezentError {
    pos: number,
    line?: number,
    char?: number,
    lineText?: string,
    pointerText?: string,
    reason: string,
}

export interface ParseError extends DezentError {
    pos: number,
    line: number,
    char: number,
    lineText: string,
    pointerText: string,
    reason: string,
    expected: string[]
}

export class Dezent {
    private grammar:Grammar;
    private options:ParserOptions;

    error:DezentError|GrammarError|ParseError;

    constructor(grammarStr:string, options?:ParserOptions) {
        this.grammar = parseGrammar(grammarStr, grammarOptions(options));
        this.options = options || {};
        this.error = null;
    }

    parse(text:string) : any {
        try {
            let stream = new DezentStream(this.grammar, this.options);
            stream.write(text);
            return stream.close();
        } catch (e) {
            this.error = e;
            if (this.options.debugErrors) {
                throw e;
            }
            return undefined;
        }
    }
}

export class DezentStream {
    private options:ParserOptions;
    private buffer:ParseBuffer;
    private parser:Parser;

    constructor(grammar:string|Grammar, options?:ParserOptions) {
        this.options = options || {};
        this.buffer = new ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? parseGrammar(grammar, grammarOptions(this.options)) : grammar;
        this.parser = new Parser(grammar, this.buffer, this.options);
    }

    write(text:string) {
        this.buffer.addChunk(text);
        this.parser.parse();
    }

    close() : any {
        this.buffer.close();
        return this.parser.parse();
    }
}

function grammarOptions(opt:ParserOptions) {
        // don't dumpDebug when parsing the grammar
        let gOpt = Object.assign({}, opt);
        gOpt.dumpDebug = false;
        return gOpt;
}

