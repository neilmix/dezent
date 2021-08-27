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
        if (!grammar.rulesetLookup["return"]) {
            Error_1.grammarError(Error_1.ErrorCode.ReturnNotFound, grammar.text);
        }
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
                let ret = (i[0].type == 'escape' && i[0].value != '\\' ? '\\' : '') + i[0].value;
                if (i[0].value != i[1].value) {
                    ret += '-';
                    ret += (i[1].type == 'escape' && i[0].value != '\\' ? '\\' : '') + i[1].value;
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
