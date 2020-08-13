// todo:
// - parse error line number and position (best match)
// - object <-> splats
// - template -> pattern
// - backrefs -> outvals where appropriate
// - test (/x*/)*
// - check that consumed == text.length...
// - command line script
// - node position for post-parse error messages (e.g. NonArraySplat)
// - performance/scale testing
// - double-check grammar backrefs
// - package license
// - release?
// - packrat parsing
// - $0

// speculative todo:
// - error recovery
// - chunked parsing

import { 
    Grammar, dezentGrammar, DefineNode, ReturnNode, 
    ParseNode, RuleNode, OptionNode, CaptureNode,  TokenNode,
    ValueNode, BackRefNode, SplatNode, ObjectNode, ArrayNode, StringNode, 
    StringTextNode, StringEscapeNode, NumberNode, BooleanNode, MemberNode
 } from "./Grammar";
import { info } from "console";

export enum ErrorCode {
    DuplicateDefine           = 1001,
    MultipleReturn            = 1002,
    RuleNotFound              = 1003,
    InvalidSplat              = 1004,
    SplatArraySizeMismatch    = 1005,
    ReturnNotFound            = 1006,
    CaptureCountMismatch      = 1007,
    InvalidBackRef            = 1008,

    ArrayOverrun              = 2001,
    MismatchOutputFrames      = 2002,
    CaptureAlreadyInProgress  = 2003,
    MismatchEndCapture        = 2004,
    EmptyOutput               = 2005,
    Unreachable               = 2006,
    BackRefNotFound           = 2007,
    CaptureOutputNotFound     = 2008,
    InputConsumedBeforeResult = 2009,
    MultipleOutputsForCapture = 2010,
}

const errorMessages = {
    1001: "Multiple rules defined with the same name: $1",
    1002: "Grammars are only allowed to have one return statement",
    1003: "Grammar does not contain a rule named '$1'",
    1004: "Back reference used in splat is neither an array nor object: $$1",
    1005: "All arrays in a splat must be of the same length",
    1006: "Grammar does not contain a return rule",
    1007: "Not all options for rule $2 of $1 have the same number of captures",
    1008: "Invalid back reference $$3 for rule $2 of $1",
    2001: "Array overrun",
    2002: "Mismatched output frames",
    2003: "Capture already in progress",
    2004: "Mismatched ending capture",
    2005: "Output frame did not contain an output token",
    2006: "Should not be possible to reach this code",
    2007: "Back reference does not exist",
    2008: "No output was found during capture",
    2009: "The result does not start at input index 0",
    2010: "Multiple outputs were found for a non-repeating capture",
}

let dezentGrammarFound = false;

function findDezentGrammar(options:ParserOptions) : Grammar{
    if (!dezentGrammarFound) {
        new ParseManager(options).compileGrammar(dezentGrammar);
        dezentGrammarFound = true;
    }
    return dezentGrammar;
}

export interface ParserOptions {
    debugErrors?: boolean,
}

export function parseText(grammar:string|Grammar, text:string, options?:ParserOptions) : any {
    let mgr = new ParseManager(options);
    try {
        return mgr.parseText(grammar, text);
    } catch(e) {
        if (options && options.debugErrors) mgr.dumpDebug();
        throw e;
    }
}

export function parseGrammar(grammar:string, options?:ParserOptions) : Grammar {
    let mgr = new ParseManager(options);
    try {
        return mgr.parseAndCompileGrammar(grammar);
    } catch(e) {
        if (options && options.debugErrors) mgr.dumpDebug();
        throw e;
    }    
}

export function parseTextWithGrammar(grammar:Grammar, text:string, options?:ParserOptions) : any {
    let mgr = new ParseManager(options);
    try {
        return mgr.parseTextWithGrammar(grammar, text);
    } catch(e) {
        if (options && options.debugErrors) mgr.dumpDebug();
        throw e;
    }    
}

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


class ParseManager {
    options:ParserOptions;
    debugLog:any[][] = [];
    currentParser:Parser;
    rawGrammar:any;
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
        let grammar = this.parseTextWithGrammar(findDezentGrammar(this.options), text);
        this.rawGrammar = grammar;
        this.compileGrammar(grammar);
        return grammar;
    }

    compileGrammar(grammar:Grammar) {
        // compile and validate
        // - count the number of backrefs in each rule
        // - validate that all options contain that many backrefs
        // - validate that all backreferences are legit
        // We have to do this up-front because not every branch
        // of the grammar tree may be visited/executed at runtime
        for (let item of grammar) {
            let rules : RuleNode[];
            if (item.type == "return") {
                rules = [item.rule];
            } else {
                rules = item.rules;
            }
            for (let i = 0; i < rules.length; i++) {
                rules[i].defineName = item["name"] || "return";
                let [code, captures, index] = this.compileRule(rules[i]);
                if (code != 0) {
                    grammarError(code, item["name"] || item.type, String(i), index);
                }
                rules[i].captures = captures;
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
            visitOptionChildren(
                rule.options[i], 
                info, 
                (node:TokenNode, info) => {
                    if (node.repeat) info.repeats++;
                    if (node.descriptor.type == "capture") {
                        node.descriptor.index = info.captures.length;
                        info.captures.push(info.repeats > 0);
                    }
                    if (node.descriptor.type == "string") {
                        let matchString = buildString(node.descriptor);
                        if (this.options.debugErrors) {
                            node.descriptor["pattern"] = matchString;
                        }
                        node.descriptor.match = (s) => s.startsWith(matchString) ? [true, matchString.length] : [false, 0];
                    }
                    if (node.descriptor.type == "regex") {
                        let regex = new RegExp(`^${node.descriptor.pattern}`)
                        node.descriptor.match = (s) => {
                            let result = regex.exec(s);
                            return result ? [true, result[0].length] : [false, 0];
                        }
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
            switch (statement.type) {
                case "define":
                    if (defines[statement.name]) {
                        grammarError(ErrorCode.DuplicateDefine, statement.name);
                    }
                    defines[statement.name] = statement;
                    break;
                case "return":
                    if (ret) grammarError(ErrorCode.MultipleReturn);
                    ret = statement;
                    break;
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
            lines.push(msg.join(" "));
        }
        console.error("Debug log:\n", lines.join("\n"));
        if (this.compiledGrammar) {
            console.error("Raw grammar:\n", JSON.stringify(this.rawGrammar));
        }
        if (this.compiledGrammar) {
            console.error("Compiled grammar:\n", JSON.stringify(this.compiledGrammar));
        }
        if (this.currentParser) {
            console.error("Parser stack:\n", this.currentParser.stack);
            console.error("Output stack:\n", this.currentParser.output.stack);
        }
        if (this.currentParser.output.result) {
            console.error("Output:\n", JSON.stringify(this.currentParser.output.result));
        }
    }
}

function visitOptionChildren(node:OptionNode, data, enter:Function, exit:Function) {
    for (let child of node.tokens) {
        enter(child, data);
        let childOptions = child.descriptor["options"];
        if (childOptions) {
            for (let opt of childOptions) {
                visitOptionChildren(opt, data, enter, exit);
            }
        }
        exit(child, data);
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

enum MatchStatus {
    Continue,
    Pass,
    Fail
}

type ParseContextFrame = {
    status: MatchStatus,
    node: ParseNode,
    items: RuleNode[] | OptionNode[] | TokenNode[],
    index: number,
    pos: number,
    consumed: number,
}

type OutputFrame = {
    node : ReturnNode|DefineNode,
    rule?: RuleNode,
    captureNode : CaptureNode|null,
    capture: OutputToken[],
    tokens : OutputToken[],
    tokensStack : OutputToken[][],
    output?: OutputToken,
}

interface OutputToken {
    captureIndex?: number,
    pos: number,
    length: number,
    outputs?: (OutputToken|OutputToken[])[]
    value?: ValueNode,
}

class OutputContext {
    stack:OutputFrame[] = [];
    top:OutputFrame = null;
    result:OutputToken;

    constructor() {
    }

    enterFrame(node:ReturnNode|DefineNode) {
        this.top = {
            node: node,
            captureNode: null,
            capture: [],
            tokens: [],
            tokensStack: [],
        };
        this.stack.push(this.top);
    }

    exitFrame(node:ReturnNode|DefineNode, success:boolean) {
        let frame = this.stack.pop();
        this.top = this.stack[this.stack.length - 1];
        if (frame.node != node) {
            parserError(ErrorCode.MismatchOutputFrames);
        }
        if (success) {
            if (!frame.output) {
                // whoops, yield was never called
                parserError(ErrorCode.EmptyOutput);
            }
            this.addTokenObject(frame.output);
        }
    }

    enterGroup() {
        this.top.tokensStack.push(this.top.tokens);
        this.top.tokens = [];
    }

    exitGroup(success:boolean) {
        if (success) {
            let index = this.top.tokensStack.length - 1;
            this.top.tokensStack[index] = this.top.tokensStack[index].concat(this.top.tokens);
        }
        this.top.tokens = this.top.tokensStack.pop();
    }

    startCapture(node:CaptureNode) {
        if (this.top.captureNode) {
            parserError(ErrorCode.CaptureAlreadyInProgress);
        }
        this.top.captureNode = node;
        this.top.capture = [];
    }

    endCapture(node:CaptureNode, success:boolean) {
        if (this.top.captureNode != node) {
            parserError(ErrorCode.MismatchEndCapture);
        }

        if (success) {
            // move our capture into an output
            let token:OutputToken;
            if (this.top.capture.length > 1) {
                this.top.tokens.push({
                    captureIndex: this.top.captureNode.index,
                    pos: this.top.capture[0].pos,
                    length: this.top.capture.reduce((t, c) => t + c.length, 0)
                });
            } else if (this.top.capture.length == 1) {
                this.top.tokens.push(this.top.capture[0]);
            } else {
                // didn't match...
            }
        }

        this.top.captureNode = null;
    }

    addToken(pos, consumed) {
        this.addTokenObject({
            pos: pos,
            length: consumed
        });
    }

    addTokenObject(token:OutputToken) {
        if (!this.top) {
            // parsing is complete
            this.result = token;
        } else if (this.top && this.top.captureNode) { 
            // store our result, but only if capturing
            // Note that we may be changing the capture index if this is
            // an output being transferred to another frame on exit.
            token.captureIndex = this.top.captureNode.index;
            this.top.capture.push(token);
        }
    }

    yield(rule:RuleNode, startPos:number, consumed:number) {
        // first item is empty so indices align...
        let outputs:(OutputToken|OutputToken[])[] = [];
        for (let multi of this.top.rule.captures) {
            outputs.push(multi ? [] : null);
        }
        for (let token of this.top.tokens) {
            if (this.top.rule.captures[token.captureIndex]) {
                outputs[token.captureIndex]["push"](token);
            } else {
                if (outputs[token.captureIndex]) {
                    parserError(ErrorCode.MultipleOutputsForCapture);
                }
                outputs[token.captureIndex] = token;
            }
        }
        // find optional values that never matched and mark as null
        for (let i = 1; i < outputs.length; i++) {
            if (!outputs[i]) {
                outputs[i] = {
                    pos: startPos,
                    length: consumed,
                    outputs: [],
                    value: { type: "null" }
                }
            }
        }
        this.top.output = {
            pos: startPos,
            length: consumed,
            outputs: outputs,
            value: rule.value
        }
    }

    reset(rule:RuleNode) {
        this.top.rule = rule;
        this.top.tokens = [];
    }
}

class Parser {
    stack : ParseContextFrame[] = [];
    text : string;
    defines: {[key:string]:DefineNode};
    output : OutputContext = new OutputContext();
    options : ParserOptions;
    debugLog : any[][];
    
    constructor(root:ReturnNode, text:string, defines:{[key:string]:DefineNode}, options:ParserOptions, debugLog:string[][]) {
        this.text = text;
        this.defines = defines;
        this.options = options || {};
        this.debugLog = debugLog;
        this.enter(root);
    }

    parse() {
        while (this.stack.length) {
            let current = this.top();

            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }

            /*this.debug(
                this.text.substr(current.pos, 10), 
                [current.items.length, current.index].join(),
                current.status, 
                this.stack.length, 
                current.pos+":"+current.consumed,
                current.node.type, 
                current.node["pattern"]||current.node["name"]
            );*/

            switch (current.status) {
                case MatchStatus.Continue:
                    switch (current.node.type) {
                        default:
                            this.enter(current.items[current.index]);
                            break;
                        case "ruleref":
                            let def = this.defines[current.node.name];
                            if (!def) {
                                grammarError(ErrorCode.RuleNotFound, current.node.name);
                            }
                            this.enter(def);
                            break;
                        case "string":
                        case "regex":
                            let text = this.text.substr(this.top().pos);
                            let [matched, consumed] = current.node.match(text);
                            this.debug("MATCH", matched, consumed, current.node["pattern"], text);
                            if (matched) {
                                this.debug("TOKEN add", this.text.substr(current.pos, consumed));
                                this.output.addToken(current.pos, consumed);
                                current.consumed = consumed;
                                current.status = MatchStatus.Pass;
                            } else {
                                current.status = MatchStatus.Fail;
                            }
                            break;
                    }
                    break;
                case MatchStatus.Pass:
                    let exited = this.stack.pop();
                    if (["capture","group"].includes(exited.node.type)) {
                        this.output.exitGroup(true);
                    }
                    this.debug("EXIT", exited.node.type, exited.node["name"]||exited.node["pattern"], true);
                    let next = this.top();
                    if (next) {
                        next.consumed += exited.consumed;
                        if (next.node.type == "option") {
                            if (++next.index >= next.items.length) {
                                next.status = MatchStatus.Pass;
                            } // otherwise stay at Continue
                        } else {
                            next.status = MatchStatus.Pass;
                        }
                        switch (next.node.type) {
                            case "return":
                            case "define":
                                this.output.exitFrame(next.node, true);
                                break;
                            case "rule":
                                this.debug("YIELD", this.text.substr(exited.pos, exited.consumed));
                                this.output.yield(next.node, exited.pos, exited.consumed);
                                break;
                            case "token":
                                if (next.node.repeat) {
                                    this.enter(next.node.descriptor);
                                }
                                break;
                            case "capture":
                                this.debug("CAPTURE end", next.node.index);
                                this.output.endCapture(next.node, true);        
                                break;
                        }
                    } else {
                        // our parsing is complete!
                    }
                    break;

                case MatchStatus.Fail:
                    exited = this.stack.pop();
                    if (["capture","group"].includes(exited.node.type)) {
                        this.output.exitGroup(false);
                    }
                    this.debug("EXIT", exited.node.type, exited.node["name"]||exited.node["pattern"], false);
                    next = this.top();
                    if (["define", "rule", "capture", "group"].includes(next.node.type)) {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Fail;
                        }
                    } else if (next.node.type == "token") {
                        if (!next.node.required) {
                            // nodes that are not required always pass
                            next.status = MatchStatus.Pass;
                        } else if (next.status == MatchStatus.Continue) {
                            // this node's descriptor never passed - it failed
                            next.status = MatchStatus.Fail;
                        } // it is already marked as Pass
                    } else {
                        next.status = MatchStatus.Fail;
                    }
                    switch (next.node.type) {
                        case "return":
                            throw new Error("Document is not parsable.")
                        case "define":
                            if (next.status == MatchStatus.Fail) {
                                this.output.exitFrame(next.node, false);
                            }
                            break;
                        case "capture":
                            if (next.status == MatchStatus.Fail) {
                                this.debug("CAPTURE end", next.node.index);
                                this.output.endCapture(next.node, false);
                            }
                            break;
                    }
                    break;
                default:
                    parserError(ErrorCode.Unreachable);
            }
        } 

        if (!this.output.result) {
            throw new Error("Parse did not produce output");
        }
        if (this.output.result.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (this.output.result.length != this.text.length) {
            throw new Error("Parse did not consume all input");
        }
    }

    enter(node:ParseNode) {
        let current = this.top();
        let items;

        this.debug("ENTER", node.type, node["name"]||node["pattern"]);
        switch (node.type) {
            case "return": 
                items = [node.rule]; 
                this.output.enterFrame(node);
                break;
            case "define": 
                items = node.rules;
                this.output.enterFrame(node);
                break;
            case "rule": 
                this.debug("RESET");
                this.output.reset(node);
                items = node.options; 
                break;
            case "capture": 
                this.output.enterGroup();
                this.output.startCapture(node);
                this.debug("CAPTURE start", node.index);
                items = node.options; 
                break;
            case "group": 
                this.output.enterGroup();
                items = node.options; 
                break;
            case "option": 
                items = node.tokens; 
                break;
            case "token":
                items = [node.descriptor];
                break;
            default:
                items = [];
                break;
        }
        this.stack.push({
            status: MatchStatus.Continue,
            node: node,
            items: items,
            index: 0,
            pos: current ? current.pos + current.consumed : 0,
            consumed: 0,
        })
    }

    top() : ParseContextFrame|null { 
        return this.stack[this.stack.length-1] 
    }

    debug(...args:any[]) {
        if (this.options.debugErrors) {
            args.unshift(' '.repeat(this.stack.length));
            this.debugLog.push(args);
        }
    }
}

function buildString(node:StringNode) {
    return node.tokens.map((node:StringTextNode|StringEscapeNode) => {
        if (node.type == "text") {
            return node.value;
        } else if (node.value[0] == 'u') {
            return String.fromCharCode(Number(`0x${node.value.substr(1)}`));
        } else if ("bfnrt".indexOf(node.value[1]) >= 0) {
            return ({ b:'\b', f:'\f', n:'\n', r:'\r', t:'\t' })[node.value[1]];
        } else {
            return node.value.substr(1);
        }
    }).join("")
}

function grammarError(code:ErrorCode, ...args:string[]) {
    let msg = errorMessages[code].replace(/\$([0-9])/, (match, index) => args[index-1]);
    throw new Error(`Grammar error ${code}: ${msg}`);
}    

function parserError(code:ErrorCode) {
    let msg = errorMessages[code];
    throw new Error(`Internal parser error ${code}: ${msg}`);
}