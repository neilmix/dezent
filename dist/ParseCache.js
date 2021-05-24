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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseCache = exports.ParseCacheScope = void 0;
var Parser_1 = require("./Parser");
var ParseCacheScope;
(function (ParseCacheScope) {
    ParseCacheScope[ParseCacheScope["All"] = 1] = "All";
    ParseCacheScope[ParseCacheScope["Rulesets"] = 2] = "Rulesets";
})(ParseCacheScope = exports.ParseCacheScope || (exports.ParseCacheScope = {}));
var ParseCache = /** @class */ (function () {
    function ParseCache(scope, maxid) {
        this.frameCache = [];
        this.minimumPos = 0;
        this.scope = scope;
        this.maxid = maxid;
    }
    ParseCache.prototype.store = function (frame, pos) {
        if (frame.node.type == "ruleset" && frame.status != Parser_1.MatchStatus.Continue) {
            // rulesets are cached early so as to enable left recursion detection,
            // so we don't need to cache them at pass/fail
            return;
        }
        if (frame.node.type != "ruleset" && (this.scope == ParseCacheScope.Rulesets || frame.status == Parser_1.MatchStatus.Continue)) {
            return;
        }
        if (frame.cached && typeof pos == "undefined") {
            // no need to cache if already cached, except when pos is supplied,
            // which implies intentional re-caching at a new location (i.e. repeating token)
            return;
        }
        pos = pos || frame.pos;
        Parser_1.assert(pos >= this.minimumPos);
        var key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos])
            this.frameCache[pos] = [];
        Parser_1.assert(!this.frameCache[pos][key]);
        this.frameCache[pos][key] = frame.status == Parser_1.MatchStatus.Fail ? false : frame;
        frame.cached = true;
    };
    ParseCache.prototype.retrieve = function (pos, node, leftOffset) {
        return this.get(pos, node.id, leftOffset);
    };
    ParseCache.prototype.get = function (pos, id, leftOffset) {
        if (!this.frameCache[pos])
            return undefined;
        return this.frameCache[pos][this.key(id, leftOffset)];
    };
    ParseCache.prototype.key = function (id, leftOffset) {
        return leftOffset * this.maxid + id;
    };
    ParseCache.prototype.discardPos = function (newMinimumPos) {
        for (var i = this.minimumPos; i < newMinimumPos; i++) {
            delete this.frameCache[i];
        }
        this.minimumPos = newMinimumPos;
    };
    ParseCache.prototype.frameComplete = function (frame) {
        if (this.scope == ParseCacheScope.Rulesets && frame.node.type == "ruleset" && this.frameCache[frame.pos]) {
            delete this.frameCache[frame.pos][this.key(frame.node.id, frame.leftOffset)];
            if (this.frameCache[frame.pos].filter(function (x) { return x !== undefined; }).length == 0) {
                // discard empty positions to prevent unbounded memory growth
                delete this.frameCache[frame.pos];
            }
        }
    };
    return ParseCache;
}());
exports.ParseCache = ParseCache;
