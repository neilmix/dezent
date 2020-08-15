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

test("boolean / null outputs", () => {
    let out = parse("return .* -> true;", "anything");
    expect(out).toBe(true);

    out = parse("return .* -> false;", "anything");
    expect(out).toBe(false);

    out = parse("return .* -> null;", "anything");
    expect(out).toBe(null);
});

test("numeric outputs", () => {
    let out = parse("return .* -> 4;", "anything");
    expect(out).toBe(4);

    out = parse("return .* -> -4;", "anything");
    expect(out).toBe(-4);

    out = parse("return .* -> .543;", "anything");
    expect(out).toBe(.543);

    out = parse("return .* -> 0.543;", "anything");
    expect(out).toBe(.543);

    out = parse("return .* -> 5e+43;", "anything");
    expect(out).toBe(5e43);

    out = parse("return .* -> 5E+43;", "anything");
    expect(out).toBe(5e43);

    out = parse("return .* -> -5e-43;", "anything");
    expect(out).toBe(-5e-43);
});

test("object outputs", () => {
    let out = parse("return .* -> { foo: 1, baz: 2, bee: 3 };", "anything");
    expect(out).toEqual({ foo: 1, baz: 2, bee: 3 });

    out = parse("return .* -> [ 1, 2, 3 ];", "anything");
    expect(out).toEqual([ 1, 2, 3 ]);
});

test("the 'any' terminal", () => {
    let out = parse("return {.} -> $1;", "x");
    expect(out).toEqual('x');
});

test("strings", () => {
    let out = parse("return 'x' -> $0;", "x");
    expect(out).toEqual('x');
    out = parse("return '\\n' -> $0;", "\n");
    expect(out).toEqual('\n');
    out = parse("return 'foo\\n\\nbar' -> $0;", "foo\n\nbar");
    expect(out).toEqual('foo\n\nbar');
    out = parse("return '\\n\\r\\t\\b\\f\\\\\\a' -> $0;", "\n\r\t\b\f\\a");
    expect(out).toEqual("\n\r\t\b\f\\a");
});

test("character classes", () => {
    let out = parse("return {[x]} -> $1;", "x");
    expect(out).toEqual('x');
    out = parse("return {[a-z]} -> $1;", "x");
    expect(out).toEqual('x');
    out = parse("return {[0-9a-zA-Z]} -> $1;", "x");
    expect(out).toEqual('x');
    out = parse("return {[x0-9]} -> $1;", "x");
    expect(out).toEqual('x');
    out = parse("return {[qwertyx]} -> $1;", "x");
    expect(out).toEqual('x');
    out = parse("return [\\t] -> $0;", "\t");
    expect(out).toEqual('\t');
    out = parse("return [\\ua1b2] -> $0;", "\ua1b2");
    expect(out).toEqual('\ua1b2');
    out = parse("return [\\n\\r\\t\\f\\b\\ua2a2]* -> $0;", "\n\r\t\f\b\ua2a2");
    expect(out).toEqual("\n\r\t\f\b\ua2a2");
});

test("dezent grammar documentation", () => {
    let uncompiledDezent = createUncompiledDezentGrammar();
    let textDezent = readFileSync("./test/grammar.dezent").toString();
    let parsedDezent = parseText(findDezentGrammar(), textDezent, {debugErrors: true});
    expect(parsedDezent).toEqual(uncompiledDezent);
});
