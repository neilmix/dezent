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

afterEach(() => Interpreter.debug = false);

function parse(grammarText, text) {
    let grammar = parseGrammar(grammarText);
    let op = new OpcodeCompiler(grammar).compile();
    return new Interpreter(op).execute(new ParseBuffer(text));
}
 
function expectException(grammarText, text) {
    try {
        expect(parse(grammarText, text)).toBe(text);
        fail();
    } catch(e) {}
}

test("basic execution", () => {
    expect(parse("return . -> null;", "a")).toBe(null);
    expectException("return . -> null;", "aa");
    expect(parse("return . . . . -> $0;", "abcd")).toBe("abcd");
 });

test("array output", () => {
    expect(parse("return . -> [$0, $0];", "a")).toEqual(["a", "a"]);
    expect(parse("return {.} {.} -> [$2, $1];", "ab")).toEqual(["b", "a"]);
});

test("string tokens", () => {
    expect(parse("return 'foo' 'bar' -> $0;", "foobar")).toBe("foobar");
    expectException("return 'foo' 'bar' -> $0;", "foobarz");
 });

 test("repeat", () => {
    expect(parse("return .* -> $0;", "abcd")).toBe("abcd");
    expect(parse("return ('a' 'b' 'c')* -> $0;", "abcabcabc")).toBe("abcabcabc");
    expect(parse("return .+ -> $0;", "abcd")).toBe("abcd");
    expect(parse("return ('a' 'b' 'c')+ -> $0;", "abcabcabc")).toBe("abcabcabc");
    expectException("return .+ -> $0;", "");
    expectException("return ('a' 'b' 'c')+ -> $0;", "ab");
});

test("optional tokens", () => {
    expect(parse("return 'a' 'b'? 'c'? 'd' -> $0;", "abd")).toBe("abd");
});

test("rulesets", () => {
    expect(parse("return rule -> $0; rule = 'a' 'b' 'c' -> null;", "abc")).toBe("abc");
    expect(parse("return rule -> $0; rule = 'a' rule? -> null;", "aaa")).toBe("aaa");
});