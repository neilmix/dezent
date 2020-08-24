
import { 
    ParserOptions, Parser, findDezentGrammar, ErrorCode, 
    parserError, parsingError, errorMessages, findLineAndChar
} from './Parser';

import { 
    Grammar, Node, SelectorNode, Meta, RuleDefNode, ReturnNode, RuleNode, TokenNode, PatternNode, RuleRefNode, ClassNode, AnyNode,
    ValueNode, ObjectNode, MemberNode, ArrayNode, BooleanNode, StringNode, NumberNode, BackRefNode, VarRefNode, 
    MetaRefNode, PivotNode, SpreadNode, StringTextNode, EscapeNode,
} from './Grammar';

import { OutputToken } from './OutputContext';

export class ParseManager {
    options:ParserOptions;
    debugLog:any[][] = [];
    currentParser:Parser;
    rawGrammar:string;
    compiledGrammar:Grammar;

    constructor(options?:ParserOptions) {
        this.options = options || {};
    }

    parseText(grammar:string|Grammar, text:string) : any {
        if (typeof grammar == "string") {
            grammar = this.parseAndCompileGrammar(grammar);
        }
    
        this.compiledGrammar = grammar;
        return this.parseTextWithGrammar(grammar, text);
    }

    parseAndCompileGrammar(text:string) : Grammar {
        try {
            let grammar = this.parseTextWithGrammar(findDezentGrammar(this.options), text);
            if (this.options.debugErrors) {
                this.rawGrammar = JSON.stringify(grammar);
            }
            this.compileGrammar(grammar, text);
            return grammar;
        } catch(e) {
            if (e["code"] == ErrorCode.TextParsingError) {
                parsingError(ErrorCode.GrammarParsingError, text, e["pos"], e["expected"]);
            } else {
                throw e;
            }
        }
    }

    compileGrammar(grammar:Grammar, text?:string) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // - other helpful sanity checks
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime

        grammar.text = text;

        let ruledefLookup = grammar.ruledefLookup = {};
        for (let ruledef of grammar.ruledefs) {
            if (ruledefLookup[ruledef.name]) {
                if (ruledef.name == 'return') {
                    grammarError(ErrorCode.MultipleReturn, text, ruledef.meta, ruledef.name);
                } else {
                    grammarError(ErrorCode.DuplicateDefine, text, ruledef.meta, ruledef.name);
                }
            }
            ruledefLookup[ruledef.name] = ruledef;
        }

        for (let ruledef of grammar.ruledefs) {
            let rules = ruledef.rules;
            for (let i = 0; i < rules.length; i++) {
                rules[i].ruledefName = ruledef["name"] || "return";
                rules[i].captures = this.compileRule(rules[i], grammar.vars, text);
            }

            // perform sanity checks
            visitParseNodes("ruleref", ruledef, null, null, (node:RuleRefNode) => {
                if (!ruledefLookup[node.name]) {
                    grammarError(ErrorCode.RuleNotFound, text, node.meta, node.name);
                }
            });

            // figure out if our selectors are capable of failing, which helps in
            // identifying expected tokens for good error messaging.
            visitParseNodes("pattern", ruledef, null, null, (node:PatternNode) => {
                for (let token of node.tokens) {
                    if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                        node.canFail = true;
                        return;
                    }
                }
                node.canFail = false;
            });
            visitParseNodes(["capture","group","rule"], ruledef, null, null, (node:SelectorNode) => {
                node.canFail = true;
                for (let pattern of node.options) {
                    if (!pattern.canFail) {
                        node.canFail = false;
                        break;
                    }
                }
            });
            if (ruledef.name == 'return') {
                ruledef.canFail = true;
            } else {
                ruledef.canFail = true;
                for (let rule of ruledef.rules) {
                    if (!rule.canFail) {
                        ruledef.canFail = false;
                        break;
                    }
                }
            }
        }
        
        return grammar;
    }

    compileRule(rule:RuleNode, vars:{[key:string]:ValueNode}, text:string) : boolean[] {
        // put an empty placeholder in captures so that the indices
        // align with backrefs (which begin at 1)
        let info = { captures: [null], repeats: 0, backrefs: [null] };
        let i = 0;
        let lastCount = -1;
        do {
            info.captures = [null];
            visitParseNodes(
                "token",
                rule.options[i], 
                info, 
                (node:TokenNode, info) => {
                    if (node.repeat) info.repeats++;
                    if (node.descriptor.type == "capture") {
                        node.descriptor.index = info.captures.length;
                        info.captures.push(info.repeats > 0);
                    }
                },
                (node:TokenNode, info) => {
                    if (node.repeat) info.repeats--;
                }
            );
            if (lastCount > -1 && lastCount != info.captures.length) {
                grammarError(ErrorCode.CaptureCountMismatch, text, rule.meta);
            }
            lastCount = info.captures.length;
            i++;
         } while (i < rule.options.length);
    
         visitParseNodes("string", rule, null, null, (node:StringNode) => {
            let matchString = buildString(node);
            node.pattern = matchString;
            node.match = (s) => s.startsWith(matchString) ? [true, matchString.length] : [false, 0];
         });

         visitParseNodes("class", rule, null, null, (node:ClassNode) => {
            for (let range of node.ranges) {
                range.map((bound) => {
                    if (bound.type == 'escape') {
                        if (bound.value[0] == 'u') {
                            bound.match = String.fromCharCode(parseInt(bound.value.substr(1), 16));
                        } else {
                            bound.match = ({
                                'n': '\n',
                                't': '\t',
                                'r': '\r',
                                'b': '\b',
                                'f': '\f',
                            })[bound.value] || bound.value;
                        }
                    } else {
                        bound.match = bound.value;
                    }
                });
            }
            node.pattern = node.ranges.map((i) => {
                let ret = (i[0].type == 'escape' ? '\\' : '') + i[0].value;
                if (i[0].value != i[1].value) {
                    ret += '-';
                    ret += (i[1].type == 'escape' ? '\\' : '') + i[1].value
                }
                return ret;
            }).join(' ');
            node.match = (s) => {
                for (let range of node.ranges) {
                    if (s[0] >= range[0].match && s[0] <= range[1].match) {
                        return [true, 1];
                    }
                }
                return [false, 0];
            }
         });

         visitParseNodes("any", rule, null, null, (node:AnyNode) => {
            node.match = (s) => {
                return s.length ? [true, 1] : [false, 0];
            }
            node.pattern = '';
         });

         visitOutputNodes(rule.value, info, (node:ValueNode, info) => {
            if (node.type == "backref") info.backrefs.push(node);
            if (node.type == "varref") {
                if (!vars[node.name]) {
                    grammarError(ErrorCode.InvalidVarRef, text, node.meta, node.name);
                }
            }
         });
    
         for (let i = 1; i < info.backrefs.length; i++) {
             if (info.backrefs[i].index >= info.captures.length) {
                 grammarError(ErrorCode.InvalidBackRef, text, info.backrefs[i].meta, info.backrefs[i].index);
             }
         }
        return info.captures;
    }

    parseTextWithGrammar(grammar:Grammar, text:string) : any {
        // pre-process the grammar
        let ret:ReturnNode;
    
        for (let ruledef of grammar.ruledefs) {
            if (ruledef.name == 'return') {
                ret = <ReturnNode>ruledef;
            }
        }
    
        if (!ret) {
            grammarError(ErrorCode.ReturnNotFound, text);
        }
    
        // now parse
        let parser = this.currentParser = new Parser(ret, text, grammar.ruledefLookup, this.options, this.debugLog);
        parser.parse();

        let builders : {
            [key:string]: (
                node: ValueNode, 
                backrefs: OutputToken[], 
                vars: { [key:string]: ValueNode }, 
                metas: { position: number, length: number }
            ) => any
        } = {
            backref: (node:BackRefNode, backrefs) => {
                if (backrefs[node.index] === undefined) {
                    parserError(ErrorCode.BackRefNotFound);
                } else {
                   return backrefs[node.index];
                }
            },
            varref: (node:VarRefNode, backrefs, vars, metas) => {
                let resolved = vars[node.name];
                return builders[resolved.type](resolved, backrefs, vars, metas);
            },
            metaref: (node:MetaRefNode, backrefs, vars, metas) => {
                return metas[node.name];
            },
            pivot: (node:PivotNode, backrefs, vars, metas) => {
                let value = builders[node.value.type](node.value, backrefs, vars, metas);
                if (!Array.isArray(value)) {
                    grammarError(ErrorCode.InvalidPivot, grammar.text, node.meta, JSON.stringify(value));
                }
                value.map((item) => {
                    if (!Array.isArray(item)) {
                        grammarError(ErrorCode.InvalidPivot, grammar.text, node.meta, JSON.stringify(item));
                    }
                    if (item.length != value[0].length) {
                        grammarError(ErrorCode.PivotArraySizeMismatch, grammar.text, node.meta);
                    }
                })
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
            },
            spread: (node:SpreadNode, backrefs, vars, metas) => {
                let value = builders[node.value.type](node.value, backrefs, vars, metas);
                if (!value || (typeof value != 'object' && typeof value != 'string')) {
                    grammarError(ErrorCode.InvalidSpread, grammar.text, node.meta, JSON.stringify(value));
                }
                if (typeof value == "string") {
                    return value.split('');
                } else if (Array.isArray(value)) {
                    return value;
                } else {
                    return Object.entries(value);
                }
            },
            object: (node:ObjectNode, backrefs, vars, metas) => {
                let ret = {};
                for (let member of node.members) {
                    if (member.type == "spread") {
                        let tuples = builders.spread(member, backrefs, vars, metas);
                        for (let tuple of tuples) {
                            if (!Array.isArray(tuple) || tuple.length != 2) {
                                grammarError(ErrorCode.InvalidObjectTuple, grammar.text, member.meta, JSON.stringify(tuple));
                            }
                            ret[tuple[0]] = tuple[1];
                        }
                    } else {
                        ret[builders[member.name.type](member.name, backrefs, vars, metas)] 
                            = builders[member.value.type](member.value, backrefs, vars, metas);
                    }
                }
                return ret;
            },
            array: (node:ArrayNode, backrefs, vars, metas) => {
                let ret = [];
                for (let elem of node.elements) {
                    if (elem.type == "spread") {
                        ret = ret.concat(builders.spread(elem, backrefs, vars, metas));
                    } else {
                        let val = builders[elem.type](elem, backrefs, vars, metas);
                        if (!elem.collapse || val != null) {
                            ret.push(val);
                        }
                    }
                }
                return ret;
            },
            string: (node:StringNode) => {
                return buildString(node);
            },
            number: (node:NumberNode) => {
                return Number(node.value);
            },
            boolean: (node:BooleanNode) => {
                return node.value;
            },
            null: () => {
                return null;
            },
        };
                
        // build our output value    
        return buildOutput(parser.output.result);
    
        function buildOutput(token:OutputToken|OutputToken[]) {
            if (Array.isArray(token)) {
                return token.map((v) => buildOutput(v));
            } else if (token == null) {
                return null;
            } else if (token.outputs && token.value) {
                let backrefs = token.outputs.map((v) => buildOutput(v));
                return builders[token.value.type](
                    token.value, 
                    backrefs, 
                    grammar.vars,
                    { position: token.pos, length: token.length }
                );
            } else {
                return text.substr(token.pos, token.length);
            }
        }
    }

    debug(...args:any[]) {
        if (this.options.debugErrors) {
            this.debugLog.push(args);
        }
    }

    dumpDebug() {
        let lines = [];
        for (let msg of this.debugLog) {
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
    }
}

function buildString(node:StringNode) {
    return node.tokens.map((node:StringTextNode|EscapeNode) => {
        if (node.type == "text") {
            return node.value;
        } else if (node.value[0] == 'u') {
            return String.fromCharCode(Number(`0x${node.value.substr(1)}`));
        } else if(node.value.length > 1) {
            parserError(ErrorCode.Unreachable);
        } else if ("bfnrt".indexOf(node.value) >= 0) {
            return ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[node.value];
        } else {
            return node.value;
        }
    }).join("")
}

function visitParseNodes(
    types:string|string[], 
    root:Node, 
    data?, 
    enter?:(node:Node,data)=>void, 
    exit?:(node:Node,data)=>void) 
{
    if (typeof types == "string") {
        types = [types];
    }
    if (enter && types.includes(root.type)) {
        enter(root, data);
    }
    let items = [];
    switch(root.type) {
        case "ruledef": items = (<RuleDefNode>root).rules; break;
        case "rule": case "capture": case "group": items = (<SelectorNode>root).options; break;
        case "pattern": items = (<PatternNode>root).tokens; break;
        case "token": items = [(<TokenNode>root).descriptor]; break;
        default: break;
    }
    for (let item of items) {
        visitParseNodes(types, item, data, enter, exit);
    }
    if (exit && types.includes(root.type)) {
        exit(root, data);
    }
}

function visitOutputNodes(node:ValueNode|MemberNode, data, f:Function) {
    f(node, data);
    let items;
    if (node.type == "spread" || node.type == "pivot") {
        items = [node.value];
    } else if (node.type == "array") {
        items = node.elements;
    } else if (node.type == "object") {
        items = node.members;
    } else if (node.type == "member") {
        visitOutputNodes(node.name, data, f);
        items = [node.value];
    }
    if (items) {
        for (let item of items) {
            visitOutputNodes(item, data, f);
        }
    }
}

export function grammarError(code:ErrorCode, text?:string, meta?:Meta, ...args:string[]) {
    let reason = errorMessages[code].replace(/\$([0-9])/g, (match, index) => args[index-1]);
    let msg = `Grammar error ${code}: ${reason}`;
    let info;
    if (text && meta) {
        info = findLineAndChar(text, meta.pos);
        msg = `${msg}\nAt line ${info.line} char ${info.char}:\n${info.lineText}\n${info.pointerText}\n`;
    }
    let e = new Error(msg);
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
