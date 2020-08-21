import {
    ErrorCode, parserError
} from "./Parser";

import {
    RuleDefNode, RuleNode, CaptureNode,
    ValueNode
} from "./Grammar";

type OutputFrame = {
    node : RuleDefNode,
    rule?: RuleNode,
    captureNode : CaptureNode|null,
    capture: OutputToken[],
    tokens : OutputToken[],
    tokensStack : OutputToken[][],
    output?: OutputToken,
}

export interface OutputToken {
    captureIndex?: number,
    pos: number,
    length: number,
    outputs?: (OutputToken|OutputToken[])[]
    value?: ValueNode,
}

export class OutputContext {
    stack:OutputFrame[] = [];
    top:OutputFrame = null;
    result:OutputToken;

    constructor() {
    }

    enterFrame(node:RuleDefNode) {
        this.top = {
            node: node,
            captureNode: null,
            capture: [],
            tokens: [],
            tokensStack: [],
        };
        this.stack.push(this.top);
    }

    exitFrame(node:RuleDefNode, success:boolean) {
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
