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

import { Interpreter } from "./Interpreter";
import { OpcodeCompiler } from "./OpcodeCompiler";
import { ParseBuffer } from "./ParseBuffer";
import { parseGrammar } from "./Parser";

function parse(grammarText, text) {
    let grammar = parseGrammar(grammarText);
    let op = new OpcodeCompiler().compileGrammar(grammar);
    return new Interpreter(op).execute(new ParseBuffer(text));
}
 
 test("basic execution", () => {
     expect(parse("return . -> null;", "a")).toBe(null);
     try {
        expect(parse("return . -> null;", "aa")).toBe(null);
        fail();
     } catch(e) {}
     expect(parse("return . . . . -> $0;", "abcd")).toBe("abcd");
 });

 test("string tokens", () => {
    expect(parse("return 'foo' 'bar' -> $0;", "foobar")).toBe("foobar");
    try {
        expect(parse("return 'foo' 'bar' -> $0;", "foobarz")).toBe("foobar");
        fail();
    } catch(e) {}
 });

 test("repeat", () => {
    expect(parse("return .* -> $0;", "abcd")).toBe("abcd");
    expect(parse("return ('a' 'b' 'c')* -> $0;", "abcabcabc")).toBe("abcabcabc");
 });