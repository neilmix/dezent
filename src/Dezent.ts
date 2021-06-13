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
        if (this.parser.error) {
            throw this.parser.error;
        }
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

