"use strict";
exports.__esModule = true;
var parser = require("./Parser");
var Dezent = /** @class */ (function () {
    function Dezent(grammarStr, options) {
        this.options = options || {};
        this.debugErrors = !!this.options.debugErrors;
        this.error = null;
        this.grammar = parser.parseGrammar(grammarStr, this.options);
    }
    Dezent.prototype.parse = function (text) {
        try {
            return parser.parseText(this.grammar, text, this.options);
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
