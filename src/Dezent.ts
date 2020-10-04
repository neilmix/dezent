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

import * as parser from './Parser';

import { Grammar } from './Grammar';
import { Functions } from './Output';

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
    private stream:DezentStream;
    private debugErrors: boolean;

    error:DezentError|GrammarError|ParseError;

    constructor(grammarStr:string, functions?:Functions, options?:parser.ParserOptions) {
        this.stream = new DezentStream(grammarStr, functions, options);
        this.debugErrors = options ? !!options.debugErrors : false;
        this.error = null;
    }

    parse(text:string) : any {
        try {
            this.stream.write(text);
            return this.stream.close();
        } catch (e) {
            this.error = e;
            if (this.debugErrors) {
                throw e;
            }
            return undefined;
        }
    }
}

export class DezentStream {
    private functions:Functions;
    private options:parser.ParserOptions;
    private grammar:Grammar;
    private result:any;

    constructor(grammarStr:string, functions?:Functions, options?:parser.ParserOptions) {
        this.options = options || {};
        this.grammar = parser.parseGrammar(grammarStr, this.options, functions);
        this.functions = functions;
    }

    write(text:string) {
        this.result = parser.parseText(this.grammar, text, this.functions, this.options);
    }

    close() : any {
        return this.result;
    }
}