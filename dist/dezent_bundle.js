(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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
exports.DezentStream = exports.Dezent = void 0;
var Parser_1 = require("./Parser");
var ParseBuffer_1 = require("./ParseBuffer");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, options) {
        this.grammar = Parser_1.parseGrammar(grammarStr, grammarOptions(options));
        this.options = options || {};
        this.error = null;
    }
    Dezent.prototype.parse = function (text) {
        try {
            var stream = new DezentStream(this.grammar, this.options);
            stream.write(text);
            return stream.close();
        }
        catch (e) {
            this.error = e;
            if (this.options.debugErrors) {
                throw e;
            }
            return undefined;
        }
    };
    return Dezent;
}());
exports.Dezent = Dezent;
var DezentStream = /** @class */ (function () {
    function DezentStream(grammar, options) {
        this.options = options || {};
        this.buffer = new ParseBuffer_1.ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? Parser_1.parseGrammar(grammar, grammarOptions(this.options)) : grammar;
        this.parser = new Parser_1.Parser(grammar, this.buffer, this.options);
    }
    DezentStream.prototype.write = function (text) {
        this.buffer.addChunk(text);
        this.parser.parse();
    };
    DezentStream.prototype.close = function () {
        this.buffer.close();
        return this.parser.parse();
    };
    return DezentStream;
}());
exports.DezentStream = DezentStream;
function grammarOptions(opt) {
    // don't dumpDebug when parsing the grammar
    var gOpt = Object.assign({}, opt);
    gOpt.dumpDebug = false;
    return gOpt;
}

},{"./ParseBuffer":5,"./Parser":6}],2:[function(require,module,exports){
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUncompiledDezentGrammar = exports.GrammarVersion = void 0;
exports.GrammarVersion = 1;
function createUncompiledDezentGrammar() {
    // This is a mini DSL that allows us to build an AST
    // that our parser uses to parse grammar files.
    // This is the same grammar as in grammar.dezent,
    // though there are some restrictions to avoid
    // having to write a full recursive descent parser:
    // - there can be no whitespace within a capture
    // - object spread must be written as name/value pair, e.g. ...$1': ''
    // - grouping parens (and predicate/modifier) must be surrounded by whitespace
    // - character classes don't support spaces - use \\u0020
    // - collapse can only happen with backrefs
    // - spread operator can only be used with backref or constref
    return {
        ruleset: [
            returndef("_ ( {returndef|ruleset} _ | {constant} _ )*", { ruleset: "$1", vars: { '...$2': '' }, pragmas: {} }),
            ruleset('_', "( singleLineComment | multiLineComment | whitespace? )*", null),
            ruleset('singleLineComment', "'//' ( !'\\n' . )* '\\n'", null),
            ruleset('multiLineComment', "'/*' ( !'*/' . )* '*/'", null),
            ruleset('whitespace', "[\\u0020\\t-\\r]+", null),
            ruleset('returndef', "'return' whitespace _ {rule} _ ';'", { type: 'ruleset', name: 'return', rules: ['$1'], '...$meta': '' }),
            ruleset('ruleset', "{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'", { type: 'ruleset', name: '$1', rules: ['$2', '...$3'], '...$meta': '' }),
            ruleset('constant', "'$' {identifier} _ '=' _ {value} _ ';'", ['$1', '$2']),
            ruleset('rule', "{patterns} _ '->' _ {value}", { type: 'rule', '...$1': '', value: '$2', '...$meta': '' }),
            ruleset('patterns', "{pattern} _ ( '|' _ {pattern} _ )*", { patterns: ['$1', '...$2'] }),
            ruleset('pattern', "( {token} _ )+", { type: 'pattern', tokens: '$1' }),
            ruleset('token', "{predicate} {capture|group|string|class|ruleref|any} {modifier}", { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
            ruleset('capture', "'{' _ {capturePatterns} _ '}'", { type: 'capture', '...$1': '' }),
            ruleset('group', "'(' _ {patterns} _ ')'", { type: 'group', '...$1': '' }),
            ruleset('capturePatterns', "{capturePattern} _ ( '|' _ {capturePattern} _ )*", { patterns: ['$1', '...$2'] }),
            ruleset('capturePattern', "( {captureToken} _ )+", { type: 'pattern', tokens: '$1' }),
            ruleset('captureToken', "{predicate} {captureGroup|string|class|ruleref|any} {modifier}", { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
            ruleset('captureGroup', "'(' _ {capturePatterns} _ ')'", { type: 'group', '...$1': '' }),
            ruleset('class', "'[' {classComponent}* ']'", { type: 'class', ranges: '$1' }),
            ruleset('classComponent', "{classChar} '-' {classChar}", ['$1', '$2'], "{classChar}", ['$1', '$1']),
            ruleset('classChar', "!']' {escape|char}", '$1'),
            ruleset('char', "charstr", { type: 'char', value: '$0' }),
            ruleset('any', "'.'", { type: 'any' }),
            ruleset('ruleref', "{identifier}", { type: 'ruleref', name: '$1', '...$meta': '' }),
            ruleset('predicate', "'&'", { and: true, not: false }, "'!'", { and: false, not: true }, "''", { and: false, not: false }),
            ruleset('modifier', "'*'", { repeat: true, required: false }, "'+'", { repeat: true, required: true }, "'?'", { repeat: false, required: false }, "''", { repeat: false, required: true }),
            ruleset('value', "{backref|constref|metaref|object|array|call|string|number|boolean|null}", '$1'),
            ruleset('backref', "'$' {[0-9]+} '?' {access}", { type: 'backref', index: '$1', collapse: true, access: '$2', '...$meta': '' }, "'$' {[0-9]+} {access}", { type: 'backref', index: '$1', collapse: false, access: '$2', '...$meta': '' }),
            ruleset('constref', "'$' {identifier} {access}", { type: 'constref', name: '$1', access: '$2', '...$meta': '' }),
            ruleset('metaref', "'@' {'position'|'length'}", { type: 'metaref', name: '$1' }),
            ruleset('spread', "'...' {backref|constref|object|array|string|call}", { type: 'spread', value: '$1', '...$meta': '' }),
            ruleset('object', "'{' ( _ {member} _ ',' )* _ {member}? _ '}' {access}", { type: 'object', members: ['...$1', '$2?'], access: '$3' }),
            ruleset('member', "{spread}", '$1', "{backref|string|identifierAsStringNode} _ ':' _ {value}", { type: 'member', name: '$1', value: '$2' }),
            ruleset('array', "'[' ( _ {element} _ ',' )* _ {element}? _ ']' {access}", { type: 'array', elements: ['...$1', '$2?'], access: '$3' }),
            ruleset('element', "{value|spread}", '$1'),
            ruleset('call', "{identifier} _ '(' ( _ {value} _ ',' )* _ {value}? _ ')'", { type: 'call', name: '$1', args: ['...$2', '$3?'], '...$meta': '' }),
            ruleset('string', "'\\'' {escape|stringText}* '\\''", { type: 'string', tokens: '$1' }),
            ruleset('stringText', "( !['\\\\] . )+", { type: 'text', value: '$0' }),
            ruleset('number', "'-'? ( [0-9]+ )? '.' [0-9]+ ( [eE] [-+] [0-9]+ )?", { type: 'number', value: '$0' }, "'-'? [0-9]+ ( [eE] [-+] [0-9]+ )?", { type: 'number', value: '$0' }),
            ruleset('boolean', "'true'", { type: 'boolean', value: true }, "'false'", { type: 'boolean', value: false }),
            ruleset('null', "'null'", { type: 'null' }),
            ruleset('access', "{dotAccess|bracketAccess}*", '$1'),
            ruleset('dotAccess', "'.' {identifier}", { name: '$1', '...$meta': '' }),
            ruleset('bracketAccess', "'[' _ {backref|constref|metaref|string|index} _ ']'", { value: '$1', '...$meta': '' }),
            ruleset('index', "[0-9]+", { type: 'number', value: '$0' }),
            ruleset('escape', "'\\\\' {unicode|charstr}", { type: 'escape', value: '$1' }),
            ruleset('unicode', "'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9]", '$0'),
            ruleset('charstr', "!'\\n' .", '$0'),
            ruleset('identifier', "[_a-zA-Z] [_a-zA-Z0-9]*", '$0'),
            ruleset('identifierAsStringNode', "{identifier}", { type: 'string', tokens: [{ type: 'text', value: '$1' }] }),
        ],
        vars: {
            meta: output({ meta: { pos: "@position", length: "@length" } })
        },
        pragmas: {}
    };
}
exports.createUncompiledDezentGrammar = createUncompiledDezentGrammar;
function returndef(patterns, output) {
    return {
        type: 'ruleset',
        name: 'return',
        rules: [rule(patterns, output)],
    };
}
function ruleset(name) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var rules = [];
    for (var i = 0; i < args.length; i += 2) {
        rules.push(rule(args[i], args[i + 1]));
    }
    return {
        type: 'ruleset',
        name: name,
        rules: rules,
    };
}
function rule(patterns, out) {
    return {
        type: 'rule',
        patterns: [pattern(patterns.split(/ +/))],
        value: output(out)
    };
}
function pattern(tokStrs) {
    var tokens = [];
    for (var i = 0; i < tokStrs.length; i++) {
        var tokStr = tokStrs[i];
        var node = void 0;
        var and = tokStr[0] == '&';
        var not = tokStr[0] == '!';
        if (and || not) {
            tokStr = tokStr.substr(1);
        }
        var required = true, repeat = false;
        if (tokStr == '(') {
            var j = i;
            while (tokStrs[++j][0] != ')')
                ;
            if (['?', '*'].includes(tokStrs[j][1]))
                required = false;
            if (['+', '*'].includes(tokStrs[j][1]))
                repeat = true;
            node = group(tokStrs.slice(i + 1, j));
            i = j;
        }
        else {
            if (['?', '*'].includes(tokStr[tokStr.length - 1]))
                required = false;
            if (['+', '*'].includes(tokStr[tokStr.length - 1]))
                repeat = true;
            if (!required || repeat) {
                tokStr = tokStr.substr(0, tokStr.length - 1);
            }
            if (tokStr[0] == '[') {
                node = charClass(tokStr);
            }
            else {
                switch (tokStr[0]) {
                    case '{':
                        node = capture(tokStr);
                        break;
                    case "'":
                        node = string(tokStr);
                        break;
                    case '.':
                        node = { type: 'any' };
                        break;
                    default:
                        node = ruleref(tokStr);
                        break;
                }
            }
        }
        tokens.push({
            type: 'token',
            required: required,
            repeat: repeat,
            and: and,
            not: not,
            descriptor: node
        });
    }
    return {
        type: 'pattern',
        tokens: tokens
    };
}
function group(tokens) {
    var patterns = [];
    var lastOr = -1;
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i] == '|') {
            patterns.push(pattern(tokens.slice(lastOr + 1, i)));
            lastOr = i;
        }
    }
    patterns.push(pattern(tokens.slice(lastOr + 1, tokens.length)));
    return {
        type: 'group',
        patterns: patterns
    };
}
function capture(token) {
    var repeat = null;
    token = token.substr(0, token.length - 1);
    var patterns = token.substr(1, token.length - 1).split('|');
    return {
        type: 'capture',
        patterns: patterns.map(function (t) { return pattern([t]); }),
    };
}
function charClass(token) {
    var ranges = [];
    var j = 1;
    var parseBound = function () {
        var bound;
        if (token[j] == '\\') {
            j++;
            var value = token[j] == 'u' ? token.substr(j, 5) : token[j];
            j += value.length - 1;
            bound = { type: 'escape', value: value };
        }
        else {
            bound = { type: 'char', value: token[j] };
        }
        j++;
        return bound;
    };
    while (j < token.length - 1) {
        var start = parseBound();
        var end = void 0;
        if (token[j] == '-') {
            j++;
            end = parseBound();
        }
        ranges.push([start, end || start]);
    }
    return { type: 'class', ranges: ranges };
}
function string(token) {
    token = token.substr(1, token.length - 2); // strip bounding quotes
    if (token.length == 2 && token[0] == '\\') {
        return {
            type: 'string',
            tokens: [{
                    type: 'escape',
                    value: token[1]
                }]
        };
    }
    else if (token.indexOf('\\') >= 0) {
        throw new Error('not yet implemented');
    }
    else if (token.length == 0) {
        return {
            type: 'string',
            tokens: []
        };
    }
    else {
        return {
            type: 'string',
            tokens: [{
                    type: 'text',
                    value: token
                }]
        };
    }
}
function ruleref(token) {
    if (!token.match(/^[a-zA-Z0-9_]+/)) {
        throw new Error("invalid identifier: " + token);
    }
    return {
        type: 'ruleref',
        name: token
    };
}
function output(value) {
    var e_1, _a;
    switch (typeof value) {
        case 'object':
            if (value === null) {
                return { type: 'null' };
            }
            else if (Array.isArray(value)) {
                var ret = [];
                try {
                    for (var value_1 = __values(value), value_1_1 = value_1.next(); !value_1_1.done; value_1_1 = value_1.next()) {
                        var elem = value_1_1.value;
                        var out = output(elem);
                        ret.push(out);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (value_1_1 && !value_1_1.done && (_a = value_1.return)) _a.call(value_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                return {
                    type: 'array',
                    elements: ret,
                    access: []
                };
            }
            else {
                var members = [];
                for (var name_1 in value) {
                    if (name_1.startsWith('...')) {
                        // spread
                        members.push(output(name_1));
                    }
                    else {
                        members.push({
                            type: 'member',
                            name: output(name_1),
                            value: output(value[name_1])
                        });
                    }
                }
                return {
                    type: 'object',
                    members: members,
                    access: []
                };
            }
        case 'string':
            if (value.match(/^\$(\d+)/)) {
                return {
                    type: 'backref',
                    index: RegExp.$1,
                    collapse: value[value.length - 1] == '?',
                    access: []
                };
            }
            else if (value.match(/^@([a-zA-Z_]+)/)) {
                return {
                    type: 'metaref',
                    name: RegExp.$1
                };
            }
            else if (value.match(/^\.\.\./)) {
                var ref = function (name) {
                    // don't use a regexp here because it will mess up the backrefs just prior to this call
                    return name[0] <= '9'
                        ? { type: 'backref', index: name, collapse: false, access: [] }
                        : { type: 'constref', name: name, access: [] };
                };
                if (value.match(/^...\$([0-9]+|[a-zA-Z_]+)/)) {
                    return { type: 'spread', value: ref(RegExp.$1) };
                }
                else {
                    throw new Error();
                }
            }
            else {
                return {
                    type: 'string',
                    tokens: [{
                            type: 'text',
                            value: value
                        }]
                };
            }
        case 'number':
            return {
                type: 'number',
                value: String(value)
            };
        case 'boolean':
            return {
                type: 'boolean',
                value: !!value
            };
        default:
            throw new Error('Unexpected JSON data type: ' + typeof value);
    }
}

},{}],3:[function(require,module,exports){
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grammarError = exports.GrammarCompiler = void 0;
var Parser_1 = require("./Parser");
var ParseBuffer_1 = require("./ParseBuffer");
var Grammar_1 = require("./Grammar");
var Output_1 = require("./Output");
var GrammarCompiler = /** @class */ (function () {
    function GrammarCompiler() {
    }
    GrammarCompiler.compileGrammar = function (grammar, text) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // - other helpful sanity checks
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        var e_1, _a, e_2, _b, e_3, _c;
        grammar.version = Grammar_1.GrammarVersion;
        grammar.text = text;
        var rulesetLookup = grammar.rulesetLookup = {};
        try {
            for (var _d = __values(grammar.ruleset), _e = _d.next(); !_e.done; _e = _d.next()) {
                var ruleset = _e.value;
                if (rulesetLookup[ruleset.name]) {
                    if (ruleset.name == 'return') {
                        grammarError(Parser_1.ErrorCode.MultipleReturn, text, ruleset.meta, ruleset.name);
                    }
                    else {
                        grammarError(Parser_1.ErrorCode.DuplicateDefine, text, ruleset.meta, ruleset.name);
                    }
                }
                rulesetLookup[ruleset.name] = ruleset;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var nodeSequence = 0;
        try {
            for (var _f = __values(grammar.ruleset), _g = _f.next(); !_g.done; _g = _f.next()) {
                var ruleset = _g.value;
                var rules = ruleset.rules;
                for (var i = 0; i < rules.length; i++) {
                    rules[i].rulesetName = ruleset["name"] || "return";
                    rules[i].rulesetIndex = i;
                    rules[i].captures = this.compileRule(rules[i], grammar.vars, text);
                }
                // assign an id to every node
                visitParseNodes(null, ruleset, null, function (node) {
                    node.id = ++nodeSequence;
                }, null);
                // perform sanity checks
                visitParseNodes("ruleref", ruleset, null, null, function (node) {
                    if (!rulesetLookup[node.name]) {
                        grammarError(Parser_1.ErrorCode.RuleNotFound, text, node.meta, node.name);
                    }
                });
                // figure out if our selectors are capable of failing, which helps in
                // identifying expected tokens for good error messaging.
                visitParseNodes("pattern", ruleset, null, null, function (node) {
                    var e_4, _a;
                    try {
                        for (var _b = (e_4 = void 0, __values(node.tokens)), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var token = _c.value;
                            if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                                node.canFail = true;
                                return;
                            }
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                    node.canFail = false;
                });
                visitParseNodes(["capture", "group", "rule"], ruleset, null, null, function (node) {
                    var e_5, _a;
                    node.canFail = true;
                    try {
                        for (var _b = (e_5 = void 0, __values(node.patterns)), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var pattern = _c.value;
                            if (!pattern.canFail) {
                                node.canFail = false;
                                break;
                            }
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                });
                if (ruleset.name == 'return') {
                    ruleset.canFail = true;
                }
                else {
                    ruleset.canFail = true;
                    try {
                        for (var _h = (e_3 = void 0, __values(ruleset.rules)), _j = _h.next(); !_j.done; _j = _h.next()) {
                            var rule = _j.value;
                            if (!rule.canFail) {
                                ruleset.canFail = false;
                                break;
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
            }
            finally { if (e_2) throw e_2.error; }
        }
        grammar.maxid = nodeSequence;
        return grammar;
    };
    GrammarCompiler.compileRule = function (rule, vars, text) {
        // put an empty placeholder in captures so that the indices
        // align with backrefs (which begin at 1)
        var info = { captures: [null], repeats: 0, backrefs: [null] };
        var i = 0;
        var lastCount = -1;
        do {
            info.captures = [null];
            visitParseNodes("token", rule.patterns[i], info, function (node, info) {
                if (node.repeat)
                    info.repeats++;
                if (node.descriptor.type == "capture") {
                    node.descriptor.index = info.captures.length;
                    info.captures.push(info.repeats > 0);
                }
            }, function (node, info) {
                if (node.repeat)
                    info.repeats--;
            });
            if (lastCount > -1 && lastCount != info.captures.length) {
                grammarError(Parser_1.ErrorCode.CaptureCountMismatch, text, rule.meta);
            }
            lastCount = info.captures.length;
            i++;
        } while (i < rule.patterns.length);
        visitParseNodes("string", rule, null, null, function (node) {
            var matchString = Output_1.buildString(node);
            node.pattern = matchString;
            node.match = function (buf, idx) { return buf.containsAt(matchString, idx) ? [true, matchString.length] : [false, 0]; };
        });
        visitParseNodes("class", rule, null, null, function (node) {
            var e_6, _a;
            try {
                for (var _b = __values(node.ranges), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var range = _c.value;
                    range.map(function (bound) {
                        if (bound.type == 'escape') {
                            if (bound.value[0] == 'u') {
                                bound.match = String.fromCharCode(parseInt(bound.value.substr(1), 16));
                            }
                            else {
                                bound.match = ({
                                    'n': '\n',
                                    't': '\t',
                                    'r': '\r',
                                    'b': '\b',
                                    'f': '\f',
                                })[bound.value] || bound.value;
                            }
                        }
                        else {
                            bound.match = bound.value;
                        }
                    });
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_6) throw e_6.error; }
            }
            node.pattern = node.ranges.map(function (i) {
                var ret = (i[0].type == 'escape' ? '\\' : '') + i[0].value;
                if (i[0].value != i[1].value) {
                    ret += '-';
                    ret += (i[1].type == 'escape' ? '\\' : '') + i[1].value;
                }
                return ret;
            }).join(' ');
            node.match = function (buf, idx) {
                var e_7, _a;
                var c = buf.charAt(idx);
                try {
                    for (var _b = __values(node.ranges), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var range = _c.value;
                        if (c >= range[0].match && c <= range[1].match) {
                            return [true, 1];
                        }
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
                return [false, 0];
            };
        });
        visitParseNodes("any", rule, null, null, function (node) {
            node.match = function (buf, idx) {
                return buf.charAt(idx) ? [true, 1] : [false, 0];
            };
            node.pattern = '';
        });
        visitOutputNodes(rule.value, info, function (node, info) {
            if (node.type == "backref") {
                info.backrefs.push(node);
                if (node.index == "0") {
                    rule.hasBackref0 = true;
                }
            }
            if (node.type == "constref") {
                if (!vars[node.name]) {
                    grammarError(Parser_1.ErrorCode.InvalidConstRef, text, node.meta, node.name);
                }
            }
        });
        for (var i_1 = 1; i_1 < info.backrefs.length; i_1++) {
            if (info.backrefs[i_1].index >= info.captures.length) {
                grammarError(Parser_1.ErrorCode.InvalidBackRef, text, info.backrefs[i_1].meta, info.backrefs[i_1].index);
            }
        }
        return info.captures;
    };
    return GrammarCompiler;
}());
exports.GrammarCompiler = GrammarCompiler;
function visitParseNodes(types, root, data, enter, exit) {
    var e_8, _a;
    if (typeof types == "string") {
        types = [types];
    }
    if (enter && (types == null || types.includes(root.type))) {
        enter(root, data);
    }
    var items = [];
    switch (root.type) {
        case "ruleset":
            items = root.rules;
            break;
        case "rule":
        case "capture":
        case "group":
            items = root.patterns;
            break;
        case "pattern":
            items = root.tokens;
            break;
        case "token":
            items = [root.descriptor];
            break;
        default: break;
    }
    try {
        for (var items_1 = __values(items), items_1_1 = items_1.next(); !items_1_1.done; items_1_1 = items_1.next()) {
            var item = items_1_1.value;
            visitParseNodes(types, item, data, enter, exit);
        }
    }
    catch (e_8_1) { e_8 = { error: e_8_1 }; }
    finally {
        try {
            if (items_1_1 && !items_1_1.done && (_a = items_1.return)) _a.call(items_1);
        }
        finally { if (e_8) throw e_8.error; }
    }
    if (exit && (types == null || types.includes(root.type))) {
        exit(root, data);
    }
}
function visitOutputNodes(node, data, f) {
    var e_9, _a;
    f(node, data);
    var items;
    if (node.type == "spread") {
        items = [node.value];
    }
    else if (node.type == "array") {
        items = node.elements;
    }
    else if (node.type == "object") {
        items = node.members;
    }
    else if (node.type == "member") {
        visitOutputNodes(node.name, data, f);
        items = [node.value];
    }
    if (items) {
        try {
            for (var items_2 = __values(items), items_2_1 = items_2.next(); !items_2_1.done; items_2_1 = items_2.next()) {
                var item = items_2_1.value;
                visitOutputNodes(item, data, f);
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (items_2_1 && !items_2_1.done && (_a = items_2.return)) _a.call(items_2);
            }
            finally { if (e_9) throw e_9.error; }
        }
    }
}
function grammarError(code, text, meta) {
    var args = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        args[_i - 3] = arguments[_i];
    }
    var reason = Parser_1.errorMessages[code].replace(/\$([0-9])/g, function (match, index) { return args[index - 1]; });
    var msg = "Grammar error " + code + ": " + reason;
    var info;
    if (text && meta) {
        info = new ParseBuffer_1.ParseBuffer(text).findLineAndChar(meta.pos);
        msg = msg + "\nAt line " + info.line + " char " + info.char + ":\n" + info.lineText + "\n" + info.pointerText + "\n";
    }
    var e = new Error(msg);
    e["code"] = code;
    if (info) {
        e["pos"] = meta.pos;
        e["line"] = info.line;
        e["char"] = info.char;
        e["lineText"] = info.lineText;
        e["pointerText"] = info.pointerText;
        e["reason"] = reason;
    }
    throw e;
}
exports.grammarError = grammarError;

},{"./Grammar":2,"./Output":4,"./ParseBuffer":5,"./Parser":6}],4:[function(require,module,exports){
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildString = exports.ValueBuilder = void 0;
var Parser_1 = require("./Parser");
var GrammarCompiler_1 = require("./GrammarCompiler");
var defaultCallbacks = {
    pivot: function (value) {
        var e_1, _a;
        if (!Array.isArray(value)) {
            throw new Error("Invalid pivot argment: " + value);
        }
        value.map(function (item) {
            if (!Array.isArray(item)) {
                throw new Error("Invalid pivot argument: " + JSON.stringify(item));
            }
            if (item.length != value[0].length) {
                throw new Error("All subarrays in a pivot must be of the same length");
            }
        });
        var ret = [];
        try {
            for (var _b = __values(value[0]), _c = _b.next(); !_c.done; _c = _b.next()) {
                var item = _c.value;
                ret.push([]);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        for (var i = 0; i < value.length; i++) {
            for (var j = 0; j < value[0].length; j++) {
                ret[j][i] = value[i][j];
            }
        }
        return ret;
    }
};
var ValueBuilder = /** @class */ (function () {
    function ValueBuilder(grammar, callbacks) {
        this.grammar = grammar;
        this.callbacks = callbacks || {};
    }
    ValueBuilder.prototype.buildValue = function (frame) {
        var e_2, _a;
        var rule = frame.ruleset.rules[frame.ruleIndex];
        var captureValues = rule.captures.map(function (b) { return b === true ? [] : null; });
        if (frame.captures)
            try {
                for (var _b = __values(frame.captures), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var capture = _c.value;
                    Parser_1.assert(capture.captureIndex !== undefined);
                    Parser_1.assert(capture.captureIndex < rule.captures.length);
                    if (rule.captures[capture.captureIndex]) {
                        // the capture is an array due to token repetition
                        if (!captureValues[capture.captureIndex]) {
                            captureValues[capture.captureIndex] = [];
                        }
                        captureValues[capture.captureIndex].push(capture.value);
                        // This is a hack. A backref that is configured to collapse
                        // empty results (e.g. $1?) is unable to distinguish between
                        // an array generated via token repetition vs an array returned
                        // as output from a rule. So we bolt on a little info here to
                        // help out the backref processing later. We'll make this non-enumerable 
                        // so that our tests don't freak out about this extra property.
                        Object.defineProperty(captureValues[capture.captureIndex], "repeated", { configurable: true, enumerable: false, value: true });
                    }
                    else {
                        // this is a solo capture
                        Parser_1.assert(captureValues[capture.captureIndex] === null);
                        captureValues[capture.captureIndex] = capture.value;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        return this.value(rule.value, captureValues, { position: frame.pos, length: frame.consumed });
    };
    ValueBuilder.prototype.value = function (node, captureValues, metas) {
        var e_3, _a;
        var out = this[node.type](node, captureValues, metas);
        if (node.access)
            try {
                for (var _b = __values(node.access), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var prop = _c.value;
                    if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                        GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                    }
                    var index = void 0;
                    if (prop.value) {
                        index = this.value(prop.value, captureValues, metas);
                        if (typeof index != 'string' && typeof index != 'number') {
                            GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidAccessIndex, this.grammar.text, prop.meta, JSON.stringify(index));
                        }
                    }
                    else {
                        index = prop.name;
                    }
                    if (!out.hasOwnProperty(index)) {
                        GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                    }
                    out = out[index];
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_3) throw e_3.error; }
            }
        return out;
    };
    ValueBuilder.prototype.backref = function (node, captures) {
        var e_4, _a;
        var cap = captures[node.index];
        // n.b. the "repeated" property is added dynamically above
        if (node.collapse && Array.isArray(cap) && cap["repeated"]) {
            var ret = [];
            try {
                for (var cap_1 = __values(cap), cap_1_1 = cap_1.next(); !cap_1_1.done; cap_1_1 = cap_1.next()) {
                    var item = cap_1_1.value;
                    if (item != null) {
                        ret.push(item);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (cap_1_1 && !cap_1_1.done && (_a = cap_1.return)) _a.call(cap_1);
                }
                finally { if (e_4) throw e_4.error; }
            }
            return ret;
        }
        else {
            return cap;
        }
    };
    ValueBuilder.prototype.constref = function (node, captures, metas) {
        var resolved = this.grammar.vars[node.name];
        return this.value(resolved, captures, metas);
    };
    ValueBuilder.prototype.metaref = function (node, captures, metas) {
        return metas[node.name];
    };
    ValueBuilder.prototype.spread = function (node, captures, metas) {
        var value = this.value(node.value, captures, metas);
        if (!value || (typeof value != 'object' && typeof value != 'string')) {
            GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
        }
        if (typeof value == "string") {
            return value.split('');
        }
        else if (Array.isArray(value)) {
            return value;
        }
        else {
            return Object.entries(value);
        }
    };
    ValueBuilder.prototype.object = function (node, captures, metas) {
        var e_5, _a, e_6, _b;
        var ret = {};
        try {
            for (var _c = __values(node.members), _d = _c.next(); !_d.done; _d = _c.next()) {
                var member = _d.value;
                if (member.type == "spread") {
                    var tuples = this.value(member, captures, metas);
                    try {
                        for (var tuples_1 = (e_6 = void 0, __values(tuples)), tuples_1_1 = tuples_1.next(); !tuples_1_1.done; tuples_1_1 = tuples_1.next()) {
                            var tuple = tuples_1_1.value;
                            if (!Array.isArray(tuple) || tuple.length != 2) {
                                GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                            }
                            ret[tuple[0]] = tuple[1];
                        }
                    }
                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                    finally {
                        try {
                            if (tuples_1_1 && !tuples_1_1.done && (_b = tuples_1.return)) _b.call(tuples_1);
                        }
                        finally { if (e_6) throw e_6.error; }
                    }
                }
                else {
                    ret[this.value(member.name, captures, metas)]
                        = this.value(member.value, captures, metas);
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return ret;
    };
    ValueBuilder.prototype.array = function (node, captures, metas) {
        var e_7, _a;
        var ret = [];
        try {
            for (var _b = __values(node.elements), _c = _b.next(); !_c.done; _c = _b.next()) {
                var elem = _c.value;
                if (elem.type == "spread") {
                    ret = ret.concat(this.value(elem, captures, metas));
                }
                else {
                    var val = this.value(elem, captures, metas);
                    if (elem.type != "backref" || !elem.collapse || val !== null) {
                        ret.push(val);
                    }
                }
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_7) throw e_7.error; }
        }
        return ret;
    };
    ValueBuilder.prototype.call = function (node, captures, metas) {
        var e_8, _a;
        var argVals = [];
        try {
            for (var _b = __values(node.args), _c = _b.next(); !_c.done; _c = _b.next()) {
                var arg = _c.value;
                argVals.push(this.value(arg, captures, metas));
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_8) throw e_8.error; }
        }
        var caller = this.callbacks[node.name];
        if (!caller)
            caller = defaultCallbacks[node.name];
        if (!caller) {
            GrammarCompiler_1.grammarError(Parser_1.ErrorCode.FunctionNotFound, this.grammar.text, node.meta, node.name);
        }
        else {
            try {
                return caller.apply(null, argVals);
            }
            catch (e) {
                GrammarCompiler_1.grammarError(Parser_1.ErrorCode.CallbackError, this.grammar.text, node.meta, String(e));
            }
        }
    };
    ValueBuilder.prototype.string = function (node) {
        return buildString(node);
    };
    ValueBuilder.prototype.number = function (node) {
        return Number(node.value);
    };
    ValueBuilder.prototype.boolean = function (node) {
        return node.value;
    };
    ValueBuilder.prototype.null = function () {
        return null;
    };
    return ValueBuilder;
}());
exports.ValueBuilder = ValueBuilder;
function buildString(node) {
    return node.tokens.map(function (node) {
        if (node.type == "text") {
            return node.value;
        }
        else if (node.value[0] == 'u') {
            return String.fromCharCode(Number("0x" + node.value.substr(1)));
        }
        else if (node.value.length > 1) {
            Parser_1.parserError(Parser_1.ErrorCode.Unreachable);
        }
        else if ("bfnrt".indexOf(node.value) >= 0) {
            return ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[node.value];
        }
        else {
            return node.value;
        }
    }).join("");
}
exports.buildString = buildString;

},{"./GrammarCompiler":3,"./Parser":6}],5:[function(require,module,exports){
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseBuffer = exports.ParseBufferExhaustedError = void 0;
var Parser_1 = require("./Parser");
exports.ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");
var ParseBuffer = /** @class */ (function () {
    function ParseBuffer(textOrSize) {
        this.minSize = 1 * 1024 * 1024;
        this.text = '';
        this.offset = 0;
        this._length = 0;
        this._closed = false;
        if (typeof textOrSize == "string") {
            this.addChunk(textOrSize);
            this.close();
        }
        else if (typeof textOrSize == "number") {
            this.minSize = textOrSize * 1024 * 1024;
        }
    }
    Object.defineProperty(ParseBuffer.prototype, "length", {
        get: function () {
            return this._length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ParseBuffer.prototype, "closed", {
        get: function () {
            return this._closed;
        },
        enumerable: false,
        configurable: true
    });
    ParseBuffer.prototype.addChunk = function (input) {
        var trim = 0;
        if (this.text.length > this.minSize) {
            trim = this.text.length - this.minSize;
        }
        this.text = this.text.substr(trim) + input;
        this.offset += trim;
        this._length += input.length;
    };
    ParseBuffer.prototype.substr = function (startIdx, length) {
        startIdx -= this.offset;
        if (startIdx < 0) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        return this.text.substr(startIdx, length);
    };
    ParseBuffer.prototype.substrExact = function (startIdx, length) {
        var s = this.substr(startIdx, length);
        if (s.length != length) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return s;
        }
    };
    ParseBuffer.prototype.containsAt = function (text, idx) {
        return text == this.substrExact(idx, text.length);
    };
    ParseBuffer.prototype.charAt = function (idx) {
        idx -= this.offset;
        if (idx >= this.text.length) {
            throw exports.ParseBufferExhaustedError;
        }
        else if (idx < 0) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        else {
            return this.text[idx];
        }
    };
    ParseBuffer.prototype.findLineAndChar = function (pos) {
        var e_1, _a;
        var lineText = '';
        var line = 0;
        pos -= this.offset;
        try {
            for (var _b = __values(this.text.split('\n')), _c = _b.next(); !_c.done; _c = _b.next()) {
                lineText = _c.value;
                line++;
                if (pos <= lineText.length) {
                    var leading = 0;
                    for (var i = 0; i < pos; i++) {
                        if (lineText[i] == '\t') {
                            leading += 4;
                        }
                        else {
                            leading++;
                        }
                    }
                    var detabbed = lineText.replace(/\t/g, ' '.repeat(4));
                    return {
                        line: this.offset > 0 ? "unknown" : line,
                        char: pos + 1,
                        lineText: detabbed,
                        pointerText: ' '.repeat(leading) + '^'
                    };
                }
                pos -= lineText.length + 1;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: this.offset > 0 ? "unknown" : line,
            char: lineText.length,
            lineText: lineText,
            pointerText: ' '.repeat(lineText.length) + '^'
        };
    };
    ParseBuffer.prototype.close = function () {
        this._closed = true;
    };
    return ParseBuffer;
}());
exports.ParseBuffer = ParseBuffer;

},{"./Parser":6}],6:[function(require,module,exports){
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.lastParser = exports.parseGrammar = exports.findDezentGrammar = exports.BufferEmpty = exports.errorMessages = exports.ErrorCode = void 0;
var Grammar_1 = require("./Grammar");
var ParseBuffer_1 = require("./ParseBuffer");
var GrammarCompiler_1 = require("./GrammarCompiler");
var Output_1 = require("./Output");
var ErrorCode;
(function (ErrorCode) {
    ErrorCode[ErrorCode["TextParsingError"] = 1] = "TextParsingError";
    ErrorCode[ErrorCode["GrammarParsingError"] = 2] = "GrammarParsingError";
    ErrorCode[ErrorCode["DuplicateDefine"] = 1001] = "DuplicateDefine";
    ErrorCode[ErrorCode["MultipleReturn"] = 1002] = "MultipleReturn";
    ErrorCode[ErrorCode["RuleNotFound"] = 1003] = "RuleNotFound";
    ErrorCode[ErrorCode["InvalidSpread"] = 1004] = "InvalidSpread";
    ErrorCode[ErrorCode["ReturnNotFound"] = 1005] = "ReturnNotFound";
    ErrorCode[ErrorCode["CaptureCountMismatch"] = 1006] = "CaptureCountMismatch";
    ErrorCode[ErrorCode["InvalidBackRef"] = 1007] = "InvalidBackRef";
    ErrorCode[ErrorCode["InvalidConstRef"] = 1008] = "InvalidConstRef";
    ErrorCode[ErrorCode["FunctionNotFound"] = 1009] = "FunctionNotFound";
    ErrorCode[ErrorCode["CallbackError"] = 1010] = "CallbackError";
    ErrorCode[ErrorCode["InvalidObjectTuple"] = 1011] = "InvalidObjectTuple";
    ErrorCode[ErrorCode["InvalidAccessRoot"] = 1012] = "InvalidAccessRoot";
    ErrorCode[ErrorCode["InvalidAccessIndex"] = 1013] = "InvalidAccessIndex";
    ErrorCode[ErrorCode["InvalidAccessProperty"] = 1014] = "InvalidAccessProperty";
    ErrorCode[ErrorCode["UnknownPragma"] = 1015] = "UnknownPragma";
    ErrorCode[ErrorCode["ArrayOverrun"] = 2001] = "ArrayOverrun";
    ErrorCode[ErrorCode["MismatchOutputFrames"] = 2002] = "MismatchOutputFrames";
    ErrorCode[ErrorCode["CaptureAlreadyInProgress"] = 2003] = "CaptureAlreadyInProgress";
    ErrorCode[ErrorCode["MismatchEndCapture"] = 2004] = "MismatchEndCapture";
    ErrorCode[ErrorCode["EmptyOutput"] = 2005] = "EmptyOutput";
    ErrorCode[ErrorCode["Unreachable"] = 2006] = "Unreachable";
    ErrorCode[ErrorCode["BackRefNotFound"] = 2007] = "BackRefNotFound";
    ErrorCode[ErrorCode["CaptureOutputNotFound"] = 2008] = "CaptureOutputNotFound";
    ErrorCode[ErrorCode["InputConsumedBeforeResult"] = 2009] = "InputConsumedBeforeResult";
    ErrorCode[ErrorCode["MultipleOutputsForCapture"] = 2010] = "MultipleOutputsForCapture";
    ErrorCode[ErrorCode["AssertionFailure"] = 2011] = "AssertionFailure";
    ErrorCode[ErrorCode["InputFreed"] = 2012] = "InputFreed";
})(ErrorCode = exports.ErrorCode || (exports.ErrorCode = {}));
exports.errorMessages = {
    1: "Parse failed: $3\nAt line $1 char $2:\n$4\n$5",
    2: "Error parsing grammar: $3\nAt line $1 char $2:\n$4\n$5",
    1001: "Multiple rules defined with the same name: $1",
    1002: "Grammars are only allowed to have one return statement",
    1003: "Grammar does not contain a rule named '$1'",
    1004: "Spread argument is neither an array nor object: $1",
    1005: "Grammar does not contain a return rule",
    1006: "All options within a rule must have the same number of captures",
    1007: "Invalid back reference: $$1",
    1008: "Invalid variable reference: $$1",
    1009: "Function not found: $1",
    1010: "Error executing callback: $1",
    1011: "When spreading an array into an object, array elements must be arrays of length 2 but instead received: $1",
    1012: "Attempted to access property of non-object value: $1",
    1013: "Attempted to access property using a key that was not a string or number: $1",
    1014: "Attempted to access a property that doesn't exist: $1",
    1015: "Unknown pragma: $1",
    2001: "Array overrun",
    2002: "Mismatched output frames",
    2003: "Capture already in progress",
    2004: "Mismatched ending capture",
    2005: "Output frame did not contain an output token",
    2006: "Should not be possible to reach this code",
    2007: "Back reference does not exist",
    2008: "No output was found during capture",
    2009: "The result does not start at input index 0",
    2010: "Multiple outputs were found for a non-repeating capture",
    2011: "Assertion failed",
    2012: "Input text was referenced (perhaps via $0?) but has already released to free memory. Try increasing minBufferSizeInMB.",
};
exports.BufferEmpty = { toString: function () { return "BufferEmpty"; } };
var dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseGrammar(text, options) {
    var buf = new ParseBuffer_1.ParseBuffer(text);
    var parser = new Parser(findDezentGrammar(), buf, options);
    try {
        var grammar = parser.parse();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text);
        return grammar;
    }
    catch (e) {
        parser.dumpDebug();
        if (e["code"] == ErrorCode.TextParsingError) {
            parsingError(ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        }
        else {
            throw e;
        }
    }
}
exports.parseGrammar = parseGrammar;
exports.lastParser = null; // for testing purposes
var Parser = /** @class */ (function () {
    function Parser(grammar, buffer, options) {
        var e_1, _a;
        this.current = null;
        this.omitFails = 0;
        this.debugLog = [];
        this.errorPos = 0;
        this.failedPatterns = [];
        exports.lastParser = this;
        this.grammar = grammar;
        var root;
        try {
            for (var _b = __values(grammar.ruleset), _c = _b.next(); !_c.done; _c = _b.next()) {
                var ruleset = _c.value;
                if (ruleset.name == 'return') {
                    root = ruleset;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (!root) {
            GrammarCompiler_1.grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }
        this.root = root;
        this.buffer = buffer;
        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (var pragma in grammar.pragmas) {
            GrammarCompiler_1.grammarError(ErrorCode.UnknownPragma, pragma);
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (var option in options) {
            this.options[option] = options[option];
        }
        this.valueBuilder = new Output_1.ValueBuilder(grammar, this.options.callbacks);
        this.callFrame(root);
    }
    Parser.prototype.run = function () {
        var _a, _b;
        var current;
        CURRENT: while (current = this.current) {
            if (current.complete) {
                if (!current.caller) {
                    // our parsing is complete
                    // in the case of streaming, if we get a parse error we want to bail
                    // before close, i.e. as soon as the parse error happens. So do this
                    // check prior to checking for BufferEmpty.
                    if (!current.matched) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                    }
                    if (!this.buffer.closed) {
                        if (current.consumed == this.buffer.length) {
                            // give our upstream caller a chance to close() the buffer
                            return exports.BufferEmpty;
                        }
                        else {
                            parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                        }
                    }
                    if (current.pos != 0) {
                        parserError(ErrorCode.InputConsumedBeforeResult);
                    }
                    if (!current.output) {
                        parserError(ErrorCode.EmptyOutput);
                    }
                    if (current.output.length < this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, this.expectedTerminals());
                    }
                    if (current.output.length > this.buffer.length) {
                        parsingError(ErrorCode.TextParsingError, this.buffer, this.errorPos, ["<EOF>"]);
                    }
                    if (this.options.dumpDebug) {
                        this.dumpDebug();
                    }
                    return current.output.value;
                }
                if (this.options.debugErrors) {
                    this.debugLog.push([
                        current.matched ? 'PASS ' : 'FAIL ',
                        this.buffer.substr(current.pos, 20),
                        current.ruleset ? current.ruleset.name : current.selector.type,
                        JSON.stringify(current.ruleset ? current.output : current.captures)
                    ]);
                }
                this.current = current.caller;
                current.caller = null;
                continue CURRENT;
            }
            var descriptor = current.token.descriptor;
            var matched = false, consumed = 0;
            do {
                var callee = void 0;
                var consumedPos = current.pos + current.consumed;
                if (descriptor.match) {
                    try {
                        _a = __read(descriptor.match(this.buffer, consumedPos), 2), matched = _a[0], consumed = _a[1];
                    }
                    catch (e) {
                        if (this.buffer.closed && e == ParseBuffer_1.ParseBufferExhaustedError) {
                            _b = __read([false, 0], 2), matched = _b[0], consumed = _b[1];
                        }
                        else if (e == ParseBuffer_1.ParseBufferExhaustedError) {
                            return exports.BufferEmpty;
                        }
                        else {
                            throw e;
                        }
                    }
                }
                else if (!current.callee) {
                    var calleeNode = (descriptor.type == "ruleref" ? this.rulesets[descriptor.name] : descriptor);
                    this.callFrame(calleeNode);
                    if (!calleeNode.canFail) {
                        this.omitFails++;
                    }
                    continue CURRENT;
                }
                else {
                    callee = current.callee;
                    current.callee = null;
                    matched = callee.matched;
                    consumed = callee.consumed;
                    if ((callee.ruleset && !callee.ruleset.canFail) || (callee.selector && !callee.selector.canFail)) {
                        this.omitFails--;
                    }
                }
                // see notes on left recursion toward the beginning of this file
                if (current.leftRecursing) {
                    // it's possible to get a match without consuming more input than previous
                    // recursion attempts, so make sure there's increased consumption, too.
                    if (matched && (current.leftReturn == null || consumed > current.leftReturn.consumed)) {
                        // stow away our returning callee for later use in the next recursion iteration
                        current.leftReturn = callee;
                    }
                    else {
                        // at this point our left recursion is failing to consumer more input,
                        // time to wrap things up
                        current.complete = true;
                        if (current.leftReturn) {
                            // we found the largest match for this recursing rule on a previous iteration.
                            // use that as the return value for this frame.
                            current.matched = true;
                            current.consumed = current.leftReturn.consumed;
                            current.output = current.leftReturn.output;
                        }
                    }
                    continue CURRENT;
                }
                if (current.token.and || current.token.not) {
                    matched = (current.token.and && matched) || (current.token.not && !matched);
                    consumed = 0;
                }
                if (this.options.debugErrors && !callee) {
                    this.debugLog.push([
                        matched ? 'PASS ' : 'FAIL ',
                        this.buffer.substr(consumedPos, 20),
                        descriptor["pattern"]
                    ]);
                }
                if (current.token.required && !matched
                    // + modifiers repeat and are required, so we only fail when we haven't consumed...
                    && consumedPos - current.tokenPos == 0) {
                    // our token failed, therefore the pattern fails
                    if (consumedPos >= this.errorPos && !this.omitFails && descriptor.pattern) {
                        if (consumedPos > this.errorPos) {
                            this.failedPatterns.length = 0;
                            this.errorPos = consumedPos;
                        }
                        var pattern = descriptor.pattern;
                        if (current.token.not)
                            pattern = 'not: ' + pattern;
                        this.failedPatterns.push(pattern);
                    }
                    current.consumed = 0;
                    if (++current.patternIndex >= current.selector.patterns.length) {
                        // no matching pattern - go to next rule if applicable, or fail if not
                        if (current.ruleset) {
                            this.nextRule(current);
                        }
                        else {
                            current.complete = true;
                        }
                    }
                    else {
                        current.pattern = current.selector.patterns[current.patternIndex];
                        current.tokenIndex = 0;
                        current.token = current.pattern.tokens[0];
                    }
                    continue CURRENT;
                }
                if (matched) {
                    current.consumed += consumed;
                    if (current.selector.type == "capture") {
                        if (callee && callee.output && callee.ruleset && current.pattern.tokens.length == 1) {
                            // output has descended the stack to our capture - capture it
                            // but only if it's the only node in this capture
                            current.output = callee.output;
                        }
                    }
                    else if (callee && callee.captures) {
                        // captures need to descend the stack
                        if (current.captures) {
                            current.captures = current.captures.concat(callee.captures);
                        }
                        else {
                            current.captures = callee.captures;
                        }
                    }
                }
                else if (descriptor.type == "capture" && !current.token.required && !current.token.repeat) {
                    // a failed non-required non-repeating capture should yield null
                    var output = {
                        captureIndex: descriptor.index,
                        position: consumedPos,
                        length: 0,
                        value: null
                    };
                    if (current.captures) {
                        current.captures.push(output);
                    }
                    else {
                        current.captures = [output];
                    }
                }
                // don't continue STACK here because a) we may be a repeating token
                // and b) we need to increment tokenIndex below.
            } while (matched && current.token.repeat && consumed > 0); // make sure we consumed to avoid infinite loops
            if (++current.tokenIndex < current.pattern.tokens.length) {
                current.token = current.pattern.tokens[current.tokenIndex];
                current.tokenPos = current.pos + current.consumed;
            }
            else {
                // we got through all tokens successfully - pass!
                current.matched = true;
                current.complete = true;
                if (current.ruleset) {
                    if (current.selector.hasBackref0) {
                        // create a capture for $0 backref
                        if (!current.captures)
                            current.captures = [];
                        current.captures.push({
                            captureIndex: 0,
                            position: current.pos,
                            length: current.consumed,
                            value: this.buffer.substr(current.pos, current.consumed),
                        });
                    }
                    // always build the value so that output callbacks can be called
                    // even if the grammar returns null
                    var value = this.valueBuilder.buildValue(current);
                    // prevent captures from continuing to descend
                    current.captures = null;
                    if (current.wantOutput || (current.ruleset && current.ruleset.name == "return")) {
                        // our ruleset was called up the stack by a capture - create an output (which will descend the stack)
                        current.output = {
                            position: current.pos,
                            length: current.consumed,
                            value: value
                        };
                    }
                }
                else if (current.selector.type == "capture") {
                    var output = current.output;
                    if (!output) {
                        // create a capture text segment - based on our current node, not the callee
                        output = {
                            position: current.pos,
                            length: current.consumed,
                            value: this.buffer.substr(current.pos, current.consumed),
                        };
                    }
                    output.captureIndex = current.selector.index;
                    if (current.captures) {
                        current.captures.push(output);
                    }
                    else {
                        current.captures = [output];
                    }
                }
            }
            continue CURRENT; // redundant; for clarity
        }
    };
    Parser.prototype.expectedTerminals = function () {
        var e_2, _a;
        var lookup = {};
        var out = [];
        try {
            for (var _b = __values(this.failedPatterns), _c = _b.next(); !_c.done; _c = _b.next()) {
                var terminal = _c.value;
                if (!lookup[terminal]) {
                    out.push(terminal);
                    lookup[terminal] = true;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return out;
    };
    Parser.prototype.nextRule = function (frame) {
        frame.ruleIndex++;
        frame.selector = frame.ruleset.rules[frame.ruleIndex];
        frame.callee = null;
        if (!frame.selector) {
            frame.complete = true;
        }
        else {
            frame.patternIndex = 0;
            frame.pattern = frame.selector.patterns[0];
            frame.tokenIndex = 0;
            frame.token = frame.pattern.tokens[0];
            if (frame.captures)
                frame.captures.length = 0;
        }
    };
    Parser.prototype.parse = function () {
        if (this.error) {
            throw this.error;
        }
        try {
            var result = this.run();
            if (result == exports.BufferEmpty) {
                assert(!this.buffer.closed);
                return undefined;
            }
            else {
                return result;
            }
        }
        catch (e) {
            assert(e != ParseBuffer_1.ParseBufferExhaustedError);
            this.dumpDebug();
            this.error = e;
            throw e;
        }
    };
    Parser.prototype.callFrame = function (callee) {
        var pos = this.current ? this.current.pos + this.current.consumed : 0;
        var cacheKey = pos * this.grammar.maxid + callee.id;
        var recursed;
        var check = this.current;
        if (check && callee.type == "ruleset")
            do {
                if (check.ruleset && check.ruleset.name == callee.name) {
                    recursed = check;
                    break;
                }
            } while (check.caller && check.pos == check.caller.pos && (check = check.caller));
        var frame;
        var secondFrame;
        if (recursed) {
            // left recursion detected - see notes near the top of this file
            frame = Object.assign({}, recursed);
            if (recursed.leftRecursing) {
                // this is the second or later recursion iteration.
                // set up the base frame's previous returning callee
                // as our callee now so it can properly recurse.
                frame.leftRecursing = false;
                frame.callee = frame.leftReturn;
                frame.leftReturn = null;
                this.current.callee = frame;
                frame.caller = this.current;
                frame.callee.caller = frame;
                this.current = secondFrame = frame.callee;
            }
            else {
                // this is the first recursion iteration - get ourselves ready
                // to work through multiple recursion iterations by marking our
                // base frame as left recursing and advancing our new frame to
                // avoid infinite loop.
                this.nextRule(frame);
                recursed.leftRecursing = true;
                this.current.callee = frame;
                frame.caller = this.current;
                this.current = frame;
            }
        }
        else if (!frame) {
            var selector = callee.type == "ruleset" ? callee.rules[0] : callee;
            var pattern = selector.patterns[0];
            frame = {
                matched: false,
                complete: false,
                ruleset: callee.type == "ruleset" ? callee : null,
                ruleIndex: 0,
                selector: selector,
                patternIndex: 0,
                pattern: pattern,
                tokenIndex: 0,
                token: pattern.tokens[0],
                pos: pos,
                tokenPos: pos,
                consumed: 0,
                caller: this.current,
                callee: null,
                wantOutput: this.current && (this.current.selector.type == "capture" || this.current.wantOutput),
                output: null,
                captures: null,
                cacheKey: cacheKey,
                leftRecursing: false,
                leftReturn: null,
            };
            if (this.current)
                this.current.callee = frame;
            this.current = frame;
        }
        if (this.options.debugErrors) {
            this.debugLog.push([
                'enter',
                this.buffer.substr(frame.pos, 20),
                frame.ruleset ? frame.ruleset.name : frame.selector.type
            ]);
            if (secondFrame) {
                this.debugLog.push([
                    'enter',
                    this.buffer.substr(secondFrame.pos, 20),
                    secondFrame.ruleset ? secondFrame.ruleset.name : secondFrame.selector.type
                ]);
            }
        }
    };
    Parser.prototype.dumpDebug = function () {
        var e_3, _a;
        if (this.options.debugErrors) {
            var lines = [];
            try {
                for (var _b = __values(this.debugLog), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var msg = _c.value;
                    lines.push(msg.join('\t').replace(/\n/g, '\\n'));
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_3) throw e_3.error; }
            }
            console.log("Debug log:\n", lines.join("\n"));
        }
    };
    return Parser;
}());
exports.Parser = Parser;
function parserError(code) {
    var msg = exports.errorMessages[code];
    var e = new Error("Internal parser error " + code + ": " + msg);
    e["code"] = code;
    throw e;
}
exports.parserError = parserError;
function assert(condition) {
    if (!condition) {
        debugger;
        parserError(ErrorCode.AssertionFailure);
    }
}
exports.assert = assert;
function parsingError(code, buf, pos, expected) {
    expected = expected.map(function (i) { return i.replace(/\n/g, '\\n'); });
    var list = [].join.call(expected, '\n\t');
    var reason = expected.length == 1 ? "expected: " + list : "expected one of the following: \n\t" + list;
    var info = buf.findLineAndChar(pos);
    var backrefs = [null, info.line, info.char, reason, info.lineText, info.pointerText];
    var msg = exports.errorMessages[code].replace(/\$([0-9])/g, function (match, index) { return String(backrefs[index]); });
    var e = new Error(msg);
    e["code"] = code;
    e["pos"] = pos;
    e["line"] = info.line;
    e["char"] = info.char;
    e["lineText"] = info.lineText;
    e["pointerText"] = info.pointerText;
    e["reason"] = reason;
    e["expected"] = expected;
    throw e;
}
exports.parsingError = parsingError;

},{"./Grammar":2,"./GrammarCompiler":3,"./Output":4,"./ParseBuffer":5}],7:[function(require,module,exports){

let mod = require("./Dezent");
window.Dezent = mod.Dezent;
window.DezentStream = mod.DezentStream;

},{"./Dezent":1}]},{},[7]);
