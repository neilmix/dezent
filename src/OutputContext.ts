/*
 *  Dezent - Powerful pattern matching and parsing that's readable, recursive, and structured.
 *  Copyright (C) 2020  Neil Mix  <neilmix@gmail.com>
 *  Commercial licensing and support are available, please contact neilmix@gmail.com.
 * 
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 *  You should have received a copy of the GNU Affero General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>. 
 */

import {
    ErrorCode, parserError
} from "./Parser";

import {
    RulesetNode, RuleNode, CaptureNode,
    ValueNode
} from "./Grammar";

type OutputFrame = {
    node : RulesetNode,
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

    enterFrame(node:RulesetNode) {
        this.top = {
            node: node,
            captureNode: null,
            capture: [],
            tokens: [],
            tokensStack: [],
        };
        this.stack.push(this.top);
    }

    exitFrame(node:RulesetNode) : OutputToken {
        let frame = this.stack.pop();
        this.top = this.stack[this.stack.length - 1];
        if (frame.node != node) {
            parserError(ErrorCode.MismatchOutputFrames);
        }
        if (!frame.output) {
            // whoops, yield was never called
            parserError(ErrorCode.EmptyOutput);
        }
        return frame.output;
    }

    enterGroup() {
        this.top.tokensStack.push(this.top.tokens);
        this.top.tokens = [];
    }

    exitGroup() {
        let index = this.top.tokensStack.length - 1;
        this.top.tokensStack[index] = this.top.tokensStack[index].concat(this.top.tokens);
        this.top.tokens = this.top.tokensStack.pop();
    }

    startCapture(node:CaptureNode) {
        if (this.top.captureNode) {
            parserError(ErrorCode.CaptureAlreadyInProgress);
        }
        this.top.captureNode = node;
        this.top.capture = [];
    }

    endCapture(node:CaptureNode) {
        if (this.top.captureNode != node) {
            parserError(ErrorCode.MismatchEndCapture);
        }

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

    setRule(rule:RuleNode) {
        this.top.rule = rule;
        this.top.tokens = [];
    }
}
