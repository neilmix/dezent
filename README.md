# Dezent

Powerful pattern matching and parsing that's readable, recursive, and structured.

# Introduction

Dezent is a parser that makes complex pattern matching easier to build, maintain, and use. Think of it as pattern matching similar to regular expressions - plus reusable rules that can be nested recursively, plus whitespace-friendly syntax containing comments, plus malleable JSON output yielding data structures perfectly suited to your specific use-case.

Dezent is ideal for:
* Complex nested pattern matching
* Converting text data into hierarchical data structures
* Extracting numerous text segments into structured output
* Recursive descent parsing (e.g. programming languages)

<!---
# Quick Start Example: Parsing URLs

Dezent is inspired by [Parsing Expression Grammars](https://en.wikipedia.org/wiki/Parsing_expression_grammar) - if you understand the basic concepts of PEGs, Dezent will be easy to follow.

To parse a document, you must create a grammar that describes how your document is parsed. A sample [URL grammar](dist/URL.dezent) is included in this distribution. The grammar looks like this:
```
return ({scheme} ':')? '//' ({userinfo} '@')? {host} (':' {port})? {path} {query}? {fragment}?
    -> {
        URL: $0,
        scheme: $1,
        userinfo: $2,
        host: $3,
        port: $4,
        ...$5,
        query: $6,
        fragment: $7
    };

TODO: rest of grammar
```

To try it out, install Dezent and execute the JSON example using the command-line `dezent` script:

```bash
npm install dezent
PATH=$(npm bin):$PATH; dezent \
    node_modules/dezent/doc/URL.dezent \
    - < 'myscheme://myhost.com/path/to/resource?name1=value%201&name2=value+2'
```

Or, in Javascript:
```javascript
fs = require('fs');
Dezent = require('dezent').Dezent;

var grammar = fs.readFileSync('node_modules/dezent/doc/URL.dezent');
let output = new Dezent(grammar).parse(
    'myscheme://myhost.com/path/to/resource?name1=value%201&name2=value+2'
);
console.log(JSON.stringify(output));
```

Either of the above will produce this output:
```JSON
{
    "URL": "myscheme://myhost.com/path/to/resource?name1=value%201&name2=value+2",
    "scheme": "myscheme",
    "host": "myhost.com",
    "port": null,
    "path": "path/to/resource",
    "pathComponents": ["path", "to", "resource"],
    "query": [
        { "name": "name1", "value": ["value", "%20", "1"] },
        { "name": "name2", "value": ["value 2"] }
    ],
    "fragment": null
}
```
-->

# Tutorial

# Reference - Pattern Matching

## return
```
'return' whitespace _ rule _ ';'
```
Dezent uses top-down parsing starting with the return rule. It is expected to consume the entire document, and a parse error is triggered if it does not. There may be only one return rule per grammar.

**Examples**
```javascript
> new Dezent(`return 'a' -> $0;`).parse('a');
`a`

> new Dezent(`return {'a'*} -> $1;`).parse('aaa');
'aaa'
```

## rule set
```
{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'
```
Rule sets provide abstraction, reusability, and recursion within Dezent grammars. A set is given a name and one or more rules that match input. Rule sets are referred to within patterns via the set's name. The rules are evaluated in order, and the first rule to match will yield the set's output, thereby termination matching for the rule set. If no rules match, the set will fail to match. Each rule set name must be unique within the grammar.

**Examples**
```javascript
> new Dezent(`
    three_chars = ... -> $0;
    return {three_chars} -> $1;
`).parse('abc');
'abc'

> new Dezent(`
    two_rules = 'a' -> 1, 'b' -> 2;
    return {two_rules}* -> $1;
`).parse('abab');
[1, 2, 1, 2]

> new Dezent(`
    number = [0-9]+ -> $0;
    add = '(' ({add|number}) '+' ({add|number}) ')' -> [$1, $2];
    return {add} -> $1;
`).parse('(1+(2+3))');
['1', ['2', '3']]
```

## = variable assignment

## -> rule
```
pattern _ ( '|' _ pattern _ )* _ '->' _ value
```
Rules are the core of Dezent's pattern matching power. Each rule consists of one or more patterns that may match and produce output. Patterns are evaluated in order from first to last, and the first pattern that matches will trigger the rule to return its output. If no patterns successfully match, the rule itself fails to match.

**Examples**
```javascript
> new Dezent(`return 'ab' | 'cd' -> $0;`).parse('cd');
'cd'

> new Dezent(`return 'a'|'b'|'c' -> $0;`).parse('d'); // does not match
undefined
```

## patterns
Patterns consist of a sequence of tokens that match (or fail to match) input text.

**Syntax**
```
(predicate (capture|group|string|class|ruleref|any) modifier _)+
```

## | option


## ! predicate

## & predicate

## {} capture

## () group

## '' string

## [] character class

## . any character

## * repeat 0 or more

## + repeate 1 or more

## ? maybe

# Reference - Output

## $0 back reference

## $1 - $9 back reference

## $identifier variable reference

## @identifier meta reference

## ^ pivot

## ... spread

## {} object

## [] array

## '' string

## number

## boolean

## null

## . property access

## [] property access

## \ escapes


