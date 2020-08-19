# Dezent

Powerful pattern matching and parsing that's readable, recursive, and structured.

# Introduction

Dezent is a parser that makes complex pattern matching easier to build, maintain, and use. Think of it as pattern matching similar to regular expressions plus reusable rules that can be nested recursively, plus whitespace-friendly syntax containing comments, plus malleable JSON output yielding data structures perfectly suited to your specific use-case.

Dezent is ideal for:
* Complex nested pattern matching
* Converting text data into hierarchical data structures
* Extracting numerous text segments into structured output
* Recursive descent parsing (e.g. programming languages)

# Quick Start

Dezent is inspired by [Parsing Expression Grammars](https://en.wikipedia.org/wiki/Parsing_expression_grammar) - if you understand the basic concepts of PEGs, Dezent will be easy to follow.

To parse a document, you must create a grammar that describes how your document is parsed. A sample [JSON grammar](dist/json.dezent) is included in this distribution. To try it out, install Dezent and execute the JSON example using the command-line `dezent` script:

```bash
npm install dezent
PATH=$(npm bin):$PATH; dezent \
    node_modules/dezent/doc/json.dezent \
    node_modules/dezent/doc/json_example.json
```

Or, in Javascript:
```javascript
fs = require('fs');
Dezent = require('dezent').Dezent;

var grammar = fs.readFileSync('node_modules/dezent/doc/json.dezent');
var text = fs.readFileSync('node_modules/dezent/doc/json_example.json');
let output = new Dezent(grammar).parse(text);
console.log(JSON.stringify(output));
```

# Tutorial

# Reference
