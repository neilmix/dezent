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
exports.createUncompiledDezentGrammar = exports.GrammarDefaultCallbacks = exports.GrammarVersion = void 0;
exports.GrammarVersion = 1;
exports.GrammarDefaultCallbacks = {
    pivot: (value) => {
        if (!Array.isArray(value)) {
            throw new Error("Invalid pivot argment: " + value);
        }
        value.map((item) => {
            if (!Array.isArray(item)) {
                throw new Error("Invalid pivot argument: " + JSON.stringify(item));
            }
            if (item.length != value[0].length) {
                throw new Error("All subarrays in a pivot must be of the same length");
            }
        });
        let ret = [];
        for (let item of value[0]) {
            ret.push([]);
        }
        for (let i = 0; i < value.length; i++) {
            for (let j = 0; j < value[0].length; j++) {
                ret[j][i] = value[i][j];
            }
        }
        return ret;
    }
};
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
            returndef(`_ ( {returndef|ruleset} _ | {constant} _ )*`, { ruleset: "$1", vars: { '...$2': '' }, pragmas: {} }),
            ruleset('_', `( singleLineComment | multiLineComment | whitespace? )*`, null),
            ruleset('singleLineComment', `'//' ( !'\\n' . )* '\\n'`, null),
            ruleset('multiLineComment', `'/*' ( !'*/' . )* '*/'`, null),
            ruleset('whitespace', `[\\u0020\\t-\\r]+`, null),
            ruleset('returndef', `'return' whitespace _ {rule} _ ';'`, { type: 'ruleset', name: 'return', rules: ['$1'], '...$meta': '' }),
            ruleset('ruleset', `{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'`, { type: 'ruleset', name: '$1', rules: ['$2', '...$3'], '...$meta': '' }),
            ruleset('constant', `'$' {identifier} _ '=' _ {value} _ ';'`, ['$1', '$2']),
            ruleset('rule', `{patterns} _ '->' _ {value}`, { type: 'rule', '...$1': '', value: '$2', '...$meta': '' }),
            ruleset('patterns', `{pattern} _ ( '|' _ {pattern} _ )*`, { patterns: ['$1', '...$2'] }),
            ruleset('pattern', `( {token} _ )+`, { type: 'pattern', tokens: '$1' }),
            ruleset('token', `{predicate} {capture|group|string|class|ruleref|any} {modifier}`, { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
            ruleset('capture', `'{' _ {capturePatterns} _ '}'`, { type: 'capture', '...$1': '' }),
            ruleset('group', `'(' _ {patterns} _ ')'`, { type: 'group', '...$1': '' }),
            ruleset('capturePatterns', `{capturePattern} _ ( '|' _ {capturePattern} _ )*`, { patterns: ['$1', '...$2'] }),
            ruleset('capturePattern', `( {captureToken} _ )+`, { type: 'pattern', tokens: '$1' }),
            ruleset('captureToken', `{predicate} {captureGroup|string|class|ruleref|any} {modifier}`, { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
            ruleset('captureGroup', `'(' _ {capturePatterns} _ ')'`, { type: 'group', '...$1': '' }),
            ruleset('class', `'[' {classComponent}* ']'`, { type: 'class', ranges: '$1' }),
            ruleset('classComponent', `{classChar} '-' {classChar}`, ['$1', '$2'], `{classChar}`, ['$1', '$1']),
            ruleset('classChar', `!']' {escape|char}`, '$1'),
            ruleset('char', `charstr`, { type: 'char', value: '$0' }),
            ruleset('any', `'.'`, { type: 'any' }),
            ruleset('ruleref', `{identifier}`, { type: 'ruleref', name: '$1', '...$meta': '' }),
            ruleset('predicate', `'&'`, { and: true, not: false }, `'!'`, { and: false, not: true }, `''`, { and: false, not: false }),
            ruleset('modifier', `'*'`, { repeat: true, required: false }, `'+'`, { repeat: true, required: true }, `'?'`, { repeat: false, required: false }, `''`, { repeat: false, required: true }),
            ruleset('value', `{backref|constref|metaref|object|array|call|string|number|boolean|null}`, '$1'),
            ruleset('backref', `'$' {[0-9]+} '?' {access}`, { type: 'backref', index: '$1', collapse: true, access: '$2', '...$meta': '' }, `'$' {[0-9]+} {access}`, { type: 'backref', index: '$1', collapse: false, access: '$2', '...$meta': '' }),
            ruleset('constref', `'$' {identifier} {access}`, { type: 'constref', name: '$1', access: '$2', '...$meta': '' }),
            ruleset('metaref', `'@' {'position'|'length'}`, { type: 'metaref', name: '$1' }),
            ruleset('spread', `'...' {backref|constref|object|array|string|call}`, { type: 'spread', value: '$1', '...$meta': '' }),
            ruleset('object', `'{' ( _ {member} _ ',' )* _ {member}? _ '}' {access}`, { type: 'object', members: ['...$1', '$2?'], access: '$3' }),
            ruleset('member', `{spread}`, '$1', `{backref|string|identifierAsStringNode} _ ':' _ {value}`, { type: 'member', name: '$1', value: '$2' }),
            ruleset('array', `'[' ( _ {element} _ ',' )* _ {element}? _ ']' {access}`, { type: 'array', elements: ['...$1', '$2?'], access: '$3' }),
            ruleset('element', `{value|spread}`, '$1'),
            ruleset('call', `{identifier} _ '(' ( _ {value} _ ',' )* _ {value}? _ ')'`, { type: 'call', name: '$1', args: ['...$2', '$3?'], '...$meta': '' }),
            ruleset('string', `'\\'' {escape|stringText}* '\\''`, { type: 'string', tokens: '$1' }),
            ruleset('stringText', `( !['\\\\] . )+`, { type: 'text', value: '$0' }),
            ruleset('number', `'-'? ( [0-9]+ )? '.' [0-9]+ ( [eE] [-+] [0-9]+ )?`, { type: 'number', value: '$0' }, `'-'? [0-9]+ ( [eE] [-+] [0-9]+ )?`, { type: 'number', value: '$0' }),
            ruleset('boolean', `'true'`, { type: 'boolean', value: true }, `'false'`, { type: 'boolean', value: false }),
            ruleset('null', `'null'`, { type: 'null' }),
            ruleset('access', `{dotAccess|bracketAccess}*`, '$1'),
            ruleset('dotAccess', `'.' {identifier}`, { name: '$1', '...$meta': '' }),
            ruleset('bracketAccess', `'[' _ {backref|constref|metaref|string|index} _ ']'`, { value: '$1', '...$meta': '' }),
            ruleset('index', `[0-9]+`, { type: 'number', value: '$0' }),
            ruleset('escape', `'\\\\' {unicode|charstr}`, { type: 'escape', value: '$1' }),
            ruleset('unicode', `'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9]`, '$0'),
            ruleset('charstr', `!'\\n' .`, '$0'),
            ruleset('identifier', `[_a-zA-Z] [_a-zA-Z0-9]*`, '$0'),
            ruleset('identifierAsStringNode', `{identifier}`, { type: 'string', tokens: [{ type: 'text', value: '$1' }] }),
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
function ruleset(name, ...args) {
    let rules = [];
    for (let i = 0; i < args.length; i += 2) {
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
    let tokens = [];
    for (let i = 0; i < tokStrs.length; i++) {
        let tokStr = tokStrs[i];
        let node;
        let and = tokStr[0] == '&';
        let not = tokStr[0] == '!';
        if (and || not) {
            tokStr = tokStr.substr(1);
        }
        let required = true, repeat = false;
        if (tokStr == '(') {
            let j = i;
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
                    case `'`:
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
    let patterns = [];
    let lastOr = -1;
    for (let i = 0; i < tokens.length; i++) {
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
    let repeat = null;
    token = token.substr(0, token.length - 1);
    let patterns = token.substr(1, token.length - 1).split('|');
    return {
        type: 'capture',
        patterns: patterns.map((t) => pattern([t])),
    };
}
function charClass(token) {
    let ranges = [];
    let j = 1;
    let parseBound = () => {
        let bound;
        if (token[j] == '\\') {
            j++;
            let value = token[j] == 'u' ? token.substr(j, 5) : token[j];
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
        let start = parseBound();
        let end;
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
        throw new Error(`invalid identifier: ${token}`);
    }
    return {
        type: 'ruleref',
        name: token
    };
}
function output(value) {
    switch (typeof value) {
        case 'object':
            if (value === null) {
                return { type: 'null' };
            }
            else if (Array.isArray(value)) {
                let ret = [];
                for (let elem of value) {
                    let out = output(elem);
                    ret.push(out);
                }
                return {
                    type: 'array',
                    elements: ret,
                    access: []
                };
            }
            else {
                let members = [];
                for (let name in value) {
                    if (name.startsWith('...')) {
                        // spread
                        members.push(output(name));
                    }
                    else {
                        members.push({
                            type: 'member',
                            name: output(name),
                            value: output(value[name])
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
                let ref = function (name) {
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
