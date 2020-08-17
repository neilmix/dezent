
import { 
    ParserOptions, Parser, findDezentGrammar, ErrorCode, 
    parserError, parsingError, grammarError
} from './Parser';

import { 
    Grammar, Node, SelectorNode, DefineNode, ReturnNode, RuleNode, TokenNode, PatternNode, ClassNode, AnyNode,
    ValueNode, ObjectNode, MemberNode, ArrayNode, BooleanNode, StringNode, NumberNode, BackRefNode, SplatNode, 
    StringTextNode, EscapeNode,
} from './Grammar';

import { OutputToken } from './OutputContext';

let builders:any = {
    backref: (node:BackRefNode, backrefs:OutputToken[]) => {
        if (backrefs[node.index] === undefined) {
            parserError(ErrorCode.BackRefNotFound);
        } else {
           return backrefs[node.index];
        }
    },
    splat: (node:SplatNode, backrefs:OutputToken[]) => {
        // remember our backref indices start at 0
        if (backrefs.length <= 1) {
            return [];
        }

        // first convert to an array of arrays
        let resolved = [];
        for (let i = 0; i < node.backrefs.length; i++) {
            let res = builders.backref(node.backrefs[i], backrefs);
            if (!res || typeof res != 'object') {
                grammarError(ErrorCode.InvalidSplat, String(i));
            }
            if (Array.isArray(res)) {
                resolved.push(res);
            } else {
                let items = [];
                for (let name in res) {
                    items.push(name, res[name]);
                }
                resolved.push(items);
            }
        }
        if (resolved.length <= 1) {
            return resolved[0];
        }
        // now merge our arrays
        // breadth-first, across then down
        let ret = [];
        for (let i = 0; i < resolved[0].length; i++) {
            for (let j = 0; j < resolved.length; j++) {
                ret.push(resolved[j][i]);
            }
        }
        return ret;
    },
    object: (node:ObjectNode, backrefs:OutputToken[]) => {
        let ret = {};
        for (let member of node.members) {
            if (member.type == "splat") {
                let items = builders.splat(member, backrefs);
                for (let i = 0; i < items.length; i += 2) {
                    ret[items[i]] = items[i+1];
                }
            } else {
                ret[builders[member.name.type](member.name, backrefs)] = builders[member.value.type](member.value, backrefs);
            }
        }
        return ret;
    },
    array: (node:ArrayNode, backrefs:OutputToken[]) => {
        let ret = [];
        for (let elem of node.elements) {
            if (elem.type == "splat") {
                ret = ret.concat(builders.splat(elem, backrefs));
            } else {
                ret.push(builders[elem.type](elem, backrefs));
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
            this.compileGrammar(grammar);
            return grammar;
        } catch(e) {
            if (e["code"] == ErrorCode.TextParsingError) {
                parsingError(ErrorCode.GrammarParsingError, text, e["pos"], e["expected"]);
            } else {
                throw e;
            }
        }
    }

    compileGrammar(grammar:Grammar) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        for (let item of grammar) {
            let rules = item.rules;
            for (let i = 0; i < rules.length; i++) {
                rules[i].defineName = item["name"] || "return";
                let [code, captures, index] = this.compileRule(rules[i]);
                if (code != 0) {
                    grammarError(code, item["name"] || item.type, String(i), index);
                }
                rules[i].captures = captures;
            }

            // figure out if our selectors are capable of failing, which helps in
            // identifying expected tokens for good error messaging.
            visitParseNodes("pattern", item, null, null, (node:PatternNode) => {
                for (let token of node.tokens) {
                    if (token.required && !(token.descriptor.type == "string" && token.descriptor.pattern == '')) {
                        node.canFail = true;
                        return;
                    }
                }
                node.canFail = false;
            });
            visitParseNodes(["capture","group","rule"], item, null, null, (node:SelectorNode) => {
                node.canFail = true;
                for (let pattern of node.options) {
                    if (!pattern.canFail) {
                        node.canFail = false;
                        break;
                    }
                }
            });
            if (item.name == 'return') {
                item.canFail = true;
            } else {
                item.canFail = true;
                for (let rule of item.rules) {
                    if (!rule.canFail) {
                        item.canFail = false;
                        break;
                    }
                }
            }
        }

        
        return grammar;
    }

    compileRule(rule:RuleNode) : [ErrorCode|0, boolean[], any] {
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
                return [ErrorCode.CaptureCountMismatch, info.captures, null];
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
         })
    
         for (let i = 1; i < info.backrefs.length; i++) {
             if (info.backrefs[i].index >= info.captures.length) {
                 return [ErrorCode.InvalidBackRef, info.captures, info.backrefs[i].index];
             }
         }
        return [0, info.captures, null];
    }

    parseTextWithGrammar(grammar:Grammar, text:string) : any {
        // pre-process the grammar
        let defines: {[key:string]:DefineNode} = {};
        let ret:ReturnNode;
    
        for (let statement of grammar) {
            if (defines[statement.name]) {
                grammarError(ErrorCode.DuplicateDefine, statement.name);
            }
            defines[statement.name] = statement;

            if (statement.name == 'return') {
                ret = <ReturnNode>statement;
            }
        }
    
        if (!ret) {
            grammarError(ErrorCode.ReturnNotFound);
        }
    
        // now parse
        let parser = this.currentParser = new Parser(ret, text, defines, this.options, this.debugLog);
        parser.parse();
    
        // build our output value    
        return buildOutput(parser.output.result);
    
        function buildOutput(token:OutputToken|OutputToken[]) {
            if (Array.isArray(token)) {
                return token.map((v) => buildOutput(v));
            } else if (token == null) {
                return null;
            } else if (token.outputs && token.value) {
                let backrefs = token.outputs.map((v) => buildOutput(v));
                return builders[token.value.type](token.value, backrefs);
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
        case "define": items = (<DefineNode>root).rules; break;
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
    if (node.type == "splat") {
        items = node.backrefs;
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
