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
exports.buildString = exports.ValueBuilder = void 0;
var Parser_1 = require("./Parser");
var GrammarCompiler_1 = require("./GrammarCompiler");
var ValueBuilder = /** @class */ (function () {
    function ValueBuilder(grammar, functions) {
        this.grammar = grammar;
        this.functions = functions || {};
    }
    ValueBuilder.prototype.buildValue = function (frame) {
        var e_1, _a;
        var rule = frame.node;
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
                        Object.defineProperty(captureValues[capture.captureIndex], "repeated", { configurable: true, enumerable: false, value: true });
                    }
                    else {
                        // this is a solo capture
                        Parser_1.assert(captureValues[capture.captureIndex] === null);
                        captureValues[capture.captureIndex] = capture.value;
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
        return this.value(rule.value, captureValues, { position: frame.pos, length: frame.consumed });
    };
    ValueBuilder.prototype.value = function (node, captureValues, metas) {
        var e_2, _a;
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
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
        return out;
    };
    ValueBuilder.prototype.backref = function (node, captures) {
        var e_3, _a;
        var cap = captures[node.index];
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
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (cap_1_1 && !cap_1_1.done && (_a = cap_1.return)) _a.call(cap_1);
                }
                finally { if (e_3) throw e_3.error; }
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
    ValueBuilder.prototype.pivot = function (node, captures, metas) {
        var e_4, _a;
        var _this = this;
        var value = this.value(node.value, captures, metas);
        if (!Array.isArray(value)) {
            GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidPivot, this.grammar.text, node.meta, JSON.stringify(value));
        }
        value.map(function (item) {
            if (!Array.isArray(item)) {
                GrammarCompiler_1.grammarError(Parser_1.ErrorCode.InvalidPivot, _this.grammar.text, node.meta, JSON.stringify(item));
            }
            if (item.length != value[0].length) {
                GrammarCompiler_1.grammarError(Parser_1.ErrorCode.PivotArraySizeMismatch, _this.grammar.text, node.meta);
            }
        });
        var ret = [];
        try {
            for (var _b = __values(value[0]), _c = _b.next(); !_c.done; _c = _b.next()) {
                var item = _c.value;
                ret.push([]);
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_4) throw e_4.error; }
        }
        for (var i = 0; i < value.length; i++) {
            for (var j = 0; j < value[0].length; j++) {
                ret[j][i] = value[i][j];
            }
        }
        return ret;
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
        if (!this.functions[node.name]) {
            GrammarCompiler_1.grammarError(Parser_1.ErrorCode.FunctionNotFound, this.grammar.text, node.meta, node.name);
        }
        else {
            return this.functions[node.name].apply(null, argVals);
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
