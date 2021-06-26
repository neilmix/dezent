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
const Parser_1 = require("./Parser");
const ParseBuffer_1 = require("./ParseBuffer");
class Dezent {
    constructor(grammarStr, options) {
        this.grammar = Parser_1.parseGrammar(grammarStr, grammarOptions(options));
        this.options = options || {};
        this.error = null;
    }
    parse(text) {
        try {
            let stream = new DezentStream(this.grammar, this.options);
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
    }
}
exports.Dezent = Dezent;
class DezentStream {
    constructor(grammar, options) {
        this.options = options || {};
        this.buffer = new ParseBuffer_1.ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? Parser_1.parseGrammar(grammar, grammarOptions(this.options)) : grammar;
        this.parser = new Parser_1.Parser(grammar, this.buffer, this.options);
    }
    write(text) {
        this.buffer.addChunk(text);
        this.parser.parse();
    }
    close() {
        this.buffer.close();
        return this.parser.parse();
    }
}
exports.DezentStream = DezentStream;
function grammarOptions(opt) {
    // don't dumpDebug when parsing the grammar
    let gOpt = Object.assign({}, opt);
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.grammarError = exports.GrammarCompiler = void 0;
const Parser_1 = require("./Parser");
const ParseBuffer_1 = require("./ParseBuffer");
const Grammar_1 = require("./Grammar");
const Output_1 = require("./Output");
class GrammarCompiler {
    static compileGrammar(grammar, text) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // - other helpful sanity checks
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        grammar.version = Grammar_1.GrammarVersion;
        grammar.text = text;
        let rulesetLookup = grammar.rulesetLookup = {};
        for (let ruleset of grammar.ruleset) {
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
        let nodeSequence = 0;
        for (let ruleset of grammar.ruleset) {
            let rules = ruleset.rules;
            for (let i = 0; i < rules.length; i++) {
                rules[i].rulesetName = ruleset["name"] || "return";
                rules[i].rulesetIndex = i;
                rules[i].captures = this.compileRule(rules[i], grammar.vars, text);
            }
            // assign an id to every node
            visitParseNodes(null, ruleset, null, (node) => {
                node.id = ++nodeSequence;
            }, null);
            // perform sanity checks
            visitParseNodes("ruleref", ruleset, null, null, (node) => {
                if (!rulesetLookup[node.name]) {
                    grammarError(Parser_1.ErrorCode.RuleNotFound, text, node.meta, node.name);
                }
            });
            // figure out if our selectors are capable of failing, which helps in
            // identifying expected tokens for good error messaging.
            visitParseNodes("pattern", ruleset, null, null, (node) => {
                for (let token of node.tokens) {
                    if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                        node.canFail = true;
                        return;
                    }
                }
                node.canFail = false;
            });
            visitParseNodes(["capture", "group", "rule"], ruleset, null, null, (node) => {
                node.canFail = true;
                for (let pattern of node.patterns) {
                    if (!pattern.canFail) {
                        node.canFail = false;
                        break;
                    }
                }
            });
            if (ruleset.name == 'return') {
                ruleset.canFail = true;
            }
            else {
                ruleset.canFail = true;
                for (let rule of ruleset.rules) {
                    if (!rule.canFail) {
                        ruleset.canFail = false;
                        break;
                    }
                }
            }
        }
        grammar.maxid = nodeSequence;
        return grammar;
    }
    static compileRule(rule, vars, text) {
        // put an empty placeholder in captures so that the indices
        // align with backrefs (which begin at 1)
        let info = { captures: [null], repeats: 0, backrefs: [null] };
        let i = 0;
        let lastCount = -1;
        do {
            info.captures = [null];
            visitParseNodes("token", rule.patterns[i], info, (node, info) => {
                if (node.repeat)
                    info.repeats++;
                if (node.descriptor.type == "capture") {
                    node.descriptor.index = info.captures.length;
                    info.captures.push(info.repeats > 0);
                }
            }, (node, info) => {
                if (node.repeat)
                    info.repeats--;
            });
            if (lastCount > -1 && lastCount != info.captures.length) {
                grammarError(Parser_1.ErrorCode.CaptureCountMismatch, text, rule.meta);
            }
            lastCount = info.captures.length;
            i++;
        } while (i < rule.patterns.length);
        visitParseNodes("string", rule, null, null, (node) => {
            let matchString = Output_1.buildString(node);
            node.pattern = matchString;
            node.match = (buf, idx) => buf.containsAt(matchString, idx) ? [true, matchString.length] : [false, 0];
        });
        visitParseNodes("class", rule, null, null, (node) => {
            for (let range of node.ranges) {
                range.map((bound) => {
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
            node.pattern = node.ranges.map((i) => {
                let ret = (i[0].type == 'escape' ? '\\' : '') + i[0].value;
                if (i[0].value != i[1].value) {
                    ret += '-';
                    ret += (i[1].type == 'escape' ? '\\' : '') + i[1].value;
                }
                return ret;
            }).join(' ');
            node.match = (buf, idx) => {
                let c = buf.charAt(idx);
                for (let range of node.ranges) {
                    if (c >= range[0].match && c <= range[1].match) {
                        return [true, 1];
                    }
                }
                return [false, 0];
            };
        });
        visitParseNodes("any", rule, null, null, (node) => {
            node.match = (buf, idx) => {
                return buf.charAt(idx) ? [true, 1] : [false, 0];
            };
            node.pattern = '';
        });
        visitOutputNodes(rule.value, info, (node, info) => {
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
        for (let i = 1; i < info.backrefs.length; i++) {
            if (info.backrefs[i].index >= info.captures.length) {
                grammarError(Parser_1.ErrorCode.InvalidBackRef, text, info.backrefs[i].meta, info.backrefs[i].index);
            }
        }
        return info.captures;
    }
}
exports.GrammarCompiler = GrammarCompiler;
function visitParseNodes(types, root, data, enter, exit) {
    if (typeof types == "string") {
        types = [types];
    }
    if (enter && (types == null || types.includes(root.type))) {
        enter(root, data);
    }
    let items = [];
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
    for (let item of items) {
        visitParseNodes(types, item, data, enter, exit);
    }
    if (exit && (types == null || types.includes(root.type))) {
        exit(root, data);
    }
}
function visitOutputNodes(node, data, f) {
    f(node, data);
    let items;
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
        for (let item of items) {
            visitOutputNodes(item, data, f);
        }
    }
}
function grammarError(code, text, meta, ...args) {
    let reason = Parser_1.errorMessages[code].replace(/\$([0-9])/g, (match, index) => args[index - 1]);
    let msg = `Grammar error ${code}: ${reason}`;
    let info;
    if (text && meta) {
        info = new ParseBuffer_1.ParseBuffer(text).findLineAndChar(meta.pos);
        msg = `${msg}\nAt line ${info.line} char ${info.char}:\n${info.lineText}\n${info.pointerText}\n`;
    }
    let e = new Error(msg);
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildString = exports.ValueBuilder = void 0;
const Parser_1 = require("./Parser");
const GrammarCompiler_1 = require("./GrammarCompiler");
let defaultCallbacks = {
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
class ValueBuilder {
    constructor(grammar, callbacks) {
        this.grammar = grammar;
        this.callbacks = callbacks || {};
    }
    buildValue(frame) {
        let rule = frame.ruleset.rules[frame.ruleIndex];
        let captureValues = rule.captures.map((b) => b === true ? [] : null);
        if (frame.captures)
            for (let capture of frame.captures) {
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
        return this.value(rule.value, captureValues, { position: frame.pos, length: frame.consumed });
    }
    value(node, captureValues, metas) {
        let out = this[node.type](node, captureValues, metas);
        if (node.access)
            for (let prop of node.access) {
                if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                    GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                }
                let index;
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
        return out;
    }
    backref(node, captures) {
        let cap = captures[node.index];
        // n.b. the "repeated" property is added dynamically above
        if (node.collapse && Array.isArray(cap) && cap["repeated"]) {
            let ret = [];
            for (let item of cap) {
                if (item != null) {
                    ret.push(item);
                }
            }
            return ret;
        }
        else {
            return cap;
        }
    }
    constref(node, captures, metas) {
        let resolved = this.grammar.vars[node.name];
        return this.value(resolved, captures, metas);
    }
    metaref(node, captures, metas) {
        return metas[node.name];
    }
    spread(node, captures, metas) {
        let value = this.value(node.value, captures, metas);
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
    }
    object(node, captures, metas) {
        let ret = {};
        for (let member of node.members) {
            if (member.type == "spread") {
                let tuples = this.value(member, captures, metas);
                for (let tuple of tuples) {
                    if (!Array.isArray(tuple) || tuple.length != 2) {
                        GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                    }
                    ret[tuple[0]] = tuple[1];
                }
            }
            else {
                ret[this.value(member.name, captures, metas)]
                    = this.value(member.value, captures, metas);
            }
        }
        return ret;
    }
    array(node, captures, metas) {
        let ret = [];
        for (let elem of node.elements) {
            if (elem.type == "spread") {
                ret = ret.concat(this.value(elem, captures, metas));
            }
            else {
                let val = this.value(elem, captures, metas);
                if (elem.type != "backref" || !elem.collapse || val !== null) {
                    ret.push(val);
                }
            }
        }
        return ret;
    }
    call(node, captures, metas) {
        let argVals = [];
        for (let arg of node.args) {
            argVals.push(this.value(arg, captures, metas));
        }
        let caller = this.callbacks[node.name];
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
    }
    string(node) {
        return buildString(node);
    }
    number(node) {
        return Number(node.value);
    }
    boolean(node) {
        return node.value;
    }
    null() {
        return null;
    }
}
exports.ValueBuilder = ValueBuilder;
function buildString(node) {
    return node.tokens.map((node) => {
        if (node.type == "text") {
            return node.value;
        }
        else if (node.value[0] == 'u') {
            return String.fromCharCode(Number(`0x${node.value.substr(1)}`));
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseBuffer = exports.ParseBufferExhaustedError = void 0;
const Parser_1 = require("./Parser");
exports.ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");
class ParseBuffer {
    constructor(textOrSize) {
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
    get length() {
        return this._length;
    }
    get closed() {
        return this._closed;
    }
    addChunk(input) {
        let trim = 0;
        if (this.text.length > this.minSize) {
            trim = this.text.length - this.minSize;
        }
        this.text = this.text.substr(trim) + input;
        this.offset += trim;
        this._length += input.length;
    }
    substr(startIdx, length) {
        startIdx -= this.offset;
        if (startIdx < 0) {
            Parser_1.parserError(Parser_1.ErrorCode.InputFreed);
        }
        return this.text.substr(startIdx, length);
    }
    substrExact(startIdx, length) {
        let s = this.substr(startIdx, length);
        if (s.length != length) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return s;
        }
    }
    containsAt(text, idx) {
        return text == this.substrExact(idx, text.length);
    }
    charAt(idx) {
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
    }
    findLineAndChar(pos) {
        let lineText = '';
        let line = 0;
        pos -= this.offset;
        for (lineText of this.text.split('\n')) {
            line++;
            if (pos <= lineText.length) {
                let leading = 0;
                for (let i = 0; i < pos; i++) {
                    if (lineText[i] == '\t') {
                        leading += 4;
                    }
                    else {
                        leading++;
                    }
                }
                let detabbed = lineText.replace(/\t/g, ' '.repeat(4));
                return {
                    line: this.offset > 0 ? "unknown" : line,
                    char: pos + 1,
                    lineText: detabbed,
                    pointerText: ' '.repeat(leading) + '^'
                };
            }
            pos -= lineText.length + 1;
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: this.offset > 0 ? "unknown" : line,
            char: lineText.length,
            lineText: lineText,
            pointerText: ' '.repeat(lineText.length) + '^'
        };
    }
    close() {
        this._closed = true;
    }
}
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsingError = exports.assert = exports.parserError = exports.Parser = exports.lastParser = exports.parseGrammar = exports.findDezentGrammar = exports.BufferEmpty = exports.errorMessages = exports.ErrorCode = void 0;
const Grammar_1 = require("./Grammar");
const ParseBuffer_1 = require("./ParseBuffer");
const GrammarCompiler_1 = require("./GrammarCompiler");
const Output_1 = require("./Output");
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
exports.BufferEmpty = { toString: () => "BufferEmpty" };
let dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;
function parseGrammar(text, options) {
    let buf = new ParseBuffer_1.ParseBuffer(text);
    let parser = new Parser(findDezentGrammar(), buf, options);
    try {
        let grammar = parser.parse();
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
class Parser {
    constructor(grammar, buffer, options) {
        this.omitFails = 0;
        this.debugLog = [];
        this.errorPos = 0;
        this.failedPatterns = [];
        this.frameStack = [];
        exports.lastParser = this;
        this.grammar = grammar;
        let root;
        for (let ruleset of grammar.ruleset) {
            if (ruleset.name == 'return') {
                root = ruleset;
            }
        }
        if (!root) {
            GrammarCompiler_1.grammarError(ErrorCode.ReturnNotFound, grammar.text);
        }
        this.root = root;
        this.buffer = buffer;
        this.rulesets = grammar.rulesetLookup;
        this.options = {};
        for (let pragma in grammar.pragmas) {
            GrammarCompiler_1.grammarError(ErrorCode.UnknownPragma, pragma);
            this.options[pragma] = grammar.pragmas[pragma];
        }
        for (let option in options) {
            this.options[option] = options[option];
        }
        this.valueBuilder = new Output_1.ValueBuilder(grammar, this.options.callbacks);
        this.callFrame(null, root);
    }
    run() {
        CURRENT: while (true) {
            let current = this.frameStack[this.frameStack.length - 1];
            if (current.complete) {
                if (this.frameStack.length == 1) {
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
                this.frameStack.pop();
                continue CURRENT;
            }
            let matched = false, consumed = 0;
            do {
                let callee;
                let consumedPos = current.pos + current.consumed;
                let descriptor = current.token.descriptor;
                if (descriptor.match) {
                    try {
                        [matched, consumed] = descriptor.match(this.buffer, consumedPos);
                    }
                    catch (e) {
                        if (this.buffer.closed && e == ParseBuffer_1.ParseBufferExhaustedError) {
                            [matched, consumed] = [false, 0];
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
                    let calleeNode = (descriptor.type == "ruleref" ? this.rulesets[descriptor.name] : descriptor);
                    this.callFrame(current, calleeNode);
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
                        // at this point our left recursion is failing to consume more input,
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
                        let pattern = descriptor.pattern;
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
                    let output = {
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
                    let value = this.valueBuilder.buildValue(current);
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
                    let output = current.output;
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
    }
    expectedTerminals() {
        let lookup = {};
        let out = [];
        for (let terminal of this.failedPatterns) {
            if (!lookup[terminal]) {
                out.push(terminal);
                lookup[terminal] = true;
            }
        }
        return out;
    }
    nextRule(frame) {
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
    }
    parse() {
        if (this.error) {
            throw this.error;
        }
        try {
            let result = this.run();
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
    }
    callFrame(current, callee) {
        let pos = current ? current.pos + current.consumed : 0;
        let recursed;
        if (current && callee.type == "ruleset") {
            for (let i = this.frameStack.length - 1; i >= 0; i--) {
                let check = this.frameStack[i];
                if (check.pos != current.pos) {
                    break;
                }
                if (check.ruleset && check.ruleset.name == callee.name) {
                    recursed = check;
                    break;
                }
            }
        }
        let frame;
        let secondFrame;
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
                current.callee = frame;
                this.frameStack.push(frame);
                this.frameStack.push(secondFrame = frame.callee);
            }
            else {
                // this is the first recursion iteration - get ourselves ready
                // to work through multiple recursion iterations by marking our
                // base frame as left recursing and advancing our new frame to
                // avoid infinite loop.
                this.nextRule(frame);
                recursed.leftRecursing = true;
                current.callee = frame;
                this.frameStack.push(frame);
            }
        }
        else if (!frame) {
            let selector = callee.type == "ruleset" ? callee.rules[0] : callee;
            let pattern = selector.patterns[0];
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
                callee: null,
                wantOutput: current && (current.selector.type == "capture" || current.wantOutput),
                output: null,
                captures: null,
                leftRecursing: false,
                leftReturn: null,
            };
            if (current)
                current.callee = frame;
            this.frameStack.push(frame);
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
    }
    dumpDebug() {
        if (this.options.debugErrors) {
            let lines = [];
            for (let msg of this.debugLog) {
                lines.push(msg.join('\t').replace(/\n/g, '\\n'));
            }
            console.log("Debug log:\n", lines.join("\n"));
        }
    }
}
exports.Parser = Parser;
function parserError(code) {
    let msg = exports.errorMessages[code];
    let e = new Error(`Internal parser error ${code}: ${msg}`);
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
    expected = expected.map((i) => i.replace(/\n/g, '\\n'));
    let list = [].join.call(expected, '\n\t');
    let reason = expected.length == 1 ? `expected: ${list}` : `expected one of the following: \n\t${list}`;
    let info = buf.findLineAndChar(pos);
    let backrefs = [null, info.line, info.char, reason, info.lineText, info.pointerText];
    let msg = exports.errorMessages[code].replace(/\$([0-9])/g, (match, index) => String(backrefs[index]));
    let e = new Error(msg);
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
