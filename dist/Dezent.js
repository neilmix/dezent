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
var Parser_1 = require("./Parser");
var ParseBuffer_1 = require("./ParseBuffer");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, functions, options) {
        this.grammar = Parser_1.parseGrammar(grammarStr, options);
        this.functions = functions;
        this.options = options;
        this.debugErrors = options ? !!options.debugErrors : false;
        this.error = null;
    }
    Dezent.prototype.parse = function (text) {
        try {
            var stream = new DezentStream(this.grammar, this.functions, this.options);
            stream.write(text);
            return stream.close();
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
    function DezentStream(grammar, functions, options) {
        grammar = typeof grammar == "string" ? Parser_1.parseGrammar(grammar, this.options) : grammar;
        this.options = options || {};
        this.functions = functions;
        this.buffer = new ParseBuffer_1.ParseBuffer();
        this.parser = new Parser_1.Parser(grammar, this.buffer, this.functions, this.options);
    }
    DezentStream.prototype.write = function (text) {
        this.buffer.addChunk(text);
        this.parser.parse();
    };
    DezentStream.prototype.close = function () {
        if (this.parser.error) {
            throw this.parser.error;
        }
        this.buffer.close();
        return this.parser.parse();
    };
    return DezentStream;
}());
exports.DezentStream = DezentStream;
