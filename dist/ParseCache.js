"use strict";
exports.__esModule = true;
exports.ParseCache = void 0;
var Parser_1 = require("./Parser");
var ParseCache = /** @class */ (function () {
    function ParseCache(maxid, cacheLookupEnabled) {
        this.passFail = [];
        this.passFailRetrieveEnabled = true;
        this.maxid = maxid;
        this.passFailRetrieveEnabled = cacheLookupEnabled;
    }
    ParseCache.prototype.store = function (frame, pos) {
        var key = this.key(pos || frame.pos, frame.node.id, frame.leftOffset);
        Parser_1.assert(!this.passFail[key] || !this.passFailRetrieveEnabled);
        this.passFail[key] = frame;
        frame.cached = true;
    };
    ParseCache.prototype.retrieve = function (pos, node, leftOffset) {
        if (this.passFailRetrieveEnabled) {
            return this.get(pos, node.id, leftOffset);
        }
        else {
            return undefined;
        }
    };
    ParseCache.prototype.get = function (pos, id, leftOffset) {
        return this.passFail[this.key(pos, id, leftOffset)];
    };
    ParseCache.prototype.key = function (pos, id, leftOffset) {
        return (pos + leftOffset) * this.maxid + id;
    };
    ParseCache.prototype.visitPassFrames = function (root, rulesets, enter, exit) {
        var _this = this;
        var visit = function (frame) {
            Parser_1.assert(!!frame);
            Parser_1.assert(frame.status == Parser_1.MatchStatus.Pass);
            enter(frame);
            var consumed = 0;
            var childFrame;
            switch (frame.node.type) {
                case "ruleset":
                    if (frame.nextFrame) {
                        visit(frame.nextFrame);
                        break;
                    }
                case "rule":
                case "capture":
                case "group":
                    visit(_this.get(frame.pos, frame.items[frame.index].id, frame.leftOffset));
                    break;
                case "pattern":
                    for (var _i = 0, _a = frame.items; _i < _a.length; _i++) {
                        var token = _a[_i];
                        if (!token.and && !token.not) {
                            var childFrame_1 = _this.get(frame.pos + consumed, token.id, frame.leftOffset);
                            visit(childFrame_1);
                            consumed += childFrame_1.consumed;
                        }
                    }
                    break;
                case "token":
                    if (frame.consumed == 0) {
                        var childFrame_2 = _this.get(frame.pos, frame.node.descriptor.id, frame.leftOffset);
                        if (childFrame_2.status == Parser_1.MatchStatus.Pass) {
                            visit(childFrame_2);
                        }
                    }
                    else
                        while (consumed < frame.consumed) {
                            var childFrame_3 = _this.get(frame.pos + consumed, frame.node.descriptor.id, frame.leftOffset);
                            visit(childFrame_3);
                            consumed += childFrame_3.consumed;
                        }
                    break;
                case "ruleref":
                    var childNode = rulesets[frame.node.name];
                    childFrame = _this.get(frame.pos, childNode.id, frame.leftOffset);
                    visit(childFrame);
                    break;
            }
            exit(frame);
        };
        visit(this.get(0, root.id, 0));
    };
    return ParseCache;
}());
exports.ParseCache = ParseCache;
