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

test("dezent grammar documentation", () => {
    let docGrammar = readFileSync("./test/grammar.dezent").toString();
    let parsedGrammar = parseGrammar(docGrammar, {debugErrors: true});
    expect(parsedGrammar).toEqual(dezentGrammar);
});