// todo:
// - parse error line number and position (best match)
// - object <-> splats
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
    ContextNode, RuleNode, OptionNode, RepeaterNode, CaptureNode, PartNode, 
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
}

export function parseText(grammarText:string, parseText:string) : any {
    return parseTextWithGrammar(parseGrammar(grammarText), parseText);
}

export function parseGrammar(text:string) : Grammar {
    return parseTextWithGrammar(dezentGrammar, text);
}

export function parseTextWithGrammar(grammar:Grammar, text:string) : any {
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

type ParseContextFrame = {
    node: ContextNode,
    items: RuleNode[] | OptionNode[] | PartNode[],
    index: number,
    startPos: number,
    pos: number,
    matchCount: number,
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
        if (frame.node != node) {
            parserError(ErrorCode.MismatchOutputFrames);
        }
        this.top = this.stack[this.stack.length-1]
        if (!frame.output) {
            parserError(ErrorCode.EmptyOutput);
        }
        this.addTokenObject(frame.output);
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

    constructor(root:ReturnNode, text:string, defines:{[key:string]:DefineNode}) {
        this.text = text;
        this.defines = defines;
        this.enter(root);
    }

    parse() {
        while (this.stack.length) {
            // find the next part
            let part;
            PART: while (true) {
                let current = this.top();
                if (current.index >= current.items.length) {
                    parserError(ErrorCode.ArrayOverrun);
                } else {
                    switch (current.node.type) {
                        case "return":  case "define": case "rule": case "capture": case "group":
                            this.enter((<RuleNode[]|OptionNode[]>current.items)[current.index]);
                            break;
                        case "option":
                            part = (<PartNode[]>current.items)[current.index];
                            break PART;
                    }
                }
            }

            // execute the part
            switch(part.type) {
                case "capture": case "group":
                    this.enter(part);
                    break;
                case "ruleref":
                    if (this.defines[part.name]) {
                        this.enter(this.defines[part.name]);
                    } else {
                        grammarError(ErrorCode.RuleNotFound, part.name)
                    }
                    break;
                case "string":
                case "regex":
                    if (!part.match) {
                        if (part.type == "string") {
                            let matchString = buildString(part);
                            part.match = (s) => s.startsWith(matchString) ? matchString.length : -1;
                        } else {
                            let regex = new RegExp(`^${part.pattern}`)
                            part.match = (s) => {
                                let result = regex.exec(s);
                                return result ? result[0].length : -1;
                            }
                        }
                    }
                    let consumed = part.match(this.text.substr(this.top().pos));
                    if (consumed >= 0) {
                        let current = this.top();
                        this.output.addToken(current.pos, consumed);
                        current.pos += consumed;
                        if (current.index >= current.items.length - 1) {
                            // everything passed, or else we would have popped
                            this.exit(true);
                        }
                    } else {
                        this.exit(false);
                    }
                    break;
            }
        } 
        
        // check that consumed == text.length...

    }

    enter(node:ContextNode) {
        let current = this.top();
        let items;

        switch (node.type) {
            case "return": 
                items = [node.rule]; 
                this.output.enter(node);
                break;
            case "define": 
                items = node.rules; 
                this.output.enter(node);
                break;
            case "capture": 
                this.output.startCapture(node);
                // FALL THROUGH
            case "group": 
            case "rule": items = node.options; break;
            case "option": items = node.tokens; break;
        }
        this.stack.push({
            node: node,
            items: items,
            index: 0,
            startPos: current ? current.pos : 0,
            pos: current ? current.pos : 0,
            matchCount: 0,
        })
    }

    exit(success:boolean) {
        while (this.stack.length) {
            let exited = this.stack.pop();
            switch (exited.node.type) {
                case "return":
                case "define":
                    this.output.exit(exited.node, success);
                    break;
                case "rule":
                    if (success) {
                        this.output.yield(exited.node, exited.startPos, exited.pos - exited.startPos);
                    } else {
                        this.output.reset();
                    }
                    break;
                case "capture":
                    this.output.endCapture(exited.node);
                    // FALL THROUGH
                case "group":
                    let required = exited.node.repeat in [null,'+'];
                    if (!required) success = true;
                    if (exited.node.repeat == '*') success = true;
                    if (exited.node.repeat == '+' && exited.matchCount > 0) success = true;
                    break;
                case "option":
                    // do nothing - we'll mitigate the parent below
                    break;
            }

            let current = this.top();
            if (current && success) {
                if (current.node.type in ["group", "capture"] && (<RepeaterNode>current.node).repeat in ["*","+"]) {
                    current.index = 0;
                    current.matchCount++;
                    return;
                }
                current.index++;
                if (current.index < current.items.length) {
                    return;
                }
            }
        }
    }

    top() : ParseContextFrame|null { 
        return this.stack[this.stack.length-1] 
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
    throw new Error(`Grammar error: ${msg}`);
}    

function parserError(code:ErrorCode) {
    let msg = errorMessages[code];
    throw new Error(`Internal parser error: ${msg}`);
}