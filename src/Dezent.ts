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


import { parsingError, ErrorCode } from './Error';
import { Grammar } from './Grammar';
import { GrammarCompiler, findDezentGrammar } from './GrammarCompiler';
import { ParseBuffer } from './ParseBuffer';
import { OpcodeCompiler, Operation } from './OpcodeCompiler';
import { Interpreter } from './Interpreter';

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

export type Callbacks = {
    [key:string]: Function
}

export interface DezentOptions {
    minBufferSizeInMB?: number,
    callbacks?: Callbacks,
    debugErrors?: boolean,
    enableProfiling?: boolean,
}

export class Dezent {
    private grammar:Grammar;
    private options:DezentOptions;

    error:DezentError|GrammarError|ParseError;

    constructor(grammarStr:string, options?:DezentOptions) {
        this.options = fillOptions(options);
        this.grammar = parseGrammar(grammarStr, this.options);
        this.error = null;
    }

    parse(text:string, callbacks?:Callbacks) : any {
        try {
            let stream = new DezentStream(this.grammar, { ...this.options, callbacks: callbacks || this.options.callbacks });
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
    private opcode:Operation;
    private interpreter:Interpreter;
    private options:DezentOptions;
    private buffer:ParseBuffer;

    constructor(grammar:string|Grammar, options?:DezentOptions) {
        this.options = fillOptions(options);
        this.buffer = new ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? parseGrammar(grammar, this.options) : grammar;
        this.opcode = new OpcodeCompiler(grammar, this.options.enableProfiling).compile(this.options.callbacks);
        this.interpreter = new Interpreter(this.opcode, this.buffer);
    }

    write(text:string) {
        this.buffer.addChunk(text);
        this.interpreter.resume();
    }

    close() : any {
        this.buffer.close();
        return this.interpreter.resume();
    }
}

function fillOptions(options?:DezentOptions):DezentOptions {
    options = options || {};
    return {
        minBufferSizeInMB: options.minBufferSizeInMB || 1,
        callbacks: options.callbacks || {},
        enableProfiling: options.enableProfiling || false,
    };
}



let dezentOpcode:Operation;

export function parseGrammar(text:string, options:DezentOptions) : Grammar {
    if (!dezentOpcode) {
        dezentOpcode = new OpcodeCompiler(findDezentGrammar(), false).compile();
    }
    let buf = new ParseBuffer(text);
    let interpreter = new Interpreter(dezentOpcode, new ParseBuffer(text));
    try {
        let grammar = interpreter.resume();    
        GrammarCompiler.compileGrammar(grammar, text);
        return grammar;
    } catch(e) {
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        } else {
            throw e;
        }
    }
}