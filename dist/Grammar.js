"use strict";
exports.__esModule = true;
exports.createUncompiledDezentGrammar = void 0;
var kNull = { type: 'null' };
function createUncompiledDezentGrammar() {
    // This is a mini DSL that allows us to build an AST
    // that our parser uses to parse grammar files.
    // This is the same grammar as in grammar.dezent,
    // though there are some restrictions to keep the
    // amount of parsing logic under control:
    // - there can be no whitespace within a capture
    // - object splat must be written as name/value pair, e.g. ...$1': ''
    // - grouping parens (and predicate/modifier) must be surrounded by whitespace
    // - character classes don't support spaces - use \\u0020
    return [
        ret("_ ( {returnSt|defineSt} _ )*", '$1'),
        def('_', "( singleLineComment | multiLineComment | whitespace? )*", null),
        def('singleLineComment', "'//' ( !'\\n' . )* '\\n'", null),
        def('multiLineComment', "'/*' ( !'*/' . )* '*/'", null),
        def('whitespace', "[\\u0020\\t-\\r]+", null),
        def('returnSt', "'return' whitespace _ {rule} _ ';'", { type: 'define', name: 'return', rules: ['$1'] }),
        def('defineSt', "{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'", { type: 'define', name: '$1', rules: ['$2', '...$3'] }),
        def('rule', "{options} _ '->' _ {value}", { type: 'rule', '...$1': '', value: '$2' }),
        def('options', "{pattern} _ ( '|' _ {pattern} _ )*", { options: ['$1', '...$2'] }),
        def('pattern', "( {token} _ )+", { type: 'pattern', tokens: '$1' }),
        def('token', "{predicate} {capture|group|string|class|ruleref|any} {modifier}", { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
        def('capture', "'{' _ {captureOptions} _ '}'", { type: 'capture', '...$1': '' }),
        def('group', "'(' _ {options} _ ')'", { type: 'group', '...$1': '' }),
        def('captureOptions', "{capturePattern} _ ( '|' _ {capturePattern} _ )*", { options: ['$1', '...$2'] }),
        def('capturePattern', "( {captureToken} _ )+", { type: 'pattern', tokens: '$1' }),
        def('captureToken', "{predicate} {captureGroup|string|class|ruleref|any} {modifier}", { type: 'token', '...$3': '', '...$1': '', descriptor: '$2' }),
        def('captureGroup', "'(' _ {captureOptions} _ ')'", { type: 'group', '...$1': '' }),
        def('class', "'[' {classComponent}* ']'", { type: 'class', ranges: '$1' }),
        def('classComponent', "{classChar} '-' {classChar}", ['$1', '$2'], "{classChar}", ['$1', '$1']),
        def('classChar', "!']' {escape|char}", '$1'),
        def('char', "charstr", { type: 'char', value: '$0' }),
        def('any', "'.'", { type: 'any' }),
        def('ruleref', "{identifier}", { type: 'ruleref', name: '$1' }),
        def('predicate', "'&'", { and: true, not: false }, "'!'", { and: false, not: true }, "''", { and: false, not: false }),
        def('modifier', "'*'", { repeat: true, required: false }, "'+'", { repeat: true, required: true }, "'?'", { repeat: false, required: false }, "''", { repeat: false, required: true }),
        def('value', "{backref|object|array|string|number|boolean|null}", '$1'),
        def('backref', "'$' {[0-9]+}", { type: 'backref', index: '$1' }),
        def('splat', "'...' {backref}", { type: 'splat', backrefs: ['$1'] }, "'...(' _ {backref} ( _ ',' _ {backref} )* _ ')'", { type: 'splat', backrefs: ['$1', '...$2'] }),
        def('object', "'{' ( _ {member} _ ',' )* _ {member}? _ '}'", { type: 'object', members: ['...$1', '$2'] }),
        def('member', "{splat}", '$1', "{backref|string|identifierAsStringNode} _ ':' _ {value}", { type: 'member', name: '$1', value: '$2' }),
        def('array', "'[' ( _ {value|splat} _ ',' )* _ {value|splat}? _ ']'", { type: 'array', elements: ['...$1', '$2'] }),
        def('string', "'\\'' {escape|stringText}* '\\''", { type: 'string', tokens: '$1' }),
        def('stringText', "( !['\\\\] . )+", { type: 'text', value: '$0' }),
        def('number', "'-'? ( [0-9]+ )? '.' [0-9]+ ( [eE] [-+] [0-9]+ )?", { type: 'number', value: '$0' }, "'-'? [0-9]+ ( [eE] [-+] [0-9]+ )?", { type: 'number', value: '$0' }),
        def('boolean', "'true'", { type: 'boolean', value: true }, "'false'", { type: 'boolean', value: false }),
        def('null', "'null'", { type: 'null' }),
        def('escape', "'\\\\' {unicode|charstr}", { type: 'escape', value: '$1' }),
        def('unicode', "'u' [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9] [A-Fa-f0-9]", '$0'),
        def('charstr', "!'\\n' .", '$0'),
        def('identifier', "[_a-zA-Z] [_a-zA-Z0-9]*", '$0'),
        def('identifierAsStringNode', "{identifier}", { type: 'string', tokens: [{ type: 'text', value: '$1' }] }),
    ];
}
exports.createUncompiledDezentGrammar = createUncompiledDezentGrammar;
function ret(options, output) {
    return {
        type: 'define',
        name: 'return',
        rules: [rule(options, output)]
    };
}
function def(name) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    var rules = [];
    for (var i = 0; i < args.length; i += 2) {
        rules.push(rule(args[i], args[i + 1]));
    }
    return {
        type: 'define',
        name: name,
        rules: rules
    };
}
function rule(options, out) {
    return {
        type: 'rule',
        options: [pattern(options.split(/ +/))],
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
    var options = [];
    var lastOr = -1;
    for (var i = 0; i < tokens.length; i++) {
        if (tokens[i] == '|') {
            options.push(pattern(tokens.slice(lastOr + 1, i)));
            lastOr = i;
        }
    }
    options.push(pattern(tokens.slice(lastOr + 1, tokens.length)));
    return {
        type: 'group',
        options: options
    };
}
function capture(token) {
    var repeat = null;
    token = token.substr(0, token.length - 1);
    var options = token.substr(1, token.length - 1).split('|');
    return {
        type: 'capture',
        options: options.map(function (t) { return pattern([t]); })
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
    switch (typeof value) {
        case 'object':
            if (value === null) {
                return { type: 'null' };
            }
            else if (Array.isArray(value)) {
                var ret_1 = [];
                for (var _i = 0, value_1 = value; _i < value_1.length; _i++) {
                    var elem = value_1[_i];
                    ret_1.push(output(elem));
                }
                return {
                    type: 'array',
                    elements: ret_1
                };
            }
            else {
                var members = [];
                for (var name_1 in value) {
                    if (name_1.startsWith('...')) {
                        // splat
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
                    members: members
                };
            }
        case 'string':
            if (value.match(/^\$(\d)$/)) {
                return {
                    type: 'backref',
                    index: RegExp.$1
                };
            }
            else if (value.match(/^\.\.\.\$(\d)/)) {
                return {
                    type: 'splat',
                    backrefs: [{
                            type: 'backref',
                            index: RegExp.$1
                        }]
                };
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
