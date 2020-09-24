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
        this.minimumPos = 0;
        this.maxid = maxid;
        this.cacheRetrieveEnabled = cacheLookupEnabled;
    }
    ParseCache.prototype.store = function (frame, pos) {
        pos = pos || frame.pos;
        Parser_1.assert(pos >= this.minimumPos);
        var key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos])
            this.frameCache[pos] = [];
        Parser_1.assert(!this.frameCache[pos][key] || !this.cacheRetrieveEnabled);
        this.frameCache[pos][key] = frame.status == Parser_1.MatchStatus.Fail ? false : frame;
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
    ParseCache.prototype.discard = function (newMinimumPos) {
        for (var i = this.minimumPos; i < newMinimumPos; i++) {
            delete this.frameCache[i];
        }
        this.minimumPos = newMinimumPos;
    };
    return ParseCache;
}());
exports.ParseCache = ParseCache;
