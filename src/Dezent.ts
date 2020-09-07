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

export default class Dezent {
    debugErrors: boolean;
    options:parser.ParserOptions;
    error:DezentError|GrammarError|ParseError;

    private grammar:Grammar;

    constructor(grammarStr:string, options?:parser.ParserOptions) {
        this.options = options || {};
        this.debugErrors = !!this.options.debugErrors;
        this.error = null;
        this.grammar = parser.parseGrammar(grammarStr, this.options);
    }

    parse(text:string) {
        try {
            return parser.parseText(this.grammar, text, this.options);
        } catch (e) {
            this.error = e;
            if (this.debugErrors) {
                throw e;
            }
            return undefined;
        }
    }
}