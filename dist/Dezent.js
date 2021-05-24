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
exports.DezentStream = exports.Dezent = void 0;
var parser = require("./Parser");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, functions, options) {
        this.stream = new DezentStream(grammarStr, functions, options);
        this.debugErrors = options ? !!options.debugErrors : false;
        this.error = null;
    }
    Dezent.prototype.parse = function (text) {
        try {
            this.stream.write(text);
            return this.stream.close();
        }
        catch (e) {
            this.error = e;
            if (this.debugErrors) {
                throw e;
            }
            return undefined;
        }
    };
    return Dezent;
}());
exports.Dezent = Dezent;
var DezentStream = /** @class */ (function () {
    function DezentStream(grammarStr, functions, options) {
        this.options = options || {};
        this.grammar = parser.parseGrammar(grammarStr, this.options, functions);
        this.functions = functions;
    }
    DezentStream.prototype.write = function (text) {
        this.result = parser.parseText(this.grammar, text, this.functions, this.options);
    };
    DezentStream.prototype.close = function () {
        return this.result;
    };
    return DezentStream;
}());
exports.DezentStream = DezentStream;
