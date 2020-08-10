// todo:
// - parse error line number and position (best match)
// - object <-> splats
// - template -> pattern
// - test (/x*/)*
// - check that consumed == text.length...
// - command line script
// - node position for post-parse error messages (e.g. NonArraySplat)
// - performance/scale testing
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
    StringTextNode, StringEscapeNode, NumberNode, BooleanNode
 } from "./Grammar";

export enum ErrorCode {
    DuplicateDefine          = 1001,
    MultipleReturn           = 1002,
    RuleNotFound             = 1003,
    BackRefNotFound          = 1004,
    NonArraySplat            = 1005,
    SplatArraySizeMismatch   = 1006,
    MissingReturnNode        = 1007,

    ArrayOverrun             = 2001,
    MismatchOutputFrames     = 2002,
    CaptureAlreadyInProgress = 2003,
    MismatchEndCapture       = 2004,
    EmptyOutput              = 2005,
    Unreachable              = 2006,
}

const errorMessages = {
    1001: "Multiple rules defined with the same name: $1",
    1002: "Grammars are only allowed to have one return statement",
    1003: "Grammar does not contain a rule named '$1'",
    1004: "Back reference does not exist: $$1",
    1005: "Back reference used in splat is not an array: $$1",
    1006: "All arrays in a splat must be of the same length",
    1007: "Grammar does not contain a return rule",
    2001: "Array overrun",
    2002: "Mismatched output frames",
    2003: "Capture already in progress",
    2004: "Mismatched ending capture",
    2005: "Output frame did not contain an output token",
    2006: "Should not be possible to reach this code",
}

export function parseText(grammar:string|Grammar, text:string) : any {
    if (typeof grammar == "string") {
        grammar = parseGrammar(grammar);
    }
    return parseTextWithGrammar(grammar, text);
}

export function parseGrammar(text:string) : Grammar {
    return parseTextWithGrammar(dezentGrammar, text);
}

function parseTextWithGrammar(grammar:Grammar, text:string) : any {
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
        grammarError(ErrorCode.MissingReturnNode);
    }

    // now parse
    let parser = new Parser(ret, text, defines);
    parser.parse();

    // build our output value
    let builders:any = {
        backref: (node:BackRefNode, backrefs:OutputToken[]) => {
            if (!backrefs[node.index]) {
                grammarError(ErrorCode.BackRefNotFound, node.index);
            } else {
               return buildOutput(backrefs[node.index]);
            }
        },
        splat: (node:SplatNode, backrefs:OutputToken[]) => {
            let resolved = [];
            for (let ref of node.backrefs) {
                let res = this.backref(node, backrefs);
                if (!Array.isArray(res)) {
                    grammarError(ErrorCode.NonArraySplat, ref.index);
                }
                resolved.push(res);
            }
            for (let i = 1; i < resolved.length; i++) {
                if (resolved[i-1].length != resolved[i].length) {
                    grammarError(ErrorCode.SplatArraySizeMismatch);
                }
            }
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
                ret[this[member.name.type](member.name, backrefs)] = this[member.value.type](member.value, backrefs);
            }
            return ret;
        },
        array: (node:ArrayNode, backrefs:OutputToken[]) => {
            let ret = [];
            for (let elem of node.elements) {
                if (elem.type == "splat") {
                    ret = ret.concat(this.splat(elem, backrefs));
                } else {
                    ret.push(this[elem.type], backrefs);
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

    console.log(JSON.stringify(parser.output.result));
    return buildOutput(parser.output.result);

    function buildOutput(token:OutputToken) {
        if (token.backrefs && token.value) {
            let backrefs = token.backrefs.map((v) => buildOutput(v));
            return builders[token.value.type](token.value, backrefs);
        } else {
            return text.substr(token.pos, token.length);
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

type OutputContextFrame = {
    node : ReturnNode|DefineNode,
    captureMap : number[],
    captureNode : CaptureNode|null,
    captures : OutputToken[][],
    output?: OutputToken
}

interface OutputToken {
    pos: number,
    length: number
    backrefs?: OutputToken[],
    value?: ValueNode,
}

class OutputContext {
    stack:OutputContextFrame[] = [];
    top:OutputContextFrame = null;
    captureIdSequence = 0;
    result:OutputToken;

    constructor() {
    }

    enter(node:ReturnNode|DefineNode) {
        this.top = {
            node: node,
            captureMap: [],
            captureNode: null,
            captures: [],
        };
        this.stack.push(this.top);
    }

    exit(node:ReturnNode|DefineNode, success:boolean) {
        let frame = this.stack.pop();
        this.top = this.stack[this.stack.length - 1];
        if (frame.node != node) {
            parserError(ErrorCode.MismatchOutputFrames);
        }
        if (success) {
            if (!frame.output) {
                parserError(ErrorCode.EmptyOutput);
            }
            this.addTokenObject(frame.output);
        }
    }

    startCapture(node:CaptureNode) {
        if (this.top.captureNode) {
            parserError(ErrorCode.CaptureAlreadyInProgress);
        }
        this.top.captureNode = node;
        if (!node.id) {
            node.id = ++this.captureIdSequence;
        }
        if (!this.top.captureMap[node.id]) {
            this.top.captureMap[node.id] = this.top.captures.length;
            this.top.captures.push([]);
        }
    }

    endCapture(node:CaptureNode) {
        if (this.top.captureNode != node) {
            parserError(ErrorCode.MismatchEndCapture);
        }
        this.top.captureNode = null;
    }

    addToken(pos, consumed) {
        this.addTokenObject({
            pos: pos,
            length: consumed
        })
    }

    addTokenObject(token:OutputToken) {
        if (!this.top) {
            // parsing is complete
            this.result = token;
        } else if (this.top && this.top.captureNode) {
            // store our result, but only if capturing
            this.top.captures[this.top.captureMap[this.top.captureNode.id]].push(token);
        }
    }

    yield(node:RuleNode, startPos:number, consumed:number) {
        let backrefs : OutputToken[] = [];
        for (let capture of this.top.captures) {
            if (capture.length > 1) {
                backrefs.push({
                    pos: capture[0].pos,
                    length: capture.reduce((t, c) => t + c.length, 0)
                })
            } else {
                backrefs.push(capture[0]);
            }
        }
        this.top.output = {
            pos: startPos,
            length: consumed,
            backrefs: backrefs,
            value: node.output
        }
    }

    reset() {
        this.top.captureMap = [];
        this.top.captures = [];
    }
}

class Parser {
    stack : ParseContextFrame[] = [];
    text : string;
    defines: {[key:string]:DefineNode};
    output : OutputContext = new OutputContext();
    debugEnabled = true;
    debugLog = [];
    
    constructor(root:ReturnNode, text:string, defines:{[key:string]:DefineNode}) {
        this.text = text;
        this.defines = defines;
        this.enter(root);
    }

    parse() {
        try {
            while (this.stack.length) {
                let current = this.top();

                if (current.index > current.items.length) {
                    parserError(ErrorCode.ArrayOverrun);
                }

                this.debug(
                    this.text.substr(current.pos, 10), 
                    [current.items.length, current.index].join(),
                    current.status, 
                    this.stack.length, 
                    current.pos+":"+current.consumed,
                    current.node.type, 
                    current.node["pattern"]||current.node["name"]
                );

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
                                if (!current.node.match) {
                                    if (current.node.type == "string") {
                                        let matchString = buildString(current.node);
                                        if (this.debugEnabled) {
                                            current.node["pattern"] = matchString;
                                        }
                                        current.node.match = (s) => s.startsWith(matchString) ? [true, matchString.length] : [false, 0];
                                    } else {
                                        let regex = new RegExp(`^${current.node.pattern}`)
                                        current.node.match = (s) => {
                                            let result = regex.exec(s);
                                            return result ? [true, result[0].length] : [false, 0];
                                        }
                                    }
                                }
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
                                    this.debug("EXIT define", next.node["name"], "true");
                                    this.output.exit(next.node, true);
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
                                    this.debug("CAPTURE end", next.node.id);
                                    this.output.endCapture(next.node);        
                                    break;
                            }
                        } else {
                            // our parsing is complete!
                        }
                        break;

                    case MatchStatus.Fail:
                        exited = this.stack.pop();
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
                                this.dumpDebug();
                                throw new Error("Document is not parsable.")
                            case "define":
                                if (next.status == MatchStatus.Fail) {
                                    this.debug("EXIT define", next.node.name, "false");
                                    this.output.exit(next.node, false);
                                }
                                break;
                            case "rule":
                                this.debug("RESET");
                                this.output.reset();
                                break;
                            case "capture":
                                if (next.status == MatchStatus.Fail) {
                                    this.debug("CAPTURE end", next.node.id);
                                    this.output.endCapture(next.node);        
                                }
                                break;
                        }
                        break;
                    default:
                        parserError(ErrorCode.Unreachable);
                }
            } 
        } catch (e) {
            if (e.message.match(/^Internal/)) {
                this.dumpDebug();
            }
            throw e;
        }
    }

    enter(node:ParseNode) {
        let current = this.top();
        let items;

        switch (node.type) {
            case "return": 
                items = [node.rule]; 
                this.debug("ENTER return");
                this.output.enter(node);
                break;
            case "define": 
                items = node.rules;
                this.debug("ENTER define", node.name);
                this.output.enter(node);
                break;
            case "capture": 
                this.output.startCapture(node);
                this.debug("CAPTURE start", node.id);
                // FALL THROUGH
            case "group": 
            case "rule": 
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
        if (this.debugEnabled) {
            this.debugLog.push(args.join(' '));
        }
    }

    dumpDebug() {
        if (this.debugEnabled) {
            console.error("Debug log:\n", this.debugLog.join("\n"));
            console.error("Parser stack:\n", this.stack);
            console.error("Output stack:\n", this.output.stack);
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

function grammarError(code:ErrorCode, arg1?:string) {
    let msg = errorMessages[code].replace("$1", arg1);
    throw new Error(`Grammar error ${code}: ${msg}`);
}    

function parserError(code:ErrorCode) {
    let msg = errorMessages[code];
    throw new Error(`Internal parser error ${code}: ${msg}`);
}