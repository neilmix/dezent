"use strict";
exports.__esModule = true;
require("jest");
require("./Parser");
var Dezent_1 = require("./Dezent");
var Parser_1 = require("./Parser");
var Grammar_1 = require("./Grammar");
var fs_1 = require("fs");
function parse(grammar, text) {
    var d = new Dezent_1["default"](grammar, { debugErrors: true });
    return d.parse(text);
}
function expectParse(grammar, text) {
    return expect(parse(grammar, text || 'Did you forget the second argument?'));
}
function expectGrammarFail(grammar) {
    expect(function () {
        new Dezent_1["default"](grammar);
    }).toThrow();
}
function expectParseFail(grammar, text) {
    var d = new Dezent_1["default"](grammar);
    expect(d.parse(text || 'Did you forget the second argument?')).toBe(undefined);
}
test("boolean / null outputs", function () {
    expectParse("return .* -> true;").toBe(true);
    expectParse("return .* -> false;").toBe(false);
    expectParse("return .* -> null;").toBe(null);
});
test("numeric outputs", function () {
    expectParse("return .* -> 4;").toBe(4);
    expectParse("return .* -> -4;").toBe(-4);
    expectParse("return .* -> .543;").toBe(.543);
    expectParse("return .* -> 0.543;").toBe(.543);
    expectParse("return .* -> 5e+43;").toBe(5e43);
    expectParse("return .* -> 5E+43;").toBe(5e43);
    expectParse("return .* -> -5e-43;").toBe(-5e-43);
});
test("string outputs", function () {
    expectParse("return .* -> 'abcd';").toBe('abcd');
    expectParse("return .* -> '\\n\\r\\t\\b\\f\\\\\\a';").toBe('\n\r\t\b\f\\a');
    expectParse("return .* -> 'foo\u0061bar\u0062baz';").toBe('fooabarbbaz');
});
test("object outputs", function () {
    expectParse("return .* -> { foo: 1, baz: 2, bee: 3 };").toEqual({ foo: 1, baz: 2, bee: 3 });
    expectParse("return .* -> { '\\n\\t': 1 };").toEqual({ '\n\t': 1 });
    expectParse("return .* -> [ 1, 2, 3 ];").toEqual([1, 2, 3]);
    expectParse("return .* -> {foo: [{bar: {baz: [1, 2, 3 ]}}]};").toEqual({ foo: [{ bar: { baz: [1, 2, 3] } }] });
});
test("backref outputs", function () {
    expectParse("return {.} {.} -> [$1, $2];", 'ab').toEqual(['a', 'b']);
    expectParse("\n        return {foo} {bar} -> [$1, $2];\n        foo = {.}{.} -> { $1: $2 };\n        bar = {.}{.} -> { $1: $2 };\n    ", 'abcd').toEqual([{ a: 'b' }, { c: 'd' }]);
    expectParse("return ... -> $0;", 'aaa').toEqual('aaa');
});
test("splat", function () {
    expectParse("return {'a'}* {'b'}* -> [...$1, ...$2];", 'aaabbb').toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
    expectParse("return {[a-c]}* {[d-f]}* -> [...($1,$2)];", 'abcdef').toEqual(['a', 'd', 'b', 'e', 'c', 'f']);
    expectParse("return {[a-c]}* {[d-f]}* -> {...($1,$2)};", 'abcdef').toEqual({ a: 'd', b: 'e', c: 'f' });
    expectParse("\n        return {foo} -> [...$1];\n        foo = {.}{.}{.}{.}{.}{.} -> { $1: $4, $2: $5, $3: $6 };\n    ", 'abcdef').toEqual(['a', 'd', 'b', 'e', 'c', 'f']);
});
test("the 'any' terminal", function () {
    expectParse("return {.} -> $1;", "x").toEqual('x');
});
test("strings", function () {
    expectParse("return 'x' -> $0;", "x").toEqual('x');
    expectParse("return '\\n' -> $0;", "\n").toEqual('\n');
    expectParse("return 'foo\\n\\nbar' -> $0;", "foo\n\nbar").toEqual('foo\n\nbar');
    expectParse("return '\\n\\r\\t\\b\\f\\\\\\a' -> $0;", "\n\r\t\b\f\\a").toEqual("\n\r\t\b\f\\a");
});
test("character classes", function () {
    expectParse("return {[x]} -> $1;", "x").toEqual('x');
    expectParse("return {[a-z]} -> $1;", "x").toEqual('x');
    expectParse("return {[0-9a-zA-Z]} -> $1;", "x").toEqual('x');
    expectParse("return {[x0-9]} -> $1;", "x").toEqual('x');
    expectParse("return {[qwertyx]} -> $1;", "x").toEqual('x');
    expectParse("return [\\t] -> $0;", "\t").toEqual('\t');
    expectParse("return [\\ua1b2] -> $0;", "\ua1b2").toEqual('\ua1b2');
    expectParse("return [\\n\\r\\t\\f\\b\\ua2a2]* -> $0;", "\n\r\t\f\b\ua2a2").toEqual("\n\r\t\f\b\ua2a2");
});
test('whitespace', function () {
    expectParse("\n        return // single line comment\n            {.} /* multi\n                   line\n                   comment\n                */ {.} -> [$1, $2];\n    ", 'ab').toEqual(['a', 'b']);
});
test('identifiers', function () {
    expectParse("return .* -> { _foo: 1 };").toEqual({ _foo: 1 });
    expectGrammarFail("return .* -> { $foo: 1 }");
    expectGrammarFail('return .* -> null; foo$ = . -> null;');
});
test('capture and groups', function () {
    expectParse("return {.} {'x'}? {[b]}* {[a]}+ -> [$1, $2, $3, $4];", 'aaaa')
        .toEqual(['a', null, [], ['a', 'a', 'a']]);
    expectParse("return ('a'+ ({'b'})+ )+ -> $1;", 'abaabbabbbabb')
        .toEqual('b'.repeat(8).split(""));
    expectParse("return {(. .)+} -> $1;", 'aaaa').toEqual('aaaa');
    expectParseFail("return {(. .)+} -> 1;", 'aaaaa');
    expectGrammarFail("return {{.}} -> null;");
    expectGrammarFail("return {({.})} -> null;");
});
test('predicates', function () {
    expectParse("return !'a' .* -> $0;", 'bbb').toEqual('bbb');
    expectParseFail("return !'a' .* -> $0;", 'abbb');
    expectParse("return &'a' ... -> $0;", 'abb').toEqual('abb');
    expectParseFail("return &'a' ... -> $0;", 'baa');
});
test('input consumption', function () {
    expectParseFail("return .. -> $0;", 'a');
    expectParseFail("return . -> $0;", 'aa');
    expectParse("return .. -> $0;", 'aa').toEqual('aa');
});
test('test modifiers', function () {
    expectParse("return 'a' 'b'? 'a'? 'a'* 'b'+ -> $0;", 'aaaaabbb').toEqual('aaaaabbb');
    expectParse("return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;", 'accc').toEqual('accc');
    expectParseFail("return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;", 'ccc');
    expectParseFail("return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;", 'abaaa');
});
test("variables", function () {
    expectParse("$foo = 5; return .* -> $foo;").toEqual(5);
    expectParse("$foo = ['bar', {baz: true}]; return .* -> $foo;").toEqual(['bar', { baz: true }]);
    expectParse("$foo = $1; return {.*} -> $foo;", 'blah').toEqual('blah');
    expectGrammarFail("return .* -> $foo;");
});
test("dezent grammar documentation", function () {
    var uncompiledDezent = Grammar_1.createUncompiledDezentGrammar();
    var textDezent = fs_1.readFileSync("./test/grammar.dezent").toString();
    var parsedDezent = Parser_1.parseText(Parser_1.findDezentGrammar(), textDezent, { debugErrors: true });
    expect(parsedDezent).toEqual(uncompiledDezent);
});
test("expected grammar terminals", function () {
    try {
        Parser_1.parseGrammar('return . -> {}');
    }
    catch (e) {
        expect(e.expected.sort()).toEqual([';']);
    }
    try {
        Parser_1.parseGrammar('return {.}');
    }
    catch (e) {
        expect(e.expected.sort()).toEqual(["'", "(", "->", ".", "[", "_ a-z A-Z", "{", "|"]);
    }
    try {
        Parser_1.parseGrammar("return ( . ([ab] {'f'} 'foo)) -> $1;");
    }
    catch (e) {
        expect(e.expected.sort()).toEqual(["'", "\\"]);
    }
});
