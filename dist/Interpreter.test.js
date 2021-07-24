"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const Interpreter_1 = require("./Interpreter");
const OpcodeCompiler_1 = require("./OpcodeCompiler");
const ParseBuffer_1 = require("./ParseBuffer");
const Dezent_1 = require("./Dezent");
afterEach(() => Interpreter_1.Interpreter.debug = false);
function parse(grammarText, text) {
    let grammar = Dezent_1.parseGrammar(grammarText, {});
    let op = new OpcodeCompiler_1.OpcodeCompiler(grammar, false).compile();
    return new Interpreter_1.Interpreter(op, new ParseBuffer_1.ParseBuffer(text)).resume();
}
function expectParse(grammar, text) {
    return expect(parse(grammar, text));
}
function expectException(grammarText, text) {
    try {
        expect(parse(grammarText, text)).toBe(text);
        fail();
    }
    catch (e) { }
}
test("basic execution", () => {
    expectParse("return . -> null;", "a").toBe(null);
    expectException("return . -> null;", "aa");
    expectParse("return . . . . -> $0;", "abcd").toBe("abcd");
    expectException(" return 'a'* -> null;", "bb");
});
test("array output", () => {
    expectParse("return . -> [$0, $0];", "a").toEqual(["a", "a"]);
    expectParse("return {.} {.} -> [$2, $1];", "ab").toEqual(["b", "a"]);
});
test("string tokens", () => {
    expectParse("return 'foo' 'bar' -> $0;", "foobar").toBe("foobar");
    expectException("return 'foo' 'bar' -> $0;", "foobarz");
});
test("repeat", () => {
    expectParse("return .* -> $0;", "abcd").toBe("abcd");
    expectParse("return ('a' 'b' 'c')* -> $0;", "abcabcabc").toBe("abcabcabc");
    expectParse("return .+ -> $0;", "abcd").toBe("abcd");
    expectParse("return ('a' 'b' 'c')+ -> $0;", "abcabcabc").toBe("abcabcabc");
    expectException("return .+ -> $0;", "");
    expectException("return ('a' 'b' 'c')+ -> $0;", "ab");
});
test("optional tokens", () => {
    expectParse("return 'a' 'b'? 'c'? 'd' -> $0;", "abd").toBe("abd");
});
test("non-consuming tokens", () => {
    expectParse("return 'a' &'b' 'b' 'c' -> $0;", "abc").toBe("abc");
    expectParse("return 'a' !'c' 'b' 'c' -> $0;", "abc").toBe("abc");
});
test("rulesets", () => {
    expectParse("return rule -> $0; rule = 'a' 'b' 'c' -> null;", "abc").toBe("abc");
    expectParse("return rule -> $0; rule = 'a' rule? -> null;", "aaa").toBe("aaa");
});
test("multiple patterns", () => {
    expectParse("return ('a' | 'b' | 'c') 'x' -> $0;", "ax").toBe("ax");
    expectParse("return ('a' | 'b' | 'c') 'x' -> $0;", "bx").toBe("bx");
    expectParse("return ('a' | 'b' | 'c') 'x' -> $0;", "cx").toBe("cx");
    expectException("return ('a' | 'b' | 'c') 'x' -> $0;", "dx");
});
test("multiple rules", () => {
    expectParse("return rule -> $0; rule = 'a' -> null, 'b' -> null, 'c' -> null;", "a").toBe("a");
    expectParse("return rule -> $0; rule = 'a' -> null, 'b' -> null, 'c' -> null;", "b").toBe("b");
    expectParse("return rule -> $0; rule = 'a' -> null, 'b' -> null, 'c' -> null;", "c").toBe("c");
    expectException("return rule -> $0; rule = 'a' -> null, 'b' -> null, 'c' -> null;", "d");
});
test("character classes", () => {
    expectParse("return {[x]} -> $1;", "x").toBe('x');
    expectParse("return {[a-z]} -> $1;", "x").toBe('x');
    expectParse("return {[0-9a-zA-Z]} -> $1;", "x").toBe('x');
    expectParse("return {[x0-9]} -> $1;", "x").toBe('x');
    expectParse("return {[qwertyx]} -> $1;", "x").toBe('x');
    expectParse("return [\\t] -> $0;", "\t").toBe('\t');
    expectParse("return [\\ua1b2] -> $0;", "\ua1b2").toBe('\ua1b2');
    expect(parse("return [\\n\\r\\t\\f\\b\\ua2a2]* -> $0;", "\n\r\t\f\b\ua2a2")).toBe("\n\r\t\f\b\ua2a2");
});
test("capture", () => {
    expectParse("return ( {'a'} ',' )* {'a'}? -> [$1, $2?];", "a").toEqual([[], "a"]);
});
