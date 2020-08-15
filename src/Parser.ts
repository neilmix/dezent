// tagline:
// Parsing with the power of regular expressions plus recursion, readability, and structure.

// todo:
// - regex-like API
// - test string outputs
// - test hierarchical outputs
// - test backref outputs
// - test every dezent grammar rule
// - backrefs -> outputs where appropriate
// - command line script
// - node position for post-parse error messages (e.g. NonArraySplat)
// - performance/scale testing
// - double-check grammar backrefs
// - constants
// - how to deal with multiple members of same name?
// - documentation
// - package license
// - packrat parsing
// - @ values
// - release?
// - error messaging for not predicates

// speculative todo:
// - error recovery
// - chunked parsing
// - macros/functions, e.g. definition(pattern1, pattern2)
// - regex-like match-finding

import { 
    Grammar, createUncompiledDezentGrammar, DefineNode, ReturnNode,
    ParseNode, RuleNode, PatternNode, CaptureNode,  TokenNode, ClassNode,
    ValueNode, BackRefNode, SplatNode, ObjectNode, ArrayNode, StringNode, 
    StringTextNode, EscapeNode, NumberNode, BooleanNode, MemberNode
 } from "./Grammar";
import { info } from "console";

export enum ErrorCode {
    TextParsingError          = 1,
    GrammarParsingError       = 2,

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
    1:    "Parse failed: $3\nAt line $1 char $2:\n$4\n$5^",
    2:    "Error parsing grammar: $3\nAt line $1 char $2:\n$4\n$5^",
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

let dezentGrammar:Grammar;

export function findDezentGrammar(options?:ParserOptions) : Grammar{
    if (!dezentGrammar) {
        dezentGrammar = createUncompiledDezentGrammar();
        new ParseManager(options).compileGrammar(dezentGrammar);
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
                parsingError(ErrorCode.GrammarParsingError, text, e["pos"], e["reason"]);
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
                        node.descriptor.pattern = matchString;
                        node.descriptor.match = (s) => s.startsWith(matchString) ? [true, matchString.length] : [false, 0];
                    }
                    if (node.descriptor.type == "class") {
                        for (let range of node.descriptor.ranges) {
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
                        node.descriptor.pattern = node.descriptor.ranges.map((i) => {
                            let ret = (i[0].type == 'escape' ? '\\' : '') + i[0].value;
                            if (i[0].value != i[1].value) {
                                ret += '-';
                                ret += (i[1].type == 'escape' ? '\\' : '') + i[1].value
                            }
                            return ret;
                        }).join(' ');
                        node.descriptor.match = (s) => {
                            for (let range of (<ClassNode>node.descriptor).ranges) {
                                if (s[0] >= range[0].match && s[0] <= range[1].match) {
                                    return [true, 1];
                                }
                            }
                            return [false, 0];
                        }
                    }
                    if (node.descriptor.type == "any") {
                        node.descriptor.match = (s) => {
                            return s.length ? [true, 1] : [false, 0];
                        }
                        node.descriptor.pattern = '<character>';
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

function visitOptionChildren(node:PatternNode, data, enter:Function, exit:Function) {
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
    items: RuleNode[] | PatternNode[] | TokenNode[],
    index: number,
    pos: number,
    consumed: number,
}

type OutputFrame = {
    node : DefineNode,
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

    enterFrame(node:DefineNode) {
        this.top = {
            node: node,
            captureNode: null,
            capture: [],
            tokens: [],
            tokensStack: [],
        };
        this.stack.push(this.top);
    }

    exitFrame(node:DefineNode, success:boolean) {
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
        // first item is $0...
        let outputs:(OutputToken|OutputToken[])[] = [{ pos: startPos, length: consumed }];
        for (let i = 1; i < this.top.rule.captures.length; i++) {
            outputs.push(this.top.rule.captures[i] ? [] : null);
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
        let maxPos = 0;
        let failedPatterns = {};

        while (this.stack.length) {
            let current = this.top();

            if (current.index > current.items.length) {
                parserError(ErrorCode.ArrayOverrun);
            }

            if (current.status == MatchStatus.Continue) {
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
                    case "class":
                    case "any":
                        let text = this.text.substr(this.top().pos);
                        let [matched, consumed] = current.node.match(text);
                        if (matched) {
                            this.output.addToken(current.pos, consumed);
                            current.consumed = consumed;
                            current.status = MatchStatus.Pass;
                        } else {
                            current.status = MatchStatus.Fail;
                        }
                        break;
                }
            } else {
                let exited = this.stack.pop();
                let next = this.top();
                if (!next) {
                    // our parsing is complete!
                    break;
                }
                if (exited.node["pattern"] || exited.node.type == "ruleref") {
                    this.debug(exited.status == MatchStatus.Pass ? 'PASS' : 'FAIL', this.text.substr(exited.pos, 20), exited.node["pattern"] || exited.node["name"]);
                }
                if (next.node.type == "token" && next.node.not) {
                    exited.status = exited.status == MatchStatus.Pass ? MatchStatus.Fail : MatchStatus.Pass;
                }
                if (exited.status == MatchStatus.Pass) {
                    if (exited.pos + exited.consumed > maxPos) {
                        maxPos = exited.pos + exited.consumed;
                        failedPatterns = {};
                    }
                    if (["capture","group"].includes(exited.node.type)) {
                        this.output.exitGroup(true);
                    }
                    // consume, but only if there's not a predicate
                    if (exited.node.type != "token" || !(exited.node.and || exited.node.not)) {
                        next.consumed += exited.consumed;
                    }
                    if (next.node.type == "pattern") {
                        if (++next.index >= next.items.length) {
                            next.status = MatchStatus.Pass;
                        } // otherwise stay at Continue
                    } else {
                        next.status = MatchStatus.Pass;
                    }
                    switch (next.node.type) {
                        case "define":
                            this.output.exitFrame(next.node, true);
                            break;
                        case "rule":
                            this.output.yield(next.node, exited.pos, exited.consumed);
                            break;
                        case "token":
                            // when repeating, make sure we consumed to avoid infinite loops
                            if (next.node.repeat && exited.consumed > 0) {
                                this.enter(next.node.descriptor);
                            }
                            break;
                        case "capture":
                            this.output.endCapture(next.node, true);        
                            break;
                    }
                } else { // exited.matchStatus == MatchStatus.FAIL
                    if (exited.pos == maxPos && exited.node["pattern"]) {
                        failedPatterns[exited.node["pattern"]] = true;
                    }
                    if (["capture","group"].includes(exited.node.type)) {
                        this.output.exitGroup(false);
                    }
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
                        case "define":
                            if (next.node.name == 'return') {
                                parsingError(ErrorCode.TextParsingError, this.text, maxPos, buildReason());
                            }
                            if (next.status == MatchStatus.Fail) {
                                this.output.exitFrame(next.node, false);
                            }
                            break;
                        case "capture":
                            if (next.status == MatchStatus.Fail) {
                                this.output.endCapture(next.node, false);
                            }
                            break;
                    }
                }
            }
        } 

        if (!this.output.result) {
            parserError(ErrorCode.EmptyOutput);
        }
        if (this.output.result.pos != 0) {
            parserError(ErrorCode.InputConsumedBeforeResult);
        }
        if (this.output.result.length != this.text.length) {
            parsingError(ErrorCode.TextParsingError, this.text, maxPos, buildReason());
        }

        function buildReason() {
            let keys = Object.keys(failedPatterns);
            keys = keys.map((i) => i.replace(/\n/g, '\\n'));
            let list = [].join.call(keys, '\n\t');
            return keys.length == 1 ? `expected: ${list}` : `expected one of the following: \n\t${list}`;        
        }
    }

    enter(node:ParseNode) {
        let current = this.top();
        let items;

        switch (node.type) {
            case "define": 
                items = node.rules;
                this.output.enterFrame(node);
                break;
            case "rule": 
                this.output.reset(node);
                items = node.options; 
                break;
            case "capture": 
                this.output.enterGroup();
                this.output.startCapture(node);
                items = node.options; 
                break;
            case "group": 
                this.output.enterGroup();
                items = node.options; 
                break;
            case "pattern": 
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
            this.debugLog.push(args);
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

function grammarError(code:ErrorCode, ...args:string[]) {
    let msg = errorMessages[code].replace(/\$([0-9])/g, (match, index) => args[index-1]);
    let e = new Error(`Grammar error ${code}: ${msg}`);
    e["code"] = code;
    throw e;
}    

function parserError(code:ErrorCode) {
    let msg = errorMessages[code];
    let e = new Error(`Internal parser error ${code}: ${msg}`);
    e["code"] = code;
    throw e;
}

function parsingError(code:ErrorCode, text:string, pos:number, reason:string) {
    let lines = text.split('\n');
    let consumed = 0, linenum = 0, charnum = 0, lineText = '';
    for (let line of lines) {
        linenum++;
        if (consumed + line.length >= pos) {
            lineText = line;
            charnum = pos - consumed + 1;
            break;
        }
        consumed += line.length + 1;
    }
    let detabbed = lineText.replace(/\t/g, '    ');
    let leading = charnum - 1 + (detabbed.length - lineText.length);    
    let backrefs = [null, linenum, charnum, reason, lineText, ' '.repeat(leading)];
    let msg = errorMessages[code].replace(/\$([0-9])/g, (match, index) => String(backrefs[index]));
    let e = new Error(msg);
    e["code"] = code;
    e["pos"] = pos;
    e["line"] = linenum;
    e["lineText"] = lineText;
    e["reason"] = reason;
    throw e;
}
