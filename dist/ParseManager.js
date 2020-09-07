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
exports.__esModule = true;
exports.grammarError = exports.ParseManager = void 0;
var Parser_1 = require("./Parser");
var ParseManager = /** @class */ (function () {
    function ParseManager(options) {
        this.debugLog = [];
        this.options = options || {};
    }
    ParseManager.prototype.parseText = function (grammar, text) {
        if (typeof grammar == "string") {
            grammar = this.parseAndCompileGrammar(grammar);
        }
        this.compiledGrammar = grammar;
        return this.parseTextWithGrammar(grammar, text);
    };
    ParseManager.prototype.parseAndCompileGrammar = function (text) {
        try {
            var grammar = this.parseTextWithGrammar(Parser_1.findDezentGrammar(this.options), text);
            if (this.options.debugErrors) {
                this.rawGrammar = JSON.stringify(grammar);
            }
            this.compileGrammar(grammar, text);
            return grammar;
        }
        catch (e) {
            if (e["code"] == Parser_1.ErrorCode.TextParsingError) {
                Parser_1.parsingError(Parser_1.ErrorCode.GrammarParsingError, text, e["pos"], e["expected"]);
            }
            else {
                throw e;
            }
        }
    };
    ParseManager.prototype.compileGrammar = function (grammar, text) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // - other helpful sanity checks
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        grammar.text = text;
        var rulesetLookup = grammar.rulesetLookup = {};
        for (var _i = 0, _a = grammar.ruleset; _i < _a.length; _i++) {
            var ruleset = _a[_i];
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
        var nodeSequence = 0;
        for (var _b = 0, _c = grammar.ruleset; _b < _c.length; _b++) {
            var ruleset = _c[_b];
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
                for (var _i = 0, _a = node.tokens; _i < _a.length; _i++) {
                    var token = _a[_i];
                    if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                        node.canFail = true;
                        return;
                    }
                }
                node.canFail = false;
            });
            visitParseNodes(["capture", "group", "rule"], ruleset, null, null, function (node) {
                node.canFail = true;
                for (var _i = 0, _a = node.options; _i < _a.length; _i++) {
                    var pattern = _a[_i];
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
                for (var _d = 0, _e = ruleset.rules; _d < _e.length; _d++) {
                    var rule = _e[_d];
                    if (!rule.canFail) {
                        ruleset.canFail = false;
                        break;
                    }
                }
            }
        }
        grammar.maxid = nodeSequence;
        return grammar;
    };
    ParseManager.prototype.compileRule = function (rule, vars, text) {
        // put an empty placeholder in captures so that the indices
        // align with backrefs (which begin at 1)
        var info = { captures: [null], repeats: 0, backrefs: [null] };
        var i = 0;
        var lastCount = -1;
        do {
            info.captures = [null];
            visitParseNodes("token", rule.options[i], info, function (node, info) {
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
        } while (i < rule.options.length);
        visitParseNodes("string", rule, null, null, function (node) {
            var matchString = buildString(node);
            node.pattern = matchString;
            node.match = function (s) { return s.startsWith(matchString) ? [true, matchString.length] : [false, 0]; };
        });
        visitParseNodes("class", rule, null, null, function (node) {
            for (var _i = 0, _a = node.ranges; _i < _a.length; _i++) {
                var range = _a[_i];
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
                                'f': '\f'
                            })[bound.value] || bound.value;
                        }
                    }
                    else {
                        bound.match = bound.value;
                    }
                });
            }
            node.pattern = node.ranges.map(function (i) {
                var ret = (i[0].type == 'escape' ? '\\' : '') + i[0].value;
                if (i[0].value != i[1].value) {
                    ret += '-';
                    ret += (i[1].type == 'escape' ? '\\' : '') + i[1].value;
                }
                return ret;
            }).join(' ');
            node.match = function (s) {
                for (var _i = 0, _a = node.ranges; _i < _a.length; _i++) {
                    var range = _a[_i];
                    if (s[0] >= range[0].match && s[0] <= range[1].match) {
                        return [true, 1];
                    }
                }
                return [false, 0];
            };
        });
        visitParseNodes("any", rule, null, null, function (node) {
            node.match = function (s) {
                return s.length ? [true, 1] : [false, 0];
            };
            node.pattern = '';
        });
        visitOutputNodes(rule.value, info, function (node, info) {
            if (node.type == "backref")
                info.backrefs.push(node);
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
    ParseManager.prototype.parseTextWithGrammar = function (grammar, text) {
        var ret;
        for (var _i = 0, _a = grammar.ruleset; _i < _a.length; _i++) {
            var ruleset = _a[_i];
            if (ruleset.name == 'return') {
                ret = ruleset;
            }
        }
        if (!ret) {
            grammarError(Parser_1.ErrorCode.ReturnNotFound, text);
        }
        // now parse
        var parser = this.currentParser = new Parser_1.Parser(ret, text, grammar.rulesetLookup, grammar.maxid, this.options, this.debugLog);
        var output = parser.parse();
        var builders = {
            backref: function (node, backrefs) {
                if (backrefs[node.index] === undefined) {
                    Parser_1.parserError(Parser_1.ErrorCode.BackRefNotFound);
                }
                else {
                    return backrefs[node.index];
                }
            },
            constref: function (node, backrefs, vars, metas) {
                var resolved = vars[node.name];
                return buildValue(resolved, backrefs, vars, metas);
            },
            metaref: function (node, backrefs, vars, metas) {
                return metas[node.name];
            },
            pivot: function (node, backrefs, vars, metas) {
                var value = buildValue(node.value, backrefs, vars, metas);
                if (!Array.isArray(value)) {
                    grammarError(Parser_1.ErrorCode.InvalidPivot, grammar.text, node.meta, JSON.stringify(value));
                }
                value.map(function (item) {
                    if (!Array.isArray(item)) {
                        grammarError(Parser_1.ErrorCode.InvalidPivot, grammar.text, node.meta, JSON.stringify(item));
                    }
                    if (item.length != value[0].length) {
                        grammarError(Parser_1.ErrorCode.PivotArraySizeMismatch, grammar.text, node.meta);
                    }
                });
                var ret = [];
                for (var _i = 0, _a = value[0]; _i < _a.length; _i++) {
                    var item = _a[_i];
                    ret.push([]);
                }
                for (var i = 0; i < value.length; i++) {
                    for (var j = 0; j < value[0].length; j++) {
                        ret[j][i] = value[i][j];
                    }
                }
                return ret;
            },
            spread: function (node, backrefs, vars, metas) {
                var value = buildValue(node.value, backrefs, vars, metas);
                if (!value || (typeof value != 'object' && typeof value != 'string')) {
                    grammarError(Parser_1.ErrorCode.InvalidSpread, grammar.text, node.meta, JSON.stringify(value));
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
            },
            object: function (node, backrefs, vars, metas) {
                var ret = {};
                for (var _i = 0, _a = node.members; _i < _a.length; _i++) {
                    var member = _a[_i];
                    if (member.type == "spread") {
                        var tuples = buildValue(member, backrefs, vars, metas);
                        ;
                        for (var _b = 0, tuples_1 = tuples; _b < tuples_1.length; _b++) {
                            var tuple = tuples_1[_b];
                            if (!Array.isArray(tuple) || tuple.length != 2) {
                                grammarError(Parser_1.ErrorCode.InvalidObjectTuple, grammar.text, member.meta, JSON.stringify(tuple));
                            }
                            ret[tuple[0]] = tuple[1];
                        }
                    }
                    else {
                        ret[buildValue(member.name, backrefs, vars, metas)]
                            = buildValue(member.value, backrefs, vars, metas);
                    }
                }
                return ret;
            },
            array: function (node, backrefs, vars, metas) {
                var ret = [];
                for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
                    var elem = _a[_i];
                    if (elem.type == "spread") {
                        ret = ret.concat(buildValue(elem, backrefs, vars, metas));
                    }
                    else {
                        var val = buildValue(elem, backrefs, vars, metas);
                        ;
                        if (!elem.collapse || val != null) {
                            ret.push(val);
                        }
                    }
                }
                return ret;
            },
            string: function (node) {
                return buildString(node);
            },
            number: function (node) {
                return Number(node.value);
            },
            boolean: function (node) {
                return node.value;
            },
            "null": function () {
                return null;
            }
        };
        // build our output value    
        return buildOutput(output.result);
        function buildOutput(token) {
            if (Array.isArray(token)) {
                return token.map(function (v) { return buildOutput(v); });
            }
            else if (token == null) {
                return null;
            }
            else if (token.outputs && token.value) {
                var backrefs = token.outputs.map(function (v) { return buildOutput(v); });
                return buildValue(token.value, backrefs, grammar.vars, { position: token.pos, length: token.length });
            }
            else {
                return text.substr(token.pos, token.length);
            }
        }
        function buildValue(node, backrefs, vars, metas) {
            var out = builders[node.type](node, backrefs, vars, metas);
            if (node.access)
                for (var _i = 0, _a = node.access; _i < _a.length; _i++) {
                    var prop = _a[_i];
                    if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                        grammarError(Parser_1.ErrorCode.InvalidAccessRoot, grammar.text, prop.meta, JSON.stringify(out));
                    }
                    var index = void 0;
                    if (prop.value) {
                        index = buildValue(prop.value, backrefs, vars, metas);
                        if (typeof index != 'string' && typeof index != 'number') {
                            grammarError(Parser_1.ErrorCode.InvalidAccessIndex, grammar.text, prop.meta, JSON.stringify(index));
                        }
                    }
                    else {
                        index = prop.name;
                    }
                    if (!out.hasOwnProperty(index)) {
                        grammarError(Parser_1.ErrorCode.InvalidAccessProperty, grammar.text, prop.meta, index);
                    }
                    out = out[index];
                }
            return out;
        }
    };
    ParseManager.prototype.debug = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (this.options.debugErrors) {
            this.debugLog.push(args);
        }
    };
    ParseManager.prototype.dumpDebug = function () {
        var lines = [];
        for (var _i = 0, _a = this.debugLog; _i < _a.length; _i++) {
            var msg = _a[_i];
            lines.push(msg.join('\t').replace(/\n/g, '\\n'));
        }
        console.error("Debug log:\n", lines.join("\n"));
        // if (this.rawGrammar) {
        //     console.error("Raw grammar:\n", this.rawGrammar);
        // }
        // if (this.compiledGrammar) {
        //     console.error("Compiled grammar:\n", JSON.stringify(this.compiledGrammar));
        // }
        if (this.currentParser) {
            console.error("Parser stack:\n", this.currentParser.stack);
        }
    };
    return ParseManager;
}());
exports.ParseManager = ParseManager;
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
function visitParseNodes(types, root, data, enter, exit) {
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
            items = root.options;
            break;
        case "pattern":
            items = root.tokens;
            break;
        case "token":
            items = [root.descriptor];
            break;
        default: break;
    }
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var item = items_1[_i];
        visitParseNodes(types, item, data, enter, exit);
    }
    if (exit && (types == null || types.includes(root.type))) {
        exit(root, data);
    }
}
function visitOutputNodes(node, data, f) {
    f(node, data);
    var items;
    if (node.type == "spread" || node.type == "pivot") {
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
        for (var _i = 0, items_2 = items; _i < items_2.length; _i++) {
            var item = items_2[_i];
            visitOutputNodes(item, data, f);
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
        info = Parser_1.findLineAndChar(text, meta.pos);
        msg = msg + "\nAt line " + info.line + " char " + info.char + ":\n" + info.lineText + "\n" + info.pointerText + "\n";
    }
    var e = new Error(msg);
    e["code"] = code;
    if (info) {
        e["pos"] = meta.pos;
        e["line"] = info.line;
        e["char"] = info.char;
        e["lineText"] = info.pointerText;
        e["reason"] = reason;
    }
    throw e;
}
exports.grammarError = grammarError;
