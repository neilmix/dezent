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
function parseError(grammar, text) {
    try {
        Parser_1.parseText(grammar, text);
        fail();
    }
    catch (e) {
        return e;
    }
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
function parseGrammarError(grammar) {
    try {
        Parser_1.parseGrammar(grammar);
        fail();
    }
    catch (e) {
        return e;
    }
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
    // trailing commas
    expectParse("return .* -> [1,2,];").toEqual([1, 2]);
    expectParse("return .* -> { a: 1, b: 2, };").toEqual({ a: 1, b: 2 });
});
test("backref outputs", function () {
    expectParse("return {.} {.} -> [$1, $2];", 'ab').toEqual(['a', 'b']);
    expectParse("\n        return {foo} {bar} -> [$1, $2];\n        foo = {.}{.} -> { $1: $2 };\n        bar = {.}{.} -> { $1: $2 };\n    ", 'abcd').toEqual([{ a: 'b' }, { c: 'd' }]);
    expectParse("return ... -> $0;", 'aaa').toEqual('aaa');
});
test("spread", function () {
    expectParse("return .* -> [ ...[1,2,3], ...[4,5,6]];").toEqual([1, 2, 3, 4, 5, 6]);
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
    expectParse("$foo = { foo: 'a', bar: 'b' }; return .* -> { baz: 'c', ...$foo, bee: [...$foo] };")
        .toEqual({ baz: 'c', foo: 'a', bar: 'b', bee: ['foo', 'a', 'bar', 'b'] });
    expectParse("$a = ['foo', 'bar']; $b = ['a', 'b']; return .* -> { baz: 'c', ...($a, $b) };")
        .toEqual({ baz: 'c', foo: 'a', bar: 'b' });
    expectGrammarFail("return .* -> $foo;");
});
test("metas", function () {
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> { pos: @position, length: @length };\n    ", '123456').toEqual({ pos: 1, length: 3 });
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> $meta;\n        $meta = { pos: @position, length: @length };\n    ", '123456').toEqual({ pos: 1, length: 3 });
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> { foo: 'bar', ...$meta };\n        $meta = { pos: @position, length: @length };\n    ", '123456').toEqual({ foo: 'bar', pos: 1, length: 3 });
});
test("dezent grammar documentation", function () {
    var uncompiledDezent = Grammar_1.createUncompiledDezentGrammar();
    var textDezent = fs_1.readFileSync("./test/grammar.dezent").toString();
    var hackedGrammar = Parser_1.findDezentGrammar();
    // Our bootstrap grammar does not contain any metas because it's created
    // somewhat manually, not parsed from source. But it does contain rules
    // that do insert metas into our documented grammar. To mitigate this,
    // we need to monkey-patch our bootstrap grammar so that it won't
    // insert metas into the grammar we parse from file.
    var prevMeta = hackedGrammar.vars.meta;
    hackedGrammar.vars.meta = { type: 'object', members: [] };
    var parsedDezent = Parser_1.parseText(hackedGrammar, textDezent, { debugErrors: true });
    hackedGrammar.vars.meta = prevMeta;
    expect(parsedDezent).toEqual(uncompiledDezent);
});
test("expected grammar terminals", function () {
    expect(parseGrammarError('return . -> {}').expected.sort()).toEqual([';']);
    expect(parseGrammarError('return {.}').expected.sort()).toEqual(["'", "(", "->", ".", "[", "_ a-z A-Z", "{", "|"]);
    expect(parseGrammarError("return ( . ([ab] {'f'} 'foo)) -> $1;").expected.sort()).toEqual(["'", "\\"]);
});
test("grammar errors", function () {
    expect(parseGrammarError("return foo -> null; foo = . -> null; foo = .. -> 1;").char).toEqual(38);
    expect(parseGrammarError("return . -> 1; return . -> 2;").char).toEqual(16);
    expect(parseGrammarError("return foo -> true;").char).toEqual(8);
    expect(parseError("foo = . -> $0; return {foo} -> [...$1];", 'a').char).toEqual(33);
    expect(parseError("return {'a'}* {'b'}* -> [...($1,$2)];", 'abb').char).toEqual(26);
    expect(parseError("foo = . -> true;", 'a').code).toEqual(1006);
    expect(parseGrammarError("return {.} | {.} {.} -> true;").char).toEqual(8);
    expect(parseGrammarError("return {.} -> $2;").char).toEqual(15);
    expect(parseGrammarError("return . -> $foo;").char).toEqual(13);
});
