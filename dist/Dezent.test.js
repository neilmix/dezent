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
require("jest");
const child_process_1 = require("child_process");
const Dezent_1 = require("./Dezent");
const Grammar_1 = require("./Grammar");
const GrammarCompiler_1 = require("./GrammarCompiler");
const fs_1 = require("fs");
const ParseBuffer_1 = require("./ParseBuffer");
const Interpreter_1 = require("./Interpreter");
const OpcodeCompiler_1 = require("./OpcodeCompiler");
function parse(grammar, text, options) {
    if (options && options.debugErrors === undefined)
        options.debugErrors = true;
    let d = new Dezent_1.Dezent(grammar, options);
    let ret = d.parse(text);
    if (ret === undefined) {
        throw d.error;
    }
    return ret;
}
function parseError(grammar, text, options) {
    try {
        parse(grammar, text, options);
        fail();
    }
    catch (e) {
        return e;
    }
}
function expectParse(grammar, text, options) {
    return expect(parse(grammar, text || 'Did you forget the second argument?', options));
}
function expectGrammarFail(grammar) {
    expect(() => {
        new Dezent_1.Dezent(grammar);
    }).toThrow();
}
function expectParseFail(grammar, text, options) {
    let d = new Dezent_1.Dezent(grammar, options || { debugErrors: false });
    expect(d.parse(text || 'Did you forget the second argument?')).toBe(undefined);
}
function parseGrammarError(grammar, options) {
    try {
        (0, Dezent_1.parseGrammar)(grammar, options || {});
        fail();
    }
    catch (e) {
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
    expectParse("return .* -> [ 1, 2, 3 ];").toEqual([1, 2, 3]);
    expectParse("return .* -> {foo: [{bar: {baz: [1, 2, 3 ]}}]};").toEqual({ foo: [{ bar: { baz: [1, 2, 3] } }] });
    // trailing commas
    expectParse("return .* -> [1,2,];").toEqual([1, 2]);
    expectParse("return .* -> { a: 1, b: 2, };").toEqual({ a: 1, b: 2 });
    // regression bug
    expectParse("return .* -> [ 1, null, 1 ];").toEqual([1, null, 1]);
});
test("backref outputs", () => {
    expectParse("return {.} {.} -> [$1, $2];", 'ab').toEqual(['a', 'b']);
    expectParse(`
        return {foo} {bar} -> [$1, $2];
        foo = {.}{.} -> { $1: $2 };
        bar = {.}{.} -> { $1: $2 };
    `, 'abcd').toEqual([{ a: 'b' }, { c: 'd' }]);
    expectParse(`return ... -> $0;`, 'aaa').toEqual('aaa');
    expectParse(`return ... -> 'foo\\$0bar';`, 'aaa').toEqual('fooaaabar');
    expectParse(`return ... -> 'foo$0bar';`, 'aaa').toEqual('foo$0bar');
    expectParse(`return {foo} -> '\\$1'; foo = . -> [1, {bar: 'baz', bee: 'bat'}, 'a'];`, 'a').toEqual('1bazbata');
});
test("pivot", () => {
    expectParse(`return .* -> pivot([[1,2,3],[4,5,6]]);`).toEqual([[1, 4], [2, 5], [3, 6]]);
    expectParse(`return .* -> {...pivot([['foo','bar','baz'],[4,5,6]])};`).toEqual({ foo: 4, bar: 5, baz: 6 });
    expectParse(`return .* -> pivot(pivot([[1,2,3],[4,5,6]]));`).toEqual([[1, 2, 3], [4, 5, 6]]);
    expectParseFail(`return .* -> pivot([1,2,3]);`);
    expectParseFail(`return .* -> pivot([[1,2],[1,2,3]]);`);
});
test("spread", () => {
    expectParse(`return .* -> [ 'a', ...[1,2,3], ...[4,5,6], 'b'];`).toEqual(['a', 1, 2, 3, 4, 5, 6, 'b']);
    expectParse(`return .* -> [ 'x', ...{a: 1, b:2}, 'y' ];`).toEqual(['x', ['a', 1], ['b', 2], 'y']);
    expectParse(`return .* -> { a: 1, ...[['b',2], ['c',3]], d: 4 };`).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expectParse(`return .* -> { a: 1, ...{b: 2, c: 3 }, d: 4 };`).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    expectParse(`return .* -> [ ...'foo' ];`).toEqual(['f', 'o', 'o']);
    expectParse(`return {'a'}* {'b'}* -> [...$1, ...$2];`, 'aaabbb').toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
    expectParse(`
        return {foo} -> [...$1];
        foo = {.}{.}{.}{.}{.}{.} -> { $1: $4, $2: $5, $3: $6 };
    `, 'abcdef').toEqual([['a', 'd'], ['b', 'e'], ['c', 'f']]);
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
});
test('identifiers', () => {
    expectParse(`return .* -> { _foo: 1 };`).toEqual({ _foo: 1 });
    expectGrammarFail(`return .* -> { $foo: 1 }`);
    expectGrammarFail('return .* -> null; foo$ = . -> null;');
});
test('capture and groups', () => {
    expectParse(`return {.} {[a]}+ -> [$1, $2];`, 'aaaa')
        .toEqual(['a', ['a', 'a', 'a']]);
    expectParse(`return {.} {'x'}? {[b]}* {[a]}+ -> [$1, $2, $3, $4];`, 'aaaa')
        .toEqual(['a', null, [], ['a', 'a', 'a']]);
    expectParse(`return ('a'+ ({'b'})+ )+ -> $1;`, 'abaabbabbbabb')
        .toEqual('b'.repeat(8).split(""));
    expectParse(`foo = {.} -> { foo: $1 }; return { foo . } -> $1;`, 'ab').toEqual('ab');
    expectParse(`return {(. .)+} -> $1;`, 'aaaa').toEqual('aaaa');
    // bug found during user testing
    expectParse(`return {bar} -> $1; bar = {foo|.} -> $1; foo = . -> 'y';`, 'x').toEqual('y');
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
test('modifiers', () => {
    expectParse(`return 'a' 'b'? 'a'? 'a'* 'b'+ -> $0;`, 'aaaaabbb').toEqual('aaaaabbb');
    expectParse(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'accc').toEqual('accc');
    expectParseFail(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'ccc');
    expectParseFail(`return 'a' 'b'? 'a'? 'a'* 'c'+ -> $0;`, 'abaaa');
});
test('array collapse', () => {
    expectParse(`return {'a'} {'b'}? {'a'} -> [$1, $2, $3 ];`, 'aa').toEqual(['a', null, 'a']);
    expectParse(`return {'a'} {'b'}? {'a'} -> [$1, $2?, $3 ];`, 'aa').toEqual(['a', 'a']);
    expectParse(`return ({'a'} {'b'}?)+ -> [ ...$1, ...$2 ];`, 'abaab').toEqual(['a', 'a', 'a', 'b', null, 'b']);
    expectParse(`return ({'a'} {'b'}?)+ -> [ ...$1, ...$2? ];`, 'abaab').toEqual(['a', 'a', 'a', 'b', 'b']);
    //expectParse(`letter = {[a-d]|[f-i]} -> $1, 'e' -> null; return {letter}* -> $1?;`, 'abcdefghi').toEqual(['a','b','c','d','f','g','h','i']);
    //expectParse(`return {rule}? -> $1?; rule = . -> [1, null];`, 'a').toEqual([1, null]);
});
test("variables", () => {
    expectParse(`$foo = 5; return .* -> $foo;`).toEqual(5);
    expectParse(`$foo = ['bar', {baz: true}]; return .* -> $foo;`).toEqual(['bar', { baz: true }]);
    expectParse(`$foo = $1; return {.*} -> $foo;`, 'blah').toEqual('blah');
    expectParse(`$foo = { foo: 'a', bar: 'b' }; return .* -> { baz: 'c', ...$foo, bee: [...$foo] };`)
        .toEqual({ baz: 'c', foo: 'a', bar: 'b', bee: [['foo', 'a'], ['bar', 'b']] });
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
test("callbacks", () => {
    expectParse(`return .* -> foo();`, 'anything', { callbacks: { foo: () => 4 } }).toEqual(4);
    expect(new Dezent_1.Dezent(`return .* -> foo();`).parse('anything', { foo: () => 4 })).toEqual(4);
    expectParse(`return .* -> foo(1, 'a', true, [1,2,3], { foo: 'bar' });`, 'anything', { callbacks: { foo: function () { return [].slice.call(arguments); } } })
        .toEqual([1, 'a', true, [1, 2, 3], { foo: 'bar' }]);
    expectParse(`return .* -> { foo: [ foo() ] };`, 'anything', { callbacks: { foo: () => 4 } })
        .toEqual({ foo: [4] });
    let value = 0;
    parse(`return foo -> null;
           foo = . bar -> null;
           bar = .* -> blah();`, 'anything', { callbacks: { blah: () => value = 5 } });
    expect(value).toEqual(5);
    expectParseFail(`return .* -> foo();`);
});
test("left recursion", () => {
    let grammar = `
        _ = [ \\n]* -> null;
        expr =
            {expr} _ '+' _ {mult} -> ['+',$1,$2],
            {mult} -> $1;
        mult =
            {mult} _ '*' _ {group} -> ['*',$1,$2],
            {group} -> $1;
        group =
            '(' {expr} ')' -> $1,
            {num} -> $1;
        num = [0-9]+ -> $0;
        return _ {expr} _ -> $1;
    `;
    expectParse(grammar, '5').toEqual('5');
    expectParse(grammar, '5+4').toEqual(['+', '5', '4']);
    expectParse(grammar, '5+4+3').toEqual(['+', ['+', '5', '4'], '3']);
    expectParse(grammar, '5+4+3+2').toEqual(['+', ['+', ['+', '5', '4'], '3'], '2']);
    expectParse(grammar, '5*4+3*2').toEqual(['+', ['*', '5', '4'], ['*', '3', '2']]);
    expectParse(grammar, '5*4*3+2').toEqual(['+', ['*', ['*', '5', '4'], '3'], '2']);
    expectParse(grammar, '1*(2+3)').toEqual(['*', '1', ['+', '2', '3']]);
    expectParse(grammar, '(2+3)*1').toEqual(['*', ['+', '2', '3'], '1']);
    grammar = `
        rule1 = rule2 -> $0;
        rule2 = rule1 'b' -> $0, 'a' -> $0;
        return rule1 -> $0;
    `;
    expectParse(grammar, 'ab').toEqual('ab');
    grammar = `
        rule1 = rule2 -> $0, 'a' -> $0;
        rule2 = rule1 'b' -> $0;
        return rule1 -> $0;
    `;
    expectParse(grammar, 'ab').toEqual('ab');
});
test("dezent grammar documentation", () => {
    let uncompiledDezent = (0, Grammar_1.createUncompiledDezentGrammar)();
    let textDezent = (0, fs_1.readFileSync)("./src/grammar.dezent").toString();
    let hackedGrammar = (0, GrammarCompiler_1.findDezentGrammar)();
    // Our bootstrap grammar does not contain any metas because it's created
    // somewhat manually, not parsed from source. But it does contain rules
    // that do insert metas into our documented grammar. To mitigate this,
    // we need to monkey-patch our bootstrap grammar so that it won't
    // insert metas into the grammar we parse from file.
    let prevMeta = hackedGrammar.vars.meta;
    hackedGrammar.vars.meta = { type: 'object', members: [] };
    let buf = new ParseBuffer_1.ParseBuffer(textDezent);
    let parsedDezent = new Interpreter_1.Interpreter(new OpcodeCompiler_1.OpcodeCompiler(hackedGrammar, false).compile(), buf).resume();
    hackedGrammar.vars.meta = prevMeta;
    expect(parsedDezent).toEqual(uncompiledDezent);
});
test("chunked parsing", () => {
    let ds = new Dezent_1.DezentStream(`return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[!.?]} -> [$1, $2, $3];`);
    ds.write("Hello w");
    ds.write("orld!");
    expect(ds.close()).toEqual(["Hello", "world", "!"]);
    function compare(grammar, text) {
        let expected = new Dezent_1.Dezent(grammar).parse(text);
        let dez = new Dezent_1.DezentStream(grammar, { debugErrors: true });
        for (let char of text) {
            dez.write(char);
        }
        let actual = dez.close();
        expect(actual).toEqual(expected);
    }
    compare("return [a]* -> $0;", "aa");
    let textDezent = (0, fs_1.readFileSync)("./src/grammar.dezent").toString();
    compare(textDezent, textDezent);
    // ensure we receive errors as soon as possible...
    ds = new Dezent_1.DezentStream(`return 'a' -> $0;`);
    try {
        ds.write('b');
        fail('the write should have failed due to parse error');
    }
    catch (e) { }
    ds = new Dezent_1.DezentStream(`return 'a'* -> null;`);
    try {
        ds.write('bb');
        //ds.close();
        fail('the write should have failed due to parse error');
    }
    catch (e) { }
});
test("command line util", () => {
    let stdout = (0, child_process_1.execSync)("npm exec dezent src/grammar.dezent src/grammar.dezent");
    let json = JSON.parse(stdout.toString());
    expect(json).not.toBe(null);
    expect(typeof json).toBe('object');
    stdout = (0, child_process_1.execSync)("cat src/grammar.dezent | npm exec dezent src/grammar.dezent -");
    expect(json).not.toBe(null);
    expect(typeof json).toBe('object');
});
test("expected grammar terminals", () => {
    //expect(parseGrammarError('return . -> {}').expected.sort()).toEqual([';']);
    //expect(parseGrammarError('return {.}').expected.sort()).toEqual(["'", "(", "->", ".", "[", "_ a-z A-Z", "{", "|"]);
    //expect(parseGrammarError(`return ( . ([ab] {'f'} 'foo)) -> $1;`).expected.sort()).toEqual(["'", "\\", "not: ' \\"]);
    expect(parseError(`return (!'a' .)+ -> $0;`, 'a').expected.sort()).toEqual(['not: a']);
});
test("minBufferSize", () => {
    let ds = new Dezent_1.DezentStream("return .* -> null;", { minBufferSizeInMB: 1 / (1024 * 1024) });
    ds.write('x');
    ds.write('y');
    ds.write('z');
    ds.write('a');
    ds.write('b');
    expect(ds["buffer"]["text"]).toEqual("ab");
    ds.close(); // ensure we don't get an exception trying to build $0 unnecessarily
    ds = new Dezent_1.DezentStream("return .* -> $0;", { minBufferSizeInMB: 1 / (1024 * 1024) });
    ds.write('x');
    ds.write('y');
    ds.write('z');
    ds.write('a');
    ds.write('b');
    try {
        ds.close();
        fail();
    }
    catch (err) {
        expect(err.code).toBe(2012);
    }
    ds = new Dezent_1.DezentStream("return 'a' 'b' 'c' 'd' 'e' 'f' -> null;", { minBufferSizeInMB: 1 / (1024 * 1024) });
    ds.write('a');
    ds.write('b');
    ds.write('c');
    ds.write('d');
    ds.write('e');
    ds.write('f');
    ds.close();
});
test("position info", () => {
    let info = Dezent_1.Dezent.getPositionInfo(`12345\n\t67890`, 10);
    expect(info.line).toBe(2);
    expect(info.char).toBe(5);
    expect(info.lineText).toBe('    67890');
    expect(info.pointerText).toBe('       ^');
});
test("errors", () => {
    /* 1001 */ expect(parseGrammarError(`return foo -> null; foo = . -> null; foo = .. -> 1;`).char).toEqual(38);
    /* 1002 */ expect(parseGrammarError(`return . -> 1; return . -> 2;`).char).toEqual(16);
    /* 1003 */ expect(parseGrammarError(`return foo -> true;`).char).toEqual(8);
    /* 1004 */ expect(parseError(`foo = . -> 1; return {foo} -> [...$1];`, 'a').char).toEqual(32);
    /* 1005 */ expect(parseError(`foo = . -> true;`, 'a').code).toEqual(1005);
    /* 1006 */ expect(parseGrammarError(`return {.} | {.} {.} -> true;`).char).toEqual(8);
    /* 1007 */ expect(parseGrammarError(`return {.} -> $2;`).char).toEqual(15);
    /* 1008 */ expect(parseGrammarError(`return . -> $foo;`).char).toEqual(13);
    /* 1009 */ expect(parseError(`return .* -> foo();`, 'a').char).toEqual(14);
    /* 1011 */ expect(parseError(`return . -> { ...[1] };`, 'a').char).toEqual(15);
    /* 1012 */ expect(parseError(`$foo = 234; return .* -> $foo[1];`, 'a').char).toEqual(30);
    /* 1013 */ expect(parseError(`$foo = {}; return .* -> [1][$foo];`, 'a').char).toEqual(28);
    /* 1014 */ expect(parseError(`return .* -> {}.foo;`, 'a').char).toEqual(16);
    expect(parseGrammarError(`
return foo -> $0;
foo+ = . -> $0;
`).char).toEqual(4);
});
test("comments", () => {
    expectParse(`
        // return .* -> 1;
        /*
           return .* -> 2;
        */
        return .* -> 3;
    `).toEqual(3);
});
test("profile", () => {
    let log = console.log;
    try {
        console.log = function () { };
        parse("return foo -> null; foo = .* -> null;", "a", { enableProfiling: true });
    }
    finally {
        console.log = log;
    }
});
