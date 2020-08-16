import "jest";

import "./Parser";
import { Dezent } from "./Dezent";
import { parseText, findDezentGrammar, parseGrammar } from "./Parser";
import { createUncompiledDezentGrammar } from "./Grammar";
import { readFileSync } from "fs";

function parse(grammar:string, text:string) {
    let d = new Dezent(grammar, {debugErrors: true});
    return d.parse(text);
}

function expectParse(grammar:string, text?:string) {
    return expect(parse(grammar, text||'anything - or did you forget the second argument?'));
}

test("boolean / null outputs", () => {
    expectParse("return .* -> true;").toBe(true);
    expectParse("return .* -> false;").toBe(false);
    expectParse("return .* -> null;").toBe(null);
});

test("numeric outputs", () => {
    expectParse("return .* -> 4;").toBe(4);
    expectParse("return .* -> -4;").toBe(-4);
    expectParse("return .* -> .543;").toBe(.543);
    expectParse("return .* -> 0.543;").toBe(.543);
    expectParse("return .* -> 5e+43;").toBe(5e43);
    expectParse("return .* -> 5E+43;").toBe(5e43);
    expectParse("return .* -> -5e-43;").toBe(-5e-43);
});

test("string outputs", () => {
    expectParse("return .* -> 'abcd';").toBe('abcd');
    expectParse("return .* -> '\\n\\r\\t\\b\\f\\\\\\a';").toBe('\n\r\t\b\f\\a');
    expectParse("return .* -> 'foo\u0061bar\u0062baz';").toBe('fooabarbbaz');
});

test("object outputs", () => {
    expectParse("return .* -> { foo: 1, baz: 2, bee: 3 };").toEqual({ foo: 1, baz: 2, bee: 3 });
    expectParse("return .* -> { '\\n\\t': 1 };").toEqual({ '\n\t': 1 });
    expectParse("return .* -> [ 1, 2, 3 ];").toEqual([ 1, 2, 3 ]);
    expectParse("return .* -> {foo: [{bar: {baz: [1, 2, 3 ]}}]};").toEqual({foo: [{ bar: {baz: [1, 2, 3 ]}}]});
});

test("backref outputs", () => {
    expectParse("return {.} {.} -> [$1, $2];", 'ab').toEqual(['a', 'b']);
    expectParse(`
        return {foo} {bar} -> [$1, $2];
        foo = {.}{.} -> { $1: $2 };
        bar = {.}{.} -> { $1: $2 };
    `, 'abcd').toEqual([{a: 'b'}, {c: 'd'}]);
});

test("splat", () => {
    expectParse(`return {'a'}* {'b'}* -> [...$1, ...$2];`, 'aaabbb').toEqual(['a','a','a','b','b','b']);
    expectParse(`return {[a-c]}* {[d-f]}* -> [...($1,$2)];`, 'abcdef').toEqual(['a', 'd', 'b', 'e', 'c', 'f']);
    expectParse(`return {[a-c]}* {[d-f]}* -> {...($1,$2)};`, 'abcdef').toEqual({a:'d', b:'e', c:'f'});
    expectParse(`
        return {foo} -> [...$1];
        foo = {.}{.}{.}{.}{.}{.} -> { $1: $4, $2: $5, $3: $6 };
    `,'abcdef').toEqual(['a','d','b','e','c','f']);
});

test("the 'any' terminal", () => {
    expectParse("return {.} -> $1;", "x").toEqual('x');
});

test("strings", () => {
    expectParse("return 'x' -> $0;", "x").toEqual('x');
    expectParse("return '\\n' -> $0;", "\n").toEqual('\n');
    expectParse("return 'foo\\n\\nbar' -> $0;", "foo\n\nbar").toEqual('foo\n\nbar');
    expectParse("return '\\n\\r\\t\\b\\f\\\\\\a' -> $0;", "\n\r\t\b\f\\a").toEqual("\n\r\t\b\f\\a");
});

test("character classes", () => {
    expectParse("return {[x]} -> $1;", "x").toEqual('x');
    expectParse("return {[a-z]} -> $1;", "x").toEqual('x');
    expectParse("return {[0-9a-zA-Z]} -> $1;", "x").toEqual('x');
    expectParse("return {[x0-9]} -> $1;", "x").toEqual('x');
    expectParse("return {[qwertyx]} -> $1;", "x").toEqual('x');
    expectParse("return [\\t] -> $0;", "\t").toEqual('\t');
    expectParse("return [\\ua1b2] -> $0;", "\ua1b2").toEqual('\ua1b2');
    expectParse("return [\\n\\r\\t\\f\\b\\ua2a2]* -> $0;", "\n\r\t\f\b\ua2a2").toEqual("\n\r\t\f\b\ua2a2");
});

test("dezent grammar documentation", () => {
    let uncompiledDezent = createUncompiledDezentGrammar();
    let textDezent = readFileSync("./test/grammar.dezent").toString();
    let parsedDezent = parseText(findDezentGrammar(), textDezent, {debugErrors: true});
    expect(parsedDezent).toEqual(uncompiledDezent);
});
