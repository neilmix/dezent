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
var Grammar_1 = require("./Grammar");
var Output_1 = require("./Output");
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
        grammar.version = Grammar_1.GrammarVersion;
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
            var matchString = Output_1.buildString(node);
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
        return new Output_1.ValueBuilder(grammar, output).value();
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
