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

    error:DezentError|GrammarError|ParseError;

    private grammar:Grammar;

    constructor(grammarStr:string, options?:parser.ParserOptions) {
        options = options || {};
        this.debugErrors = !!options.debugErrors;
        this.error = null;
        this.grammar = parser.parseGrammar(grammarStr);
    }

    parse(text:string) {
        try {
            return parser.parseText(this.grammar, text);
        } catch (e) {
            this.error = e;
            if (this.debugErrors) {
                throw e;
            }
            return undefined;
        }
    }
}