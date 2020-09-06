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
test("pivot", function () {
    expectParse("return .* -> ^[[1,2,3],[4,5,6]];").toEqual([[1, 4], [2, 5], [3, 6]]);
    expectParse("return .* -> ^^[[1,2,3],[4,5,6]];").toEqual([[1, 2, 3], [4, 5, 6]]);
    expectParseFail("return .* -> ^[1,2,3];");
    expectParseFail("return .* -> ^[[1,2],[1,2,3]];");
});
test("spread", function () {
    expectParse("return .* -> [ 'a', ...[1,2,3], ...[4,5,6], 'b'];").toEqual(['a', 1, 2, 3, 4, 5, 6, 'b']);
    expectParse("return .* -> [ 'x', ...{a: 1, b:2}, 'y' ];").toEqual(['x', ['a', 1], ['b', 2], 'y']);
    expectParse("return .* -> { a: 1, ...[['b',2], ['c',3]], d: 4 };").toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expectParse("return .* -> { a: 1, ...{b: 2, c: 3 }, d: 4 };").toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expectParse("return .* -> [ ...'foo' ];").toEqual(['f', 'o', 'o']);
    expectParse("return {'a'}* {'b'}* -> [...$1, ...$2];", 'aaabbb').toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
    expectParse("\n        return {foo} -> [...$1];\n        foo = {.}{.}{.}{.}{.}{.} -> { $1: $4, $2: $5, $3: $6 };\n    ", 'abcdef').toEqual([['a', 'd'], ['b', 'e'], ['c', 'f']]);
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
    expectParse("foo = {.} -> { foo: $1 }; return { foo . } -> $1;", 'ab').toEqual('ab');
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
        .toEqual({ baz: 'c', foo: 'a', bar: 'b', bee: [['foo', 'a'], ['bar', 'b']] });
    expectGrammarFail("return .* -> $foo;");
});
test("metas", function () {
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> { pos: @position, length: @length };\n    ", '123456').toEqual({ pos: 1, length: 3 });
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> $meta;\n        $meta = { pos: @position, length: @length };\n    ", '123456').toEqual({ pos: 1, length: 3 });
    expectParse("\n        return .{rule}.. -> $1;\n        rule = ... -> { foo: 'bar', ...$meta };\n        $meta = { pos: @position, length: @length };\n    ", '123456').toEqual({ foo: 'bar', pos: 1, length: 3 });
});
test("access", function () {
    expectParse("return .* -> {a:1}.a;").toEqual(1);
    expectParse("return .* -> {a:1}['a'];").toEqual(1);
    expectParse("return .* -> [1][0];").toEqual(1);
    expectParse("return .* -> [1]['0'];").toEqual(1);
    expectParse("$foo = {a:1}; return .* -> $foo.a;").toEqual(1);
    expectParse("$foo = {a:1}; return .* -> $foo['a'];").toEqual(1);
    expectParse("$foo = 'foo'; return .* -> $foo[0];").toEqual('f');
    expectParse("foo = .* -> {a: 1}; return {foo} -> $1.a;").toEqual(1);
    expectParse("foo = .* -> {a: 1}; return {foo} -> $1['a'];").toEqual(1);
    expectParse("$foo = {a:[{b:2}]}; return .* -> $foo.a[0].b;").toEqual(2);
});
test("left recursion", function () {
    var grammar = "\n        expr =\n            {expr} '+' {mult} -> ['+',$1,$2],\n            {mult} -> $1;\n        mult =\n            {mult} '*' {num} -> ['*',$1,$2],\n            num -> $0;\n        num = [0-9]+ -> $0;\n        return {expr} -> $1;\n    ";
    expectParse(grammar, '5').toEqual('5');
    expectParse(grammar, '5+4').toEqual(['+', '5', '4']);
    expectParse(grammar, '5+4+3').toEqual(['+', ['+', '5', '4'], '3']);
    expectParse(grammar, '5+4+3+2').toEqual(['+', ['+', ['+', '5', '4'], '3'], '2']);
    expectParse(grammar, '5*4+3*2').toEqual(['+', ['*', '5', '4'], ['*', '3', '2']]);
    expectParse(grammar, '5*4*3+2').toEqual(['+', ['*', ['*', '5', '4'], '3'], '2']);
    grammar = "\n        rule1 = rule2 -> $0;\n        rule2 = rule1 'b' -> $0, 'a' -> $0;\n        return rule1 -> $0;\n    ";
    expectParse(grammar, 'ab').toEqual('ab');
    grammar = "\n        rule1 = rule2 -> $0, 'a' -> $0;\n        rule2 = rule1 'b' -> $0;\n        return rule1 -> $0;\n    ";
    expectParse(grammar, 'ab').toEqual('ab');
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
    /* 1001 */ expect(parseGrammarError("return foo -> null; foo = . -> null; foo = .. -> 1;").char).toEqual(38);
    /* 1002 */ expect(parseGrammarError("return . -> 1; return . -> 2;").char).toEqual(16);
    /* 1003 */ expect(parseGrammarError("return foo -> true;").char).toEqual(8);
    /* 1004 */ expect(parseError("foo = . -> 1; return {foo} -> [...$1];", 'a').char).toEqual(32);
    /* 1005 */ expect(parseError("foo = . -> true;", 'a').code).toEqual(1005);
    /* 1006 */ expect(parseGrammarError("return {.} | {.} {.} -> true;").char).toEqual(8);
    /* 1007 */ expect(parseGrammarError("return {.} -> $2;").char).toEqual(15);
    /* 1008 */ expect(parseGrammarError("return . -> $foo;").char).toEqual(13);
    /* 1009 */ expect(parseError("$foo = 'foo'; return . -> ^$foo;", 'a').char).toEqual(27);
    /* 1010 */ expect(parseError("return . -> ^[[1,2],[1,2,3]];", 'a').char).toEqual(13);
    /* 1011 */ expect(parseError("return . -> { ...[1] };", 'a').char).toEqual(15);
    /* 1012 */ expect(parseError("$foo = 234; return .* -> $foo[1];", 'a').char).toEqual(30);
    /* 1013 */ expect(parseError("$foo = {}; return .* -> [1][$foo];", 'a').char).toEqual(28);
    /* 1013 */ expect(parseError("return .* -> {}.foo;", 'a').char).toEqual(16);
});
test("comments", function () {
    expectParse("\n        // return .* -> 1;\n        /*\n           return .* -> 2;\n        */\n        return .* -> 3;\n    ").toEqual(3);
});
test("packrat", function () {
    function buildText(count) {
        var text = 'a'.repeat(count) + 'b';
    }
    var grammar = "\n        return {theRule}* -> $1;\n        theRule =\n            {'a'}* {'c'} -> [$1, $2],\n            {'b'} -> $1,\n            {'a'} -> $1;\n    ";
    var caching = new Dezent_1["default"](grammar, { disableCacheLookup: false });
    var noncaching = new Dezent_1["default"](grammar, { disableCacheLookup: true });
    expect(caching.parse('aaaab')).toEqual(['a', 'a', 'a', 'a', 'b']);
    expect(noncaching.parse('aaaab')).toEqual(['a', 'a', 'a', 'a', 'b']);
    function time(f) {
        var t = new Date().getTime();
        f();
        return new Date().getTime() - t;
    }
    var log = [['packrat cache performance results']];
    function run(size, runUncached) {
        var text = 'a'.repeat(size) + 'b';
        log.push(["size: ", size]);
        if (runUncached) {
            log.push(["  uncached:", time(function () { return noncaching.parse(text); })]);
        }
        log.push(["  cached:  ", time(function () { return caching.parse(text); })]);
    }
    run(100, true);
    run(1000, true);
    run(2000, true);
    run(4000, false);
    run(8000, false);
    console.log(log.map(function (i) { return i.join(' '); }).join('\n'));
});
