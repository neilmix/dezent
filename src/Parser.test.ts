import "jest";

import "./Parser";
import Dezent from "./Dezent";
import { parseText, findDezentGrammar, parseGrammar } from "./Parser";
import { createUncompiledDezentGrammar } from "./Grammar";
import { readFileSync } from "fs";

function parse(grammar:string, text:string) {
    let d = new Dezent(grammar, {debugErrors: true});
    return d.parse(text);
}

function parseError(grammar:string, text:string) {
    try {
        parseText(grammar, text);
        fail();
    } catch(e) {
        return e;
    }
}

function expectParse(grammar:string, text?:string) {
    return expect(parse(grammar, text||'Did you forget the second argument?'));
}

function expectGrammarFail(grammar:string) {
    expect(() => {
        new Dezent(grammar);
    }).toThrow();
}

function expectParseFail(grammar:string, text?:string) {
    let d = new Dezent(grammar);
    expect(d.parse(text||'Did you forget the second argument?')).toBe(undefined);
}

function parseGrammarError(grammar:string) {
    try {
        parseGrammar(grammar);
        fail();
    } catch(e) {
        return e;
    }
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

    // trailing commas
    expectParse("return .* -> [1,2,];").toEqual([1,2]);
    expectParse("return .* -> { a: 1, b: 2, };").toEqual({ a: 1, b: 2 });
});

test("backref outputs", () => {
    expectParse("return {.} {.} -> [$1, $2];", 'ab').toEqual(['a', 'b']);
    expectParse(`
        return {foo} {bar} -> [$1, $2];
        foo = {.}{.} -> { $1: $2 };
        bar = {.}{.} -> { $1: $2 };
    `, 'abcd').toEqual([{a: 'b'}, {c: 'd'}]);
    expectParse(`return ... -> $0;`, 'aaa').toEqual('aaa');
});

test("pivot", () => {
    expectParse(`return .* -> ^[[1,2,3],[4,5,6]];`).toEqual([[1,4],[2,5],[3,6]]);
    expectParse(`return .* -> ^^[[1,2,3],[4,5,6]];`).toEqual([[1,2,3],[4,5,6]]);
    expectParseFail(`return .* -> ^[1,2,3];`);
    expectParseFail(`return .* -> ^[[1,2],[1,2,3]];`);
});

test("spread", () => {
    expectParse(`return .* -> [ 'a', ...[1,2,3], ...[4,5,6], 'b'];`).toEqual(['a',1,2,3,4,5,6,'b']);
    expectParse(`return .* -> [ 'x', ...{a: 1, b:2}, 'y' ];`).toEqual(['x', ['a',1],['b',2], 'y']);
    expectParse(`return .* -> { a: 1, ...[['b',2], ['c',3]], d: 4 };`).toEqual({a: 1, b: 2, c: 3, d: 4});
    expectParse(`return .* -> { a: 1, ...{b: 2, c: 3 }, d: 4 };`).toEqual({a: 1, b: 2, c: 3, d: 4});
    expectParse(`return .* -> [ ...'foo' ];`).toEqual(['f', 'o', 'o']);
    expectParse(`return {'a'}* {'b'}* -> [...$1, ...$2];`, 'aaabbb').toEqual(['a','a','a','b','b','b']);
    expectParse(`
        return {foo} -> [...$1];
        foo = {.}{.}{.}{.}{.}{.} -> { $1: $4, $2: $5, $3: $6 };
    `,'abcdef').toEqual([['a','d'],['b','e'],['c','f']]);
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

test('whitespace', () => {
    expectParse(`
        return // single line comment
            {.} /* multi
                   line
                   comment
                */ {.} -> [$1, $2];
    `, 'ab').toEqual(['a', 'b']);
})

test('identifiers', () => {
    expectParse(`return .* -> { _foo: 1 };`).toEqual({ _foo: 1 });
    expectGrammarFail(`return .* -> { $foo: 1 }`);
    expectGrammarFail('return .* -> null; foo$ = . -> null;');
});

test('capture and groups', () => {
    expectParse(`return {.} {'x'}? {[b]}* {[a]}+ -> [$1, $2, $3, $4];`, 'aaaa')
        .toEqual(['a', null, [], ['a', 'a', 'a']]);
    expectParse(`return ('a'+ ({'b'})+ )+ -> $1;`, 'abaabbabbbabb')
        .toEqual('b'.repeat(8).split(""));
    expectParse(`return {(. .)+} -> $1;`, 'aaaa').toEqual('aaaa');
    expectParseFail(`return {(. .)+} -> 1;`, 'aaaaa');
    expectGrammarFail(`return {{.}} -> null;`);
    expectGrammarFail(`return {({.})} -> null;`);
});

test('predicates', () => {
    expectParse(`return !'a' .* -> $0;`, 'bbb').toEqual('bbb');
    expectParseFail(`return !'a' .* -> $0;`, 'abbb');
    expectParse(`return &'a' ... -> $0;`, 'abb').toEqual('abb');
    expectParseFail(`return &'a' ... -> $0;`, 'baa');
});

test('input consumption', () => {
    expectParseFail(`return .. -> $0;`, 'a');
    expectParseFail(`return . -> $0;`, 'aa');
    expectParse(`return .. -> $0;`, 'aa').toEqual('aa');
});

test('test modifiers', () => {
    expectParse(`return 'a' 'b'? 'a'? 'a'* 'b'+ -> $0;`, 'aaaaabbb').toEqual('aaaaabbb');
    expectParse(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'accc').toEqual('accc');
    expectParseFail(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'ccc');
    expectParseFail(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'abaaa');
});

test("variables", () => {
    expectParse(`$foo = 5; return .* -> $foo;`).toEqual(5);
    expectParse(`$foo = ['bar', {baz: true}]; return .* -> $foo;`).toEqual(['bar', {baz: true}]);
    expectParse(`$foo = $1; return {.*} -> $foo;`, 'blah').toEqual('blah');
    expectParse(`$foo = { foo: 'a', bar: 'b' }; return .* -> { baz: 'c', ...$foo, bee: [...$foo] };`)
        .toEqual({ baz: 'c', foo: 'a', bar: 'b', bee: [['foo', 'a'], ['bar', 'b'] ]});
    
    expectGrammarFail(`return .* -> $foo;`);
});

test("metas", () => {
    expectParse(`
        return .{rule}.. -> $1;
        rule = ... -> { pos: @position, length: @length };
    `, '123456').toEqual({ pos: 1, length: 3 });

    expectParse(`
        return .{rule}.. -> $1;
        rule = ... -> $meta;
        $meta = { pos: @position, length: @length };
    `, '123456').toEqual({ pos: 1, length: 3 });

    expectParse(`
        return .{rule}.. -> $1;
        rule = ... -> { foo: 'bar', ...$meta };
        $meta = { pos: @position, length: @length };
    `, '123456').toEqual({ foo: 'bar', pos: 1, length: 3 });
});

test("access", () => {
    expectParse(`return .* -> {a:1}.a;`).toEqual(1);
    expectParse(`return .* -> {a:1}['a'];`).toEqual(1);
    expectParse(`return .* -> [1][0];`).toEqual(1);
    expectParse(`return .* -> [1]['0'];`).toEqual(1);
    expectParse(`$foo = {a:1}; return .* -> $foo.a;`).toEqual(1);
    expectParse(`$foo = {a:1}; return .* -> $foo['a'];`).toEqual(1);
    expectParse(`$foo = 'foo'; return .* -> $foo[0];`).toEqual('f');
    expectParse(`foo = .* -> {a: 1}; return {foo} -> $1.a;`).toEqual(1);
    expectParse(`foo = .* -> {a: 1}; return {foo} -> $1['a'];`).toEqual(1);
    expectParse(`$foo = {a:[{b:2}]}; return .* -> $foo.a[0].b;`).toEqual(2);
});

test("dezent grammar documentation", () => {
    let uncompiledDezent = createUncompiledDezentGrammar();
    let textDezent = readFileSync("./test/grammar.dezent").toString();
    let hackedGrammar = findDezentGrammar();

    // Our bootstrap grammar does not contain any metas because it's created
    // somewhat manually, not parsed from source. But it does contain rules
    // that do insert metas into our documented grammar. To mitigate this,
    // we need to monkey-patch our bootstrap grammar so that it won't
    // insert metas into the grammar we parse from file.
    let prevMeta = hackedGrammar.vars.meta;
    hackedGrammar.vars.meta = { type: 'object', members: [] };
    let parsedDezent = parseText(hackedGrammar, textDezent, {debugErrors: true});
    hackedGrammar.vars.meta = prevMeta;

    expect(parsedDezent).toEqual(uncompiledDezent);
});

test("expected grammar terminals", () => {
    expect(parseGrammarError('return . -> {}').expected.sort()).toEqual([';']);
    expect(parseGrammarError('return {.}').expected.sort()).toEqual(["'", "(", "->", ".", "[", "_ a-z A-Z", "{", "|"]);
    expect(parseGrammarError(`return ( . ([ab] {'f'} 'foo)) -> $1;`).expected.sort()).toEqual(["'", "\\"]);
});

test("grammar errors", () => {
    /* 1001 */ expect(parseGrammarError(`return foo -> null; foo = . -> null; foo = .. -> 1;`).char).toEqual(38);
    /* 1002 */ expect(parseGrammarError(`return . -> 1; return . -> 2;`).char).toEqual(16);
    /* 1003 */ expect(parseGrammarError(`return foo -> true;`).char).toEqual(8);
    /* 1004 */ expect(parseError(`foo = . -> 1; return {foo} -> [...$1];`, 'a').char).toEqual(32);
    /* 1005 */ expect(parseError(`foo = . -> true;`, 'a').code).toEqual(1005);
    /* 1006 */ expect(parseGrammarError(`return {.} | {.} {.} -> true;`).char).toEqual(8);
    /* 1007 */ expect(parseGrammarError(`return {.} -> $2;`).char).toEqual(15);
    /* 1008 */ expect(parseGrammarError(`return . -> $foo;`).char).toEqual(13);
    /* 1009 */ expect(parseError(`$foo = 'foo'; return . -> ^$foo;`, 'a').char).toEqual(27);
    /* 1010 */ expect(parseError(`return . -> ^[[1,2],[1,2,3]];`,'a').char).toEqual(13);
    /* 1011 */ expect(parseError(`return . -> { ...[1] };`, 'a').char).toEqual(15);
    /* 1012 */ expect(parseError(`$foo = 234; return .* -> $foo[1];`, 'a').char).toEqual(30);
    /* 1013 */ expect(parseError(`$foo = {}; return .* -> [1][$foo];`, 'a').char).toEqual(28);
    /* 1013 */ expect(parseError(`return .* -> {}.foo;`, 'a').char).toEqual(16);
});

test("commants", () => {
    expectParse(`
        // return .* -> 1;
        /*
           return .* -> 2;
        */
        return .* -> 3;
    `).toEqual(3);
});

test("packrat", () => {
    function buildText(count) {
        let text = 'a'.repeat(count) + 'b';
    }

    let grammar = `
        return {theRule}* -> $1;
        theRule =
            {'a'}* {'c'} -> [$1, $2],
            {'b'} -> $1,
            {'a'} -> $1;
    `;

    let caching = new Dezent(grammar, {disableCache: false});
    let noncaching = new Dezent(grammar, {disableCache: true});

    function time(f:Function):number {
        let t = new Date().getTime();
        f();
        return new Date().getTime() - t;
    }

    let log:any[][] = [['packrat cache performance results']];
    function run(size:number) {
        let text = 'a'.repeat(size) + 'b';
        log.push(["size: ", size]);
        log.push(["  uncached:", time(() => noncaching.parse(text))]);
        log.push(["  cached:  ", time(() => caching.parse(text))]);
    }

    run(100);
    run(1000);
    run(2000);

    console.log(log.map((i)=>i.join(' ')).join('\n'));
});