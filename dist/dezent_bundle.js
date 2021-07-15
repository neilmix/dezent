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
exports.parseGrammar = exports.DezentStream = exports.Dezent = void 0;
const Error_1 = require("./Error");
const GrammarCompiler_1 = require("./GrammarCompiler");
const ParseBuffer_1 = require("./ParseBuffer");
const OpcodeCompiler_1 = require("./OpcodeCompiler");
const Interpreter_1 = require("./Interpreter");
class Dezent {
    constructor(grammarStr, options) {
        this.options = fillOptions(options);
        this.grammar = parseGrammar(grammarStr, this.options);
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
        this.options = fillOptions(options);
        this.buffer = new ParseBuffer_1.ParseBuffer(this.options.minBufferSizeInMB);
        grammar = typeof grammar == "string" ? parseGrammar(grammar, this.options) : grammar;
        this.opcode = new OpcodeCompiler_1.OpcodeCompiler(grammar).compile();
        this.interpreter = new Interpreter_1.Interpreter(this.opcode, this.buffer);
    }
    write(text) {
        this.buffer.addChunk(text);
        this.interpreter.resume();
    }
    close() {
        this.buffer.close();
        return this.interpreter.resume();
    }
}
exports.DezentStream = DezentStream;
function fillOptions(options) {
    options = options || {};
    return {
        minBufferSizeInMB: options.minBufferSizeInMB || 1,
        callbacks: options.callbacks || {},
    };
}
let dezentOpcode;
function parseGrammar(text, options) {
    if (!dezentOpcode) {
        dezentOpcode = new OpcodeCompiler_1.OpcodeCompiler(GrammarCompiler_1.findDezentGrammar()).compile();
    }
    let buf = new ParseBuffer_1.ParseBuffer(text);
    let interpreter = new Interpreter_1.Interpreter(dezentOpcode, new ParseBuffer_1.ParseBuffer(text));
    try {
        let grammar = interpreter.resume();
        GrammarCompiler_1.GrammarCompiler.compileGrammar(grammar, text, options.callbacks);
        return grammar;
    }
    catch (e) {
        if (e["code"] == Error_1.ErrorCode.TextParsingError) {
            Error_1.parsingError(Error_1.ErrorCode.GrammarParsingError, buf, e["pos"], e["expected"]);
        }
        else {
            throw e;
        }
    }
}
exports.parseGrammar = parseGrammar;

},{"./Error":2,"./GrammarCompiler":4,"./Interpreter":5,"./OpcodeCompiler":6,"./ParseBuffer":7}],2:[function(require,module,exports){
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
exports.parsingError = exports.grammarError = exports.assert = exports.parserError = exports.errorMessages = exports.ErrorCode = void 0;
const ParseBuffer_1 = require("./ParseBuffer");
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
function grammarError(code, text, meta, ...args) {
    let reason = exports.errorMessages[code].replace(/\$([0-9])/g, (match, index) => args[index - 1]);
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

},{"./ParseBuffer":7}],3:[function(require,module,exports){
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

},{}],4:[function(require,module,exports){
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
exports.findDezentGrammar = exports.buildString = exports.GrammarCompiler = void 0;
const Grammar_1 = require("./Grammar");
const Error_1 = require("./Error");
class GrammarCompiler {
    static compileGrammar(grammar, text, callbacks) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // - other helpful sanity checks
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        grammar.version = Grammar_1.GrammarVersion;
        grammar.text = text;
        grammar.callbacks = Object.assign({ pivot: (value) => {
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
            } }, callbacks);
        let rulesetLookup = grammar.rulesetLookup = {};
        for (let ruleset of grammar.ruleset) {
            if (rulesetLookup[ruleset.name]) {
                if (ruleset.name == 'return') {
                    Error_1.grammarError(Error_1.ErrorCode.MultipleReturn, text, ruleset.meta, ruleset.name);
                }
                else {
                    Error_1.grammarError(Error_1.ErrorCode.DuplicateDefine, text, ruleset.meta, ruleset.name);
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
                    Error_1.grammarError(Error_1.ErrorCode.RuleNotFound, text, node.meta, node.name);
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
            visitParseNodes(["capture"], ruleset, null, null, (node) => {
                for (let pattern of node.patterns) {
                    if (pattern.tokens.length > 1 || pattern.tokens[0].repeat || pattern.tokens[0].descriptor.type != "ruleref") {
                        node.useOutput = false;
                        return;
                    }
                }
                node.useOutput = true;
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
                Error_1.grammarError(Error_1.ErrorCode.CaptureCountMismatch, text, rule.meta);
            }
            lastCount = info.captures.length;
            i++;
        } while (i < rule.patterns.length);
        visitParseNodes("string", rule, null, null, (node) => {
            let matchString = buildString(node);
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
                    Error_1.grammarError(Error_1.ErrorCode.InvalidConstRef, text, node.meta, node.name);
                }
            }
        });
        for (let i = 1; i < info.backrefs.length; i++) {
            if (info.backrefs[i].index >= info.captures.length) {
                Error_1.grammarError(Error_1.ErrorCode.InvalidBackRef, text, info.backrefs[i].meta, info.backrefs[i].index);
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
function buildString(node) {
    return node.tokens.map((node) => {
        if (node.type == "text") {
            return node.value;
        }
        else if (node.value[0] == 'u') {
            return String.fromCharCode(Number(`0x${node.value.substr(1)}`));
        }
        else if (node.value.length > 1) {
            Error_1.parserError(Error_1.ErrorCode.Unreachable);
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
let dezentGrammar;
function findDezentGrammar() {
    if (!dezentGrammar) {
        dezentGrammar = Grammar_1.createUncompiledDezentGrammar();
        GrammarCompiler.compileGrammar(dezentGrammar);
    }
    return dezentGrammar;
}
exports.findDezentGrammar = findDezentGrammar;

},{"./Error":2,"./Grammar":3}],5:[function(require,module,exports){
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
exports.Interpreter = exports.Context = exports.WaitInput = exports.Fail = exports.Pass = exports.Run = void 0;
const Error_1 = require("./Error");
exports.Run = -1;
exports.Pass = -2;
exports.Fail = -3;
exports.WaitInput = -4;
class Context {
    constructor() {
        this.iteration = 0;
        this.startPos = 0;
        this.endPos = 0;
        this.lastConsumed = 0;
        this.captures = [];
        this.status = exports.Run;
        this.scopes = [];
        this.frames = [];
        this.auditLog = [];
    }
    beginScope() {
        this.scopes.push({ startPos: this.startPos, endPos: this.endPos, captureCount: this.captures.length });
        this.startPos = this.endPos;
    }
    commitScope() {
        this.lastConsumed = this.endPos - (this.startPos = this.scopes.pop().startPos);
    }
    rollbackScope() {
        let scope = this.scopes.pop();
        this.startPos = scope.startPos;
        this.endPos = scope.endPos;
        this.captures.length = scope.captureCount;
    }
    pushFrame(pass, fail) {
        this.frames.push({ pass: pass, fail: fail, captures: this.captures });
        this.captures = [];
    }
    popFrame() {
        let frame = this.frames.pop();
        this.captures = frame.captures;
        return frame;
    }
}
exports.Context = Context;
class Interpreter {
    constructor(op, buf) {
        this.context = new Context();
        this.resumeOp = op;
        this.buffer = buf;
    }
    resume() {
        let ctx = this.context;
        let result = this.resumeOp;
        let op;
        let buf = this.buffer;
        try {
            do {
                op = result;
                result = op(ctx, buf);
            } while (result !== null);
        }
        catch (e) {
            if (Interpreter.debug) {
                console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            }
            throw e;
        }
        if (Interpreter.debug) {
            console.log(ctx.auditLog.map((line) => line.join(' ')).join('\n'));
            console.log("status: ", ctx.status);
            ctx.auditLog.length = 0;
        }
        switch (ctx.status) {
            case exports.Pass:
                if (ctx.endPos < buf.length) {
                    Error_1.parsingError(Error_1.ErrorCode.TextParsingError, buf, ctx.endPos, ["<EOF>"]);
                }
                if (!buf.closed) {
                    this.resumeOp = op;
                    ctx.status = exports.WaitInput;
                    return;
                }
                return ctx.output;
            case exports.Fail:
                throw new Error("Parse Error");
            case exports.WaitInput:
                this.resumeOp = op;
                return;
            default:
                Error_1.parserError(Error_1.ErrorCode.Unreachable);
        }
    }
}
exports.Interpreter = Interpreter;
Interpreter.debug = false;

},{"./Error":2}],6:[function(require,module,exports){
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
exports.OpcodeCompiler = void 0;
const Error_1 = require("./Error");
const Interpreter_1 = require("./Interpreter");
class CompilerContext {
    constructor() {
        this.activeRules = [];
    }
    pushRule(rule) {
        if (this.currentRule) {
            this.activeRules.push(this.currentRule);
        }
        this.currentRule = rule;
    }
    popRule() {
        this.currentRule = this.activeRules.pop();
    }
}
class OpcodeCompiler {
    constructor(grammar) {
        this.rulesetOps = {};
        this.rulerefOpFactories = {};
        this.grammar = grammar;
    }
    audit(node, action, op) {
        function pad(s, len) {
            s = String(s).substr(0, len);
            return s + ' '.repeat(len - s.length);
        }
        if (Interpreter_1.Interpreter.debug) {
            return (ictx, buf) => {
                let desc = node ? node["name"] || node["pattern"] || "" : "";
                const entry = [
                    pad((node && node.id) || '', 8),
                    pad(node ? node.type : "", 10),
                    pad(desc, 10),
                    pad(buf.substr(ictx.startPos, 10).replace(/\n/g, " "), 10),
                    "  ",
                    pad(action, 10),
                    pad(ictx.startPos, 6),
                    pad(ictx.endPos, 6),
                    pad(ictx.lastConsumed, 6),
                    pad(ictx.scopes.length, 5)
                ];
                const result = op(ictx, buf);
                ictx.auditLog.push(entry.concat([
                    " -> ",
                    pad(ictx.startPos, 6),
                    pad(ictx.endPos, 6),
                    pad(ictx.lastConsumed, 6),
                    pad(ictx.scopes.length, 5)
                ]));
                return result;
            };
        }
        else {
            return op;
        }
    }
    compile() {
        const cctx = new CompilerContext();
        const op = this.compileRuleset(cctx, this.grammar.rulesetLookup.return, this.audit(null, "pass", (ictx, buf) => { ictx.status = Interpreter_1.Pass; return null; }), this.audit(null, "fail", (ictx, buf) => { ictx.status = Interpreter_1.Fail; return null; }));
        let iteration = 0;
        return (ctx, buf) => {
            ctx.iteration = ++iteration;
            return op;
        };
    }
    compileRuleset(cctx, node, pass, fail) {
        // this looks a little convoluted, but basically we're creating a chain of rule parsers
        // that on fail go to the next prule parser and the final rule goes to the fail
        // that was passed in. The convolution comes from the need to manage variable scoping carefully.
        let nextOp = fail;
        for (let i = node.rules.length - 1; i >= 0; i--) {
            nextOp = ((failOp) => {
                return this.compileRule(cctx, node.rules[i], pass, failOp);
            })(nextOp);
        }
        return nextOp;
    }
    compileRule(cctx, node, pass, fail) {
        cctx.pushRule(node);
        const patterns = this.compilePatterns(cctx, node, this.compileValue(cctx, node.value, pass), fail);
        cctx.popRule();
        const captures = node.captures || [];
        return (ictx, buf) => {
            ictx.captures.length = 0;
            return patterns;
        };
    }
    compilePatterns(cctx, node, pass, fail) {
        // this looks a little convoluted, but basically we're creating a chain of pattern parsers
        // that on fail go to the next pattern parser and the final pattern goes to the fail
        // that was passed in. The convolution comes from the need to manage variable scoping carefully.
        let nextOp = fail;
        for (let i = node.patterns.length - 1; i >= 0; i--) {
            nextOp = ((failOp) => {
                const patternOp = this.compilePattern(cctx, node.patterns[i], this.audit(node, "pass", (ictx, buf) => {
                    ictx.commitScope();
                    return pass;
                }), this.audit(node, "fail", (ictx, buf) => { ictx.rollbackScope(); return failOp; }));
                return this.audit(node, "run", (ictx, buf) => { ictx.beginScope(); return patternOp; });
            })(nextOp);
        }
        return nextOp;
    }
    compilePattern(cctx, node, pass, fail) {
        let prev = pass;
        for (let i = node.tokens.length - 1; i >= 0; i--) {
            prev = this.compileToken(cctx, node.tokens[i], prev, fail);
        }
        return prev;
    }
    compileToken(cctx, node, pass, fail) {
        if (node.not) {
            let tmp = pass;
            pass = fail;
            fail = tmp;
        }
        const newPass = (node.and || node.not)
            ? this.audit(node, "pass", (ictx, buf) => {
                ictx.endPos = ictx.startPos;
                return pass;
            })
            : this.audit(node, "pass", (ictx, buf) => {
                ictx.startPos = ictx.endPos;
                return pass;
            });
        if (node.repeat) {
            let repeat;
            let repeatPass = this.audit(node, "repeat", (ictx, buf) => {
                // make sure we consumed so we don't get into an infinite loop
                if (ictx.endPos > ictx.startPos) {
                    ictx.startPos = ictx.endPos;
                    return repeat;
                }
                else {
                    return newPass;
                }
            });
            repeat = this.compileDescriptor(cctx, node.descriptor, repeatPass, newPass);
            if (node.required) {
                // first time through must match, optionally thereafter
                return this.compileDescriptor(cctx, node.descriptor, repeatPass, fail);
            }
            else {
                // always passes
                return repeat;
            }
        }
        else {
            if (!node.required && node.descriptor.type == "capture" && cctx.currentRule.captures[node.descriptor.index]) {
                // a non-required capture that fails should return null in a non-collapsed array
                let index = String(node.descriptor.index);
                return this.compileDescriptor(cctx, node.descriptor, newPass, this.audit(node, "pass", (ictx, buf) => {
                    ictx.captures.push({ index: index, value: null });
                    return pass;
                }));
            }
            else {
                return this.compileDescriptor(cctx, node.descriptor, newPass, node.required ? fail : pass);
            }
        }
    }
    compileDescriptor(cctx, node, pass, fail) {
        switch (node.type) {
            case "group":
                return this.compilePatterns(cctx, node, pass, fail);
            case "capture":
                const useOutput = node.useOutput;
                const captureIndex = node.index;
                let id = cctx.currentRule.id;
                const setCapture = (ictx, value) => {
                    ictx.captures.push({ index: captureIndex, value: value });
                };
                const newPass = useOutput ?
                    (ictx, buf) => {
                        ictx.captures.push({ index: captureIndex, value: ictx.output });
                        return pass;
                    }
                    : (ictx, buf) => {
                        ictx.captures.push({ index: captureIndex, value: buf.substr(ictx.endPos - ictx.lastConsumed, ictx.lastConsumed) });
                        return pass;
                    };
                return this.compilePatterns(cctx, node, newPass, fail);
            case "ruleref":
                const name = node.name;
                const rulesetOps = this.rulesetOps;
                // detect left recursion by checking the current position against the previous position
                // when this ruleref is executed - if the position is unchanged, we have left recursion.
                // But, double-check our context iteration so that we don't conflict across parses.
                let prevIteration = -1;
                let prevPos = -1;
                let leftRecursing = false;
                let leftOutput = undefined;
                let leftEndPos = 0;
                let leftConsumed = 0;
                // In order to detect left recursion we need access to prevPos (defined above) in our scope.
                // But, pass and fail may be different for every invocation of a ruleref. So, we need to use
                // factories to generator our op so that we retain prevPos in scope while generating a
                // unique op for each invokation.
                // Do this prior to creating the rulesetOp so that we're creating the factory at the first
                // invokation and not a later invokation, that way all invokations share the same prevPos.
                if (!this.rulerefOpFactories[name]) {
                    this.rulerefOpFactories[name] = (pass, fail) => {
                        return this.audit(node, "run", (ictx, buf) => {
                            if (leftRecursing) {
                                ictx.output = leftOutput;
                                ictx.endPos = leftEndPos;
                                ictx.lastConsumed = leftConsumed;
                                return pass;
                            }
                            else if (ictx.iteration == prevIteration && ictx.startPos == prevPos) {
                                leftRecursing = true;
                                leftOutput = undefined;
                                leftEndPos = 0;
                                leftConsumed = 0;
                                return fail;
                            }
                            prevIteration = ictx.iteration;
                            prevPos = ictx.startPos;
                            ictx.pushFrame(pass, fail);
                            return rulesetOps[name];
                        });
                    };
                }
                // a null rulesetOp indicates that we've been call recursively during ruleset compilation,
                // so check specifically for undefined here
                if (rulesetOps[name] === undefined) {
                    // set a null value so that we don't get infinite compilation recursion in 
                    // the case where our rule calls itself
                    rulesetOps[name] = null;
                    rulesetOps[name] = this.compileRuleset(cctx, this.grammar.rulesetLookup[name], this.audit(node, "pass", (ictx, buf) => {
                        if (leftRecursing) {
                            if (ictx.lastConsumed > leftConsumed) {
                                leftOutput = ictx.output;
                                leftEndPos = ictx.endPos;
                                leftConsumed = ictx.lastConsumed;
                                return rulesetOps[name];
                            }
                            else {
                                ictx.output = leftOutput;
                                ictx.endPos = leftEndPos;
                                ictx.lastConsumed = leftConsumed;
                                leftRecursing = false;
                                // fall through
                            }
                        }
                        prevPos = -1;
                        return ictx.popFrame().pass;
                    }), this.audit(node, "fail", (ictx, buf) => {
                        if (leftRecursing) {
                            leftRecursing = false;
                            ictx.output = leftOutput;
                            ictx.endPos = leftEndPos;
                            ictx.lastConsumed = leftConsumed;
                            prevPos = -1;
                            return ictx.popFrame().pass;
                        }
                        else {
                            prevPos = -1;
                            return ictx.popFrame().fail;
                        }
                    }));
                }
                return this.rulerefOpFactories[name](pass, fail);
            case "string":
                const matchStr = node.pattern;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos + matchStr.length <= buf.length) {
                        if (buf.containsAt(matchStr, ictx.endPos)) {
                            ictx.endPos += matchStr.length;
                            return pass;
                        }
                        else {
                            return fail;
                        }
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            case "class":
                const ranges = node.ranges;
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos < buf.length) {
                        const c = buf.charAt(ictx.endPos);
                        for (const range of ranges) {
                            if (c >= range[0].match && c <= range[1].match) {
                                ictx.endPos++;
                                return pass;
                            }
                        }
                        return fail;
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            case "any":
                return this.audit(node, "run", (ictx, buf) => {
                    if (ictx.endPos < buf.length) {
                        ictx.endPos++;
                        return pass;
                    }
                    else if (buf.closed) {
                        return fail;
                    }
                    else {
                        ictx.status = Interpreter_1.WaitInput;
                        return null;
                    }
                });
            default:
                throw new Error("not implemented");
        }
    }
    compileValue(cctx, node, pass) {
        const builder = this.compileValueBuilder(cctx, node);
        return this.audit(node, "output", (ictx, buf) => {
            ictx.output = builder(ictx, buf);
            return pass;
        });
    }
    compileValueBuilder(cctx, node) {
        switch (node.type) {
            case "null":
                return (ictx, buf) => {
                    return null;
                };
            case "boolean":
                const b = node.value;
                return (ictx, buf) => {
                    return b;
                };
            case "number":
                const n = node.value;
                return (ictx, buf) => {
                    return Number(n);
                };
            case "string":
                const strBuilders = node.tokens.map((node) => {
                    const value = node.value;
                    if (node.type == "text") {
                        return () => value;
                    }
                    else if (node.value[0] == 'u') {
                        return () => String.fromCharCode(Number(`0x${value.substr(1)}`));
                    }
                    else if (node.value.length > 1) {
                        Error_1.parserError(Error_1.ErrorCode.Unreachable);
                    }
                    else if ("bfnrt".indexOf(value) >= 0) {
                        return () => ({ b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' })[value];
                    }
                    else {
                        return () => value;
                    }
                });
                return (ictx, buf) => {
                    return strBuilders.map((b) => b()).join('');
                };
            case "constref":
                return this.compileAccess(cctx, node, this.compileValueBuilder(cctx, this.grammar.vars[node.name]));
            case "metaref":
                const metaName = node.name;
                switch (metaName) {
                    case "position": return (ictx, buf) => ictx.startPos;
                    case "length": return (ictx, buf) => ictx.endPos - ictx.startPos;
                    default:
                        Error_1.parserError(Error_1.ErrorCode.Unreachable);
                        return null;
                }
            case "array":
                const elemBuilders = node.elements.map((item) => {
                    const builder = this.compileValueBuilder(cctx, item);
                    if (item.type == "spread") {
                        return (ictx, buf, array) => array.concat(builder(ictx, buf));
                    }
                    else if (item.type == "backref" && item.collapse) {
                        return (ictx, buf, array) => {
                            let value = builder(ictx, buf);
                            if (value !== null) {
                                array.push(value);
                            }
                            return array;
                        };
                    }
                    else {
                        return (ictx, buf, array) => {
                            array.push(builder(ictx, buf));
                            return array;
                        };
                    }
                });
                return this.compileAccess(cctx, node, (ictx, buf) => {
                    return elemBuilders.reduce((a, f) => f(ictx, buf, a), []);
                });
            case "object":
                const ret = {};
                const objBuilders = node.members.map((member) => {
                    if (member.type == "spread") {
                        const tupleBuilder = this.compileValueBuilder(cctx, member);
                        return (ictx, buf, retval) => {
                            return tupleBuilder(ictx, buf).reduce((o, tuple) => {
                                if (!Array.isArray(tuple) || tuple.length != 2) {
                                    Error_1.grammarError(Error_1.ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                                }
                                o[tuple[0]] = tuple[1];
                                return o;
                            }, retval);
                        };
                    }
                    else {
                        const keyOp = this.compileValueBuilder(cctx, member.name);
                        const valueOp = this.compileValueBuilder(cctx, member.value);
                        return (ictx, buf, retval) => {
                            retval[keyOp(ictx, buf)] = valueOp(ictx, buf);
                            return retval;
                        };
                    }
                });
                return this.compileAccess(cctx, node, (ictx, buf) => objBuilders.reduce((o, f) => f(ictx, buf, o), {}));
            case "backref":
                const index = node.index;
                if (index == "0") {
                    return this.compileAccess(cctx, node, (ictx, buf) => {
                        return buf.substrExact(ictx.startPos, ictx.endPos - ictx.startPos);
                    });
                }
                else {
                    if (cctx.currentRule.captures[index]) {
                        if (node.collapse) {
                            return this.compileAccess(cctx, node, (ictx, buf) => {
                                return ictx.captures.reduce((ret, cap) => {
                                    if (cap.index == index && cap.value !== null)
                                        ret.push(cap.value);
                                    return ret;
                                }, []);
                            });
                        }
                        else {
                            return this.compileAccess(cctx, node, (ictx, buf) => {
                                return ictx.captures.reduce((ret, cap) => {
                                    if (cap.index == index)
                                        ret.push(cap.value);
                                    return ret;
                                }, []);
                            });
                        }
                    }
                    else {
                        return this.compileAccess(cctx, node, (ictx, buf) => {
                            let cap = ictx.captures.find((cap) => cap.index == index);
                            return cap ? cap.value : null;
                        });
                    }
                }
            case "call":
                const callback = this.grammar.callbacks[node.name];
                const argBuilders = node.args.map((arg) => this.compileValueBuilder(cctx, arg));
                if (!callback) {
                    Error_1.grammarError(Error_1.ErrorCode.FunctionNotFound, this.grammar.text, node.meta, node.name);
                }
                return (ictx, buf) => {
                    try {
                        return callback.apply(null, argBuilders.map((arg) => arg(ictx, buf)));
                    }
                    catch (e) {
                        Error_1.grammarError(Error_1.ErrorCode.CallbackError, this.grammar.text, node.meta, String(e));
                    }
                };
            case "spread":
                const spreader = this.compileValueBuilder(cctx, node.value);
                return (ictx, buf) => {
                    const value = spreader(ictx, buf);
                    if (value === null || value === undefined || (typeof value != 'object' && typeof value != 'string')) {
                        Error_1.grammarError(Error_1.ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
                    }
                    if (Array.isArray(value)) {
                        return value;
                    }
                    else if (typeof value == "string") {
                        return value.split('');
                    }
                    else {
                        return Object.entries(value);
                    }
                };
            default:
                throw new Error("not implemented");
        }
    }
    compileAccess(cctx, node, builder) {
        if (node.access)
            for (let prop of node.access) {
                builder = ((prevBuilder, prop) => {
                    if (prop.value) {
                        let indexBuilder = this.compileValueBuilder(cctx, prop.value);
                        return (ictx, buf) => {
                            let out = prevBuilder(ictx, buf);
                            if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                                Error_1.grammarError(Error_1.ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                            }
                            let index = indexBuilder(ictx, buf);
                            if (typeof index != 'string' && typeof index != 'number') {
                                Error_1.grammarError(Error_1.ErrorCode.InvalidAccessIndex, this.grammar.text, prop.meta, JSON.stringify(index));
                            }
                            if (!out.hasOwnProperty(index)) {
                                Error_1.grammarError(Error_1.ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                            }
                            return out[index];
                        };
                    }
                    else {
                        return (ictx, buf) => {
                            let out = prevBuilder(ictx, buf);
                            if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                                Error_1.grammarError(Error_1.ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                            }
                            let index = prop.name;
                            if (!out.hasOwnProperty(index)) {
                                Error_1.grammarError(Error_1.ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                            }
                            return out[index];
                        };
                    }
                })(builder, prop);
            }
        return builder;
    }
}
exports.OpcodeCompiler = OpcodeCompiler;

},{"./Error":2,"./Interpreter":5}],7:[function(require,module,exports){
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
const Error_1 = require("./Error");
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
            Error_1.parserError(Error_1.ErrorCode.InputFreed);
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
            Error_1.parserError(Error_1.ErrorCode.InputFreed);
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

},{"./Error":2}],8:[function(require,module,exports){

let mod = require("./Dezent");
window.Dezent = mod.Dezent;
window.DezentStream = mod.DezentStream;

},{"./Dezent":1}]},{},[8]);
