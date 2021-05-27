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
                        for (var _b = (e_5 = void 0, __values(node.options)), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                try {
                    for (var _b = __values(node.ranges), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var range = _c.value;
                        var c = buf.charAt(idx);
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
