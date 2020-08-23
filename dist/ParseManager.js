"use strict";
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
        var ruledefLookup = grammar.ruledefLookup = {};
        for (var _i = 0, _a = grammar.ruledefs; _i < _a.length; _i++) {
            var ruledef = _a[_i];
            if (ruledefLookup[ruledef.name]) {
                if (ruledef.name == 'return') {
                    grammarError(Parser_1.ErrorCode.MultipleReturn, text, ruledef.meta, ruledef.name);
                }
                else {
                    grammarError(Parser_1.ErrorCode.DuplicateDefine, text, ruledef.meta, ruledef.name);
                }
            }
            ruledefLookup[ruledef.name] = ruledef;
        }
        for (var _b = 0, _c = grammar.ruledefs; _b < _c.length; _b++) {
            var ruledef = _c[_b];
            var rules = ruledef.rules;
            for (var i = 0; i < rules.length; i++) {
                rules[i].ruledefName = ruledef["name"] || "return";
                rules[i].captures = this.compileRule(rules[i], grammar.vars, text);
            }
            // perform sanity checks
            visitParseNodes("ruleref", ruledef, null, null, function (node) {
                if (!ruledefLookup[node.name]) {
                    grammarError(Parser_1.ErrorCode.RuleNotFound, text, node.meta, node.name);
                }
            });
            // figure out if our selectors are capable of failing, which helps in
            // identifying expected tokens for good error messaging.
            visitParseNodes("pattern", ruledef, null, null, function (node) {
                for (var _i = 0, _a = node.tokens; _i < _a.length; _i++) {
                    var token = _a[_i];
                    if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                        node.canFail = true;
                        return;
                    }
                }
                node.canFail = false;
            });
            visitParseNodes(["capture", "group", "rule"], ruledef, null, null, function (node) {
                node.canFail = true;
                for (var _i = 0, _a = node.options; _i < _a.length; _i++) {
                    var pattern = _a[_i];
                    if (!pattern.canFail) {
                        node.canFail = false;
                        break;
                    }
                }
            });
            if (ruledef.name == 'return') {
                ruledef.canFail = true;
            }
            else {
                ruledef.canFail = true;
                for (var _d = 0, _e = ruledef.rules; _d < _e.length; _d++) {
                    var rule = _e[_d];
                    if (!rule.canFail) {
                        ruledef.canFail = false;
                        break;
                    }
                }
            }
        }
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
            if (node.type == "varref") {
                if (!vars[node.name]) {
                    grammarError(Parser_1.ErrorCode.InvalidVarRef, text, node.meta, node.name);
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
        // pre-process the grammar
        var ret;
        for (var _i = 0, _a = grammar.ruledefs; _i < _a.length; _i++) {
            var ruledef = _a[_i];
            if (ruledef.name == 'return') {
                ret = ruledef;
            }
        }
        if (!ret) {
            grammarError(Parser_1.ErrorCode.ReturnNotFound, text);
        }
        // now parse
        var parser = this.currentParser = new Parser_1.Parser(ret, text, grammar.ruledefLookup, this.options, this.debugLog);
        parser.parse();
        var builders = {
            backref: function (node, backrefs) {
                if (backrefs[node.index] === undefined) {
                    Parser_1.parserError(Parser_1.ErrorCode.BackRefNotFound);
                }
                else {
                    return backrefs[node.index];
                }
            },
            varref: function (node, backrefs, vars, metas) {
                var resolved = vars[node.name];
                return builders[resolved.type](resolved, backrefs, vars, metas);
            },
            metaref: function (node, backrefs, vars, metas) {
                return metas[node.name];
            },
            spread: function (node, backrefs, vars, metas) {
                // first convert to an array of arrays
                var resolved = [];
                for (var i = 0; i < node.refs.length; i++) {
                    var res = builders[node.refs[i].type](node.refs[i], backrefs, vars, metas);
                    if (!res || typeof res != 'object') {
                        grammarError(Parser_1.ErrorCode.InvalidSpread, grammar.text, node.meta);
                    }
                    if (Array.isArray(res)) {
                        resolved.push(res);
                    }
                    else {
                        var items = [];
                        for (var name_1 in res) {
                            items.push(name_1, res[name_1]);
                        }
                        resolved.push(items);
                    }
                }
                if (resolved.length <= 1) {
                    return resolved[0];
                }
                resolved.map(function (item) {
                    if (item.length != resolved[0].length) {
                        grammarError(Parser_1.ErrorCode.SpreadArraySizeMismatch, grammar.text, node.meta);
                    }
                });
                // now merge our arrays
                // breadth-first, across then down
                var ret = [];
                for (var i = 0; i < resolved[0].length; i++) {
                    for (var j = 0; j < resolved.length; j++) {
                        ret.push(resolved[j][i]);
                    }
                }
                return ret;
            },
            object: function (node, backrefs, vars, metas) {
                var ret = {};
                for (var _i = 0, _a = node.members; _i < _a.length; _i++) {
                    var member = _a[_i];
                    if (member.type == "spread") {
                        var items = builders.spread(member, backrefs, vars, metas);
                        for (var i = 0; i < items.length; i += 2) {
                            ret[items[i]] = items[i + 1];
                        }
                    }
                    else {
                        ret[builders[member.name.type](member.name, backrefs, vars, metas)]
                            = builders[member.value.type](member.value, backrefs, vars, metas);
                    }
                }
                return ret;
            },
            array: function (node, backrefs, vars, metas) {
                var ret = [];
                for (var _i = 0, _a = node.elements; _i < _a.length; _i++) {
                    var elem = _a[_i];
                    if (elem.type == "spread") {
                        ret = ret.concat(builders.spread(elem, backrefs, vars, metas));
                    }
                    else {
                        ret.push(builders[elem.type](elem, backrefs, vars, metas));
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
        return buildOutput(parser.output.result);
        function buildOutput(token) {
            if (Array.isArray(token)) {
                return token.map(function (v) { return buildOutput(v); });
            }
            else if (token == null) {
                return null;
            }
            else if (token.outputs && token.value) {
                var backrefs = token.outputs.map(function (v) { return buildOutput(v); });
                return builders[token.value.type](token.value, backrefs, grammar.vars, { position: token.pos, length: token.length });
            }
            else {
                return text.substr(token.pos, token.length);
            }
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
        if (this.rawGrammar) {
            console.error("Raw grammar:\n", this.rawGrammar);
        }
        if (this.compiledGrammar) {
            console.error("Compiled grammar:\n", JSON.stringify(this.compiledGrammar));
        }
        if (this.currentParser) {
            console.error("Parser stack:\n", this.currentParser.stack);
            console.error("Output stack:\n", this.currentParser.output.stack);
            if (this.currentParser.output.result) {
                console.error("Output:\n", JSON.stringify(this.currentParser.output.result));
            }
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
    if (enter && types.includes(root.type)) {
        enter(root, data);
    }
    var items = [];
    switch (root.type) {
        case "ruledef":
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
    if (exit && types.includes(root.type)) {
        exit(root, data);
    }
}
function visitOutputNodes(node, data, f) {
    f(node, data);
    var items;
    if (node.type == "spread") {
        items = node.refs;
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
