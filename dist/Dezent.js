"use strict";
exports.__esModule = true;
var parser = require("./Parser");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, options) {
        options = options || {};
        this.debugErrors = !!options.debugErrors;
        this.error = null;
        this.grammar = parser.parseGrammar(grammarStr);
    }
    Dezent.prototype.parse = function (text) {
        try {
            return parser.parseText(this.grammar, text);
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
exports["default"] = Dezent;
