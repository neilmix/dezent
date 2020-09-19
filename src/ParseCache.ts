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

import { ParseFrame, MatchStatus, assert } from "./Parser";
import { Node, ReturnNode, RulesetNode, TokenNode } from "./Grammar";

export class ParseCache {
    maxid:number;
    frameCache:(ParseFrame|false)[][] = [];
    cacheRetrieveEnabled:boolean = true;

    constructor(maxid: number, cacheLookupEnabled:boolean) {
        this.maxid = maxid;
        this.cacheRetrieveEnabled = cacheLookupEnabled;
    }

    store(frame:ParseFrame, pos?:number) {
        pos = pos || frame.pos;
        let key = this.key(frame.node.id, frame.leftOffset);
        if (!this.frameCache[pos]) this.frameCache[pos] = [];
        assert(!this.frameCache[pos][key] || !this.cacheRetrieveEnabled);
        this.frameCache[pos][key] = frame.status == MatchStatus.Fail ? false : frame;
        frame.cached = true;
    }

    retrieve(pos:number, node:Node, leftOffset:number):ParseFrame|false|undefined {
        if (this.cacheRetrieveEnabled) {
            return this.get(pos, node.id, leftOffset);
        } else {
            return undefined;
        }
    }
    
    get(pos:number, id:number, leftOffset:number) {
        if (!this.frameCache[pos]) return undefined;
        return this.frameCache[pos][this.key(id, leftOffset)];
    }

    key(id:number, leftOffset:number) {
        return leftOffset*this.maxid + id;
    }
}