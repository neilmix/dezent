"use strict";
/*
 *  Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *  Copyright (C) 2020  Neil Mix  <neilmix@gmail.com>
 *  Commercial licensing and support are available, please contact neilmix@gmail.com.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
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
            returndef("_ ( {returndef|ruleset} _ | {constant} _ | {pragma} _ )*", { ruleset: "$1", vars: { '...$2': '' }, pragmas: { '...$3': '' } }),
            ruleset('_', "( singleLineComment | multiLineComment | whitespace? )*", null),
            ruleset('singleLineComment', "'//' ( !'\\n' . )* '\\n'", null),
            ruleset('multiLineComment', "'/*' ( !'*/' . )* '*/'", null),
            ruleset('whitespace', "[\\u0020\\t-\\r]+", null),
            ruleset('returndef', "'return' whitespace _ {rule} _ ';'", { type: 'ruleset', name: 'return', rules: ['$1'], '...$meta': '' }),
            ruleset('ruleset', "{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'", { type: 'ruleset', name: '$1', rules: ['$2', '...$3'], '...$meta': '' }),
            ruleset('constant', "'$' {identifier} _ '=' _ {value} _ ';'", ['$1', '$2']),
            ruleset('pragma', "'#' {'enableCache'} _ 'true' '\\n'", ['$1', true], "'#' {'enableCache'} _ 'false' '\\n'", ['$1', false]),
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
            ruleset('value', "{backref|constref|metaref|pivot|object|array|call|string|number|boolean|null}", '$1'),
            ruleset('backref', "'$' {[0-9]+} '?' {access}", { type: 'backref', index: '$1', collapse: true, access: '$2', '...$meta': '' }, "'$' {[0-9]+} {access}", { type: 'backref', index: '$1', collapse: false, access: '$2', '...$meta': '' }),
            ruleset('constref', "'$' {identifier} {access}", { type: 'constref', name: '$1', access: '$2', '...$meta': '' }),
            ruleset('metaref', "'@' {'position'|'length'}", { type: 'metaref', name: '$1' }),
            ruleset('pivot', "'^' {backref|constref|array|pivot}", { type: 'pivot', value: '$1', '...$meta': '' }),
            ruleset('spread', "'...' {backref|constref|pivot|object|array|string}", { type: 'spread', value: '$1', '...$meta': '' }),
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
        pragmas: {
            enableCache: false
        }
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
        rules: rules
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
