import "jest";

import "./Parser";
import { parseText, parseGrammar, parseTextWithGrammar } from "./Parser";
import { dezentGrammar } from "./Grammar";
import { readFileSync } from "fs";
import * as path from "path";

test("boolean / null outputs", () => {
    let out = parseText("return /.*/ -> true;", "anything", {debugErrors:true});
    expect(out).toBe(true);

    out = parseText("return /.*/ -> false;", "anything", {debugErrors:true});
    expect(out).toBe(false);

    out = parseText("return /.*/ -> null;", "anything", {debugErrors:true});
    expect(out).toBe(null);
});

test("numeric outputs", () => {
    let out = parseText("return /.*/ -> 4;", "anything", {debugErrors:true});
    expect(out).toBe(4);

    out = parseText("return /.*/ -> -4;", "anything", {debugErrors:true});
    expect(out).toBe(-4);

    out = parseText("return /.*/ -> .543;", "anything", {debugErrors:true});
    expect(out).toBe(.543);

    out = parseText("return /.*/ -> 0.543;", "anything", {debugErrors:true});
    expect(out).toBe(.543);

    out = parseText("return /.*/ -> 5e+43;", "anything", {debugErrors:true});
    expect(out).toBe(5e43);

    out = parseText("return /.*/ -> 5E+43;", "anything", {debugErrors:true});
    expect(out).toBe(5e43);

    out = parseText("return /.*/ -> -5e-43;", "anything", {debugErrors:true});
    expect(out).toBe(-5e-43);
});

test("object outputs", () => {
    let out = parseText("return /.*/ -> { foo: 1, baz: 2, bee: 3 };", "anything", {debugErrors:true});
    expect(out).toEqual({ foo: 1, baz: 2, bee: 3 });

    out = parseText("return /.*/ -> [ 1, 2, 3 ];", "anything", {debugErrors:true});
    expect(out).toEqual([ 1, 2, 3 ]);
});

test("the 'any' terminal", () => {
    let out = parseText("return {.} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
});

test("strings", () => {
    let out = parseText("return 'x' -> $0;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return '\\n' -> $0;", "\n", {debugErrors:true});
    expect(out).toEqual('\n');
    out = parseText("return 'foo\\n\\nbar' -> $0;", "foo\n\nbar", {debugErrors:true});
    expect(out).toEqual('foo\n\nbar');
    out = parseText("return '\\n\\r\\t\\b\\f\\\\\\a' -> $0;", "\n\r\t\b\f\\a", {debugErrors:true});
    expect(out).toEqual("\n\r\t\b\f\\a");
});

test("character classes", () => {
    let out = parseText("return {[x]} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return {[a-z]} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return {[0-9a-zA-Z]} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return {[x0-9]} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return {[qwertyx]} -> $1;", "x", {debugErrors:true});
    expect(out).toEqual('x');
    out = parseText("return [\\t] -> $0;", "\t", {debugErrors:true});
    expect(out).toEqual('\t');
    out = parseText("return [\\ua1b2] -> $0;", "\ua1b2", {debugErrors:true});
    expect(out).toEqual('\ua1b2');
    out = parseText("return [\\n\\r\\t\\f\\b\\ua2a2]* -> $0;", "\n\r\t\f\b\ua2a2", {debugErrors:true});
    expect(out).toEqual("\n\r\t\f\b\ua2a2");
});

/*
test("dezent grammar documentation", () => {
    let docGrammar = readFileSync("./test/grammar.dezent").toString();
    let parsedGrammar = parseGrammar(docGrammar, {debugErrors: true});
    expect(parsedGrammar).toEqual(dezentGrammar);
});
*/