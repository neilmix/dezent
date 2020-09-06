"use strict";
exports.__esModule = true;
exports.OutputContext = void 0;
var Parser_1 = require("./Parser");
var OutputContext = /** @class */ (function () {
    function OutputContext() {
        this.stack = [];
        this.top = null;
    }
    OutputContext.prototype.enterFrame = function (node) {
        this.top = {
            node: node,
            captureNode: null,
            capture: [],
            tokens: [],
            tokensStack: []
        };
        this.stack.push(this.top);
    };
    OutputContext.prototype.exitFrame = function (node) {
        var frame = this.stack.pop();
        this.top = this.stack[this.stack.length - 1];
        if (frame.node != node) {
            Parser_1.parserError(Parser_1.ErrorCode.MismatchOutputFrames);
        }
        if (!frame.output) {
            // whoops, yield was never called
            Parser_1.parserError(Parser_1.ErrorCode.EmptyOutput);
        }
        return frame.output;
    };
    OutputContext.prototype.enterGroup = function () {
        this.top.tokensStack.push(this.top.tokens);
        this.top.tokens = [];
    };
    OutputContext.prototype.exitGroup = function () {
        var index = this.top.tokensStack.length - 1;
        this.top.tokensStack[index] = this.top.tokensStack[index].concat(this.top.tokens);
        this.top.tokens = this.top.tokensStack.pop();
    };
    OutputContext.prototype.startCapture = function (node) {
        if (this.top.captureNode) {
            Parser_1.parserError(Parser_1.ErrorCode.CaptureAlreadyInProgress);
        }
        this.top.captureNode = node;
        this.top.capture = [];
    };
    OutputContext.prototype.endCapture = function (node) {
        if (this.top.captureNode != node) {
            Parser_1.parserError(Parser_1.ErrorCode.MismatchEndCapture);
        }
        // move our capture into an output
        var token;
        if (this.top.capture.length > 1) {
            this.top.tokens.push({
                captureIndex: this.top.captureNode.index,
                pos: this.top.capture[0].pos,
                length: this.top.capture.reduce(function (t, c) { return t + c.length; }, 0)
            });
        }
        else if (this.top.capture.length == 1) {
            this.top.tokens.push(this.top.capture[0]);
        }
        else {
            // didn't match...
        }
        this.top.captureNode = null;
    };
    OutputContext.prototype.addToken = function (pos, consumed) {
        this.addTokenObject({
            pos: pos,
            length: consumed
        });
    };
    OutputContext.prototype.addTokenObject = function (token) {
        if (!this.top) {
            // parsing is complete
            this.result = token;
        }
        else if (this.top && this.top.captureNode) {
            // store our result, but only if capturing
            // Note that we may be changing the capture index if this is
            // an output being transferred to another frame on exit.
            token.captureIndex = this.top.captureNode.index;
            this.top.capture.push(token);
        }
    };
    OutputContext.prototype.yield = function (rule, startPos, consumed) {
        // first item is $0...
        var outputs = [{ pos: startPos, length: consumed }];
        for (var i = 1; i < this.top.rule.captures.length; i++) {
            outputs.push(this.top.rule.captures[i] ? [] : null);
        }
        for (var _i = 0, _a = this.top.tokens; _i < _a.length; _i++) {
            var token = _a[_i];
            if (this.top.rule.captures[token.captureIndex]) {
                outputs[token.captureIndex]["push"](token);
            }
            else {
                if (outputs[token.captureIndex]) {
                    Parser_1.parserError(Parser_1.ErrorCode.MultipleOutputsForCapture);
                }
                outputs[token.captureIndex] = token;
            }
        }
        // find optional values that never matched and mark as null
        for (var i = 1; i < outputs.length; i++) {
            if (!outputs[i]) {
                outputs[i] = {
                    pos: startPos,
                    length: consumed,
                    outputs: [],
                    value: { type: "null" }
                };
            }
        }
        this.top.output = {
            pos: startPos,
            length: consumed,
            outputs: outputs,
            value: rule.value
        };
    };
    OutputContext.prototype.setRule = function (rule) {
        this.top.rule = rule;
        this.top.tokens = [];
    };
    return OutputContext;
}());
exports.OutputContext = OutputContext;
