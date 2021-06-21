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
