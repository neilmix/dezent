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
exports.buildString = exports.ValueBuilder = void 0;
var Parser_1 = require("./Parser");
var ParseManager_1 = require("./ParseManager");
var ValueBuilder = /** @class */ (function () {
    function ValueBuilder(grammar, output) {
        this.grammar = grammar;
        this.output = output;
    }
    ValueBuilder.prototype.value = function (node, captures, metas) {
        if (!this.output)
            return undefined;
        if (!node) {
            node = this.output.rule.value;
            captures = this.buildCaptures(this.output);
            metas = { position: this.output.position, length: this.output.length };
        }
        var out = this[node.type](node, captures, metas);
        if (node.access)
            for (var _i = 0, _a = node.access; _i < _a.length; _i++) {
                var prop = _a[_i];
                if (out == null || (typeof out != 'object' && typeof out != 'string')) {
                    ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidAccessRoot, this.grammar.text, prop.meta, JSON.stringify(out));
                }
                var index = void 0;
                if (prop.value) {
                    index = this.value(prop.value, captures, metas);
                    if (typeof index != 'string' && typeof index != 'number') {
                        ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidAccessIndex, this.grammar.text, prop.meta, JSON.stringify(index));
                    }
                }
                else {
                    index = prop.name;
                }
                if (!out.hasOwnProperty(index)) {
                    ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidAccessProperty, this.grammar.text, prop.meta, index);
                }
                out = out[index];
            }
        return out;
    };
    ValueBuilder.prototype.buildCaptures = function (output) {
        var valueCaptures = output.rule.captures.map(function (b) { return b === true ? [] : null; });
        if (output.captures)
            for (var _i = 0, _a = output.captures; _i < _a.length; _i++) {
                var capture = _a[_i];
                var value = void 0;
                if (capture.rule) {
                    value = this.value(capture.rule.value, this.buildCaptures(capture), { position: capture.position, length: capture.length });
                }
                else {
                    Parser_1.assert(capture.segment !== undefined);
                    value = capture.segment;
                }
                Parser_1.assert(capture.captureIndex !== undefined);
                Parser_1.assert(capture.captureIndex < output.rule.captures.length);
                if (output.rule.captures[capture.captureIndex]) {
                    // this indicates the capture is an array
                    if (!valueCaptures[capture.captureIndex]) {
                        valueCaptures[capture.captureIndex] = [];
                    }
                    valueCaptures[capture.captureIndex].push(value);
                }
                else {
                    // this is a solo capture
                    Parser_1.assert(valueCaptures[capture.captureIndex] === null);
                    valueCaptures[capture.captureIndex] = value;
                }
            }
        return valueCaptures;
    };
    ValueBuilder.prototype.backref = function (node, captures) {
        var cap = captures[node.index];
        if (node.collapse && Array.isArray(cap)) {
            var ret = [];
            for (var _i = 0, cap_1 = cap; _i < cap_1.length; _i++) {
                var item = cap_1[_i];
                if (item != null) {
                    ret.push(item);
                }
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
        var _this = this;
        var value = this.value(node.value, captures, metas);
        if (!Array.isArray(value)) {
            ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidPivot, this.grammar.text, node.meta, JSON.stringify(value));
        }
        value.map(function (item) {
            if (!Array.isArray(item)) {
                ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidPivot, _this.grammar.text, node.meta, JSON.stringify(item));
            }
            if (item.length != value[0].length) {
                ParseManager_1.grammarError(Parser_1.ErrorCode.PivotArraySizeMismatch, _this.grammar.text, node.meta);
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
    };
    ValueBuilder.prototype.spread = function (node, captures, metas) {
        var value = this.value(node.value, captures, metas);
        if (!value || (typeof value != 'object' && typeof value != 'string')) {
            ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidSpread, this.grammar.text, node.meta, JSON.stringify(value));
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
        var ret = {};
        for (var _i = 0, _a = node.members; _i < _a.length; _i++) {
            var member = _a[_i];
            if (member.type == "spread") {
                var tuples = this.value(member, captures, metas);
                for (var _b = 0, tuples_1 = tuples; _b < tuples_1.length; _b++) {
                    var tuple = tuples_1[_b];
                    if (!Array.isArray(tuple) || tuple.length != 2) {
                        ParseManager_1.grammarError(Parser_1.ErrorCode.InvalidObjectTuple, this.grammar.text, member.meta, JSON.stringify(tuple));
                    }
                    // make sure our value isn't void...
                    if (tuple[1] !== undefined) {
                        ret[tuple[0]] = tuple[1];
                    }
                }
            }
            else {
                ret[this.value(member.name, captures, metas)]
                    = this.value(member.value, captures, metas);
            }
        }
        return ret;
    };
    ValueBuilder.prototype.array = function (node, captures, metas) {
        var ret = [];
        for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
            var elem = _a[_i];
            if (elem.type == "spread") {
                ret = ret.concat(this.value(elem, captures, metas));
            }
            else {
                var val = this.value(elem, captures, metas);
                if (val !== undefined // void
                    && ((elem.type == "backref" && !elem.collapse) || val !== null)) {
                    ret.push(val);
                }
            }
        }
        return ret;
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
    ValueBuilder.prototype["null"] = function () {
        return null;
    };
    ValueBuilder.prototype["void"] = function () {
        return undefined;
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
