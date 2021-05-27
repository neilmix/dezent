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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseBuffer = exports.ParseBufferExhaustedError = void 0;
var Parser_1 = require("./Parser");
exports.ParseBufferExhaustedError = new Error("ParseBufferExhaustedError");
var ParseBuffer = /** @class */ (function () {
    function ParseBuffer(text) {
        this.chunks = [];
        this.indices = [];
        this.chunkIndex = 0;
        this._length = 0;
        this._closed = false;
        if (text) {
            this.addChunk(text);
            this.close();
        }
    }
    Object.defineProperty(ParseBuffer.prototype, "length", {
        get: function () {
            return this._length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ParseBuffer.prototype, "closed", {
        get: function () {
            return this._closed;
        },
        enumerable: false,
        configurable: true
    });
    ParseBuffer.prototype.addChunk = function (text) {
        this.chunks.unshift(text);
        this.indices.unshift(this.indices.length ? this.indices[0] + text.length : 0);
        this._length += text.length;
    };
    ParseBuffer.prototype.substr = function (startIdx, length) {
        var _a = __read(this.chunkIndexFor(startIdx), 2), chunkIdx = _a[0], charIdx = _a[1];
        if (chunkIdx < 0) {
            return '';
        }
        var chunk = this.chunks[chunkIdx];
        var text = chunk.substr(charIdx, length);
        while (text.length < length) {
            chunkIdx--;
            if (chunkIdx < 0) {
                return text;
            }
            text += this.chunks[chunkIdx].substr(0, length - text.length);
        }
        return text;
    };
    ParseBuffer.prototype.substrExact = function (startIdx, length) {
        var s = this.substr(startIdx, length);
        if (s.length != length) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return s;
        }
    };
    ParseBuffer.prototype.containsAt = function (text, idx) {
        return text == this.substrExact(idx, text.length);
    };
    ParseBuffer.prototype.charAt = function (idx) {
        var _a = __read(this.chunkIndexFor(idx), 2), chunkIdx = _a[0], charIdx = _a[1];
        if (chunkIdx < 0) {
            throw exports.ParseBufferExhaustedError;
        }
        else {
            return this.chunks[chunkIdx].charAt(charIdx);
        }
    };
    ParseBuffer.prototype.chunkIndexFor = function (idx) {
        if (this.indices.length == 0 || idx >= this.indices[0] + this.chunks[0].length) {
            return [-1, -1];
        }
        for (var i = 0; i < this.indices.length; i++) {
            if (idx >= this.indices[i]) {
                return [i, idx - this.indices[i]];
            }
        }
        throw Parser_1.parserError(Parser_1.ErrorCode.Unreachable);
    };
    ParseBuffer.prototype.lineIterator = function () {
        var linenum, char, remainder, i, lines, j, line;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    linenum = 0, char = 0, remainder = '';
                    i = this.chunks.length - 1;
                    _a.label = 1;
                case 1:
                    if (!(i >= 0)) return [3 /*break*/, 7];
                    lines = this.chunks[i].split('\n');
                    j = 0;
                    _a.label = 2;
                case 2:
                    if (!(j < lines.length)) return [3 /*break*/, 6];
                    line = j == 0 ? remainder + lines[j] : lines[j];
                    if (!(j < lines.length - 1)) return [3 /*break*/, 4];
                    linenum++;
                    return [4 /*yield*/, { line: linenum, char: char, length: lines[j].length + 1, lineText: lines[j] }];
                case 3:
                    _a.sent();
                    char += lines[j].length + 1;
                    return [3 /*break*/, 5];
                case 4:
                    remainder = lines[j];
                    _a.label = 5;
                case 5:
                    j++;
                    return [3 /*break*/, 2];
                case 6:
                    i--;
                    return [3 /*break*/, 1];
                case 7: return [4 /*yield*/, { line: ++linenum, char: char, length: remainder.length, lineText: remainder }];
                case 8:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    };
    ParseBuffer.prototype.findLineAndChar = function (pos) {
        var e_1, _a;
        var lineData;
        try {
            for (var _b = __values(this.lineIterator()), _c = _b.next(); !_c.done; _c = _b.next()) {
                lineData = _c.value;
                if (lineData.char + lineData.length >= pos) {
                    var char = pos - lineData.char;
                    var leading = 0;
                    for (var i = 0; i < char; i++) {
                        if (lineData.lineText[i] == '\t') {
                            leading += 4;
                        }
                        else {
                            leading++;
                        }
                    }
                    var detabbed = lineData.lineText.replace(/\t/g, ' '.repeat(4));
                    return {
                        line: lineData.line,
                        char: pos - lineData.char + 1,
                        lineText: detabbed,
                        pointerText: ' '.repeat(leading) + '^'
                    };
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // this *should* not happen,but we're in the middle of error handling, so just give
        // an obtuse answer rather than blowing everything up.
        return {
            line: lineData.line,
            char: lineData.length,
            lineText: lineData.lineText,
            pointerText: ' '.repeat(lineData.length) + '^'
        };
    };
    ParseBuffer.prototype.close = function () {
        this._closed = true;
    };
    return ParseBuffer;
}());
exports.ParseBuffer = ParseBuffer;
