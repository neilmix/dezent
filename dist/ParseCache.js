"use strict";
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
exports.__esModule = true;
exports.ParseCache = void 0;
var Parser_1 = require("./Parser");
var ParseCache = /** @class */ (function () {
    function ParseCache(maxid, cacheLookupEnabled) {
        this.frameCache = [];
        this.cacheRetrieveEnabled = true;
        this.maxid = maxid;
        this.cacheRetrieveEnabled = cacheLookupEnabled;
    }
    ParseCache.prototype.store = function (frame, pos) {
        pos = pos || frame.pos;
        var key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos])
            this.frameCache[pos] = [];
        Parser_1.assert(!this.frameCache[pos][key] || !this.cacheRetrieveEnabled);
        this.frameCache[pos][key] = frame;
        frame.cached = true;
    };
    ParseCache.prototype.retrieve = function (pos, node, leftOffset) {
        if (this.cacheRetrieveEnabled) {
            return this.get(pos, node.id, leftOffset);
        }
        else {
            return undefined;
        }
    };
    ParseCache.prototype.get = function (pos, id, leftOffset) {
        if (!this.frameCache[pos])
            return undefined;
        return this.frameCache[pos][this.key(id, leftOffset)];
    };
    ParseCache.prototype.key = function (id, leftOffset) {
        return leftOffset * this.maxid + id;
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
