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

import { ParseFrame, assert } from "./Parser";
import { Node, ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export enum ParseCacheScope {
    All = 1,
    Rulesets = 2,
}

export class ParseCache {
    scope:ParseCacheScope;
    maxid:number;
    frameCache:(ParseFrame|false)[][] = [];
    minimumPos = 0;

    constructor(scope:ParseCacheScope, maxid: number) {
        this.scope = scope;
        this.maxid = maxid;
    }

    store(frame:ParseFrame, pos?:number) {
        if (frame.node.type == "ruleset" && frame.complete) {
            // rulesets are cached early so as to enable left recursion detection,
            // so we don't need to cache them at pass/fail
            return;
        }
        if (frame.node.type != "ruleset" && (this.scope == ParseCacheScope.Rulesets || !frame.complete)) {
            return;
        }
        if (frame.cached && typeof pos == "undefined") {
            // no need to cache if already cached, except when pos is supplied,
            // which implies intentional re-caching at a new location (i.e. repeating token)
            return;
        }
        pos = pos || frame.pos;
        assert(pos >= this.minimumPos);
        let key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos]) this.frameCache[pos] = [];
        assert(!this.frameCache[pos][key]);
        this.frameCache[pos][key] = frame.complete && !frame.match ? false : frame;
        frame.cached = true;
    }

    retrieve(pos:number, node:Node, leftOffset:number):ParseFrame|false|undefined {
        return this.get(pos, node.id, leftOffset);
    }
    
    get(pos:number, id:number, leftOffset:number) {
        if (!this.frameCache[pos]) return undefined;
        return this.frameCache[pos][this.key(id, leftOffset)];
    }

    key(id:number, leftOffset:number) {
        return leftOffset*this.maxid + id;
    }

    discardPos(newMinimumPos:number) {
        for (let i = this.minimumPos; i < newMinimumPos; i++) {
            delete this.frameCache[i];
        }
        this.minimumPos = newMinimumPos;
    }

    frameComplete(frame:ParseFrame) {
        if (this.scope == ParseCacheScope.Rulesets && frame.node.type == "ruleset" && this.frameCache[frame.pos]) {
            delete this.frameCache[frame.pos][this.key(frame.node.id, frame.leftOffset)];
            if (this.frameCache[frame.pos].filter(x => x !== undefined).length == 0) {
                // discard empty positions to prevent unbounded memory growth
                delete this.frameCache[frame.pos];
            }
        }
    }
}