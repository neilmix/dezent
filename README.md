# Dezent

Powerful pattern matching and parsing that's readable, recursive, and structured.

# Introduction

Dezent is a parser that makes complex pattern matching easier to build, maintain, and use. Think of it as pattern matching similar to regular expressions - plus reusable rules that can be nested recursively, plus whitespace-friendly syntax containing comments, plus malleable JSON output yielding data structures perfectly suited to your specific use-case.

Dezent is ideal for:
* Complex nested pattern matching
* Converting text data into hierarchical data structures
* Extracting numerous text segments into structured output
* Recursive descent parsing

# Status

Dezent is currently in _alpha_. This is the first public release of Dezent, for the purpose of soliciting feedback. Dezent is fully functional and ready for use, and we encourage its use, but the grammar and APIs of Dezent may change as a result of public feedback, so please be aware that future releases might not be backward compatible with this release.

# License

# Quick Start

Dezent is inspired by [Parsing Expression Grammars](https://en.wikipedia.org/wiki/Parsing_expression_grammar) - if you understand the basic concepts of PEGs, Dezent will be easier to follow.

The Dezent javascript library and the dezent command-line tool are included in this distribution, see below for documentation. To parse a document, you must create a grammar that describes how your document is parsed. Reference documentation for grammars is include below.

The following examples are included in this distribution:
* [URLparser.js](examples/URLparser.js): A utility to interactively read and parse URLs. This example demonstrates general-purpose complex pattern matching.
<!-- * [JSONtoXML.js](examples/JSONtoXML.js): A utility that interactively reads JSON and translates it into XML. This example demonstrates recursive parsing and output string interpolation. -->
* [calculator.js](examples/calculator.js): A utility that interactively parses and calculates simple math expressions follow proper order of operations including left-associativity. This example demonstrates a powerful parsing concept called left recursion.

# Reference - Dezent javascript library

# Reference - dezent command-line util

# Reference - Pattern Matching

---
## `return`
---
```
'return' whitespace _ rule _ ';'
```
Dezent uses top-down parsing starting with the return rule. It is expected to consume the entire document, and a parse error is triggered if it does not. There may be only one return rule per grammar.

```javascript
> new Dezent(`return 'a' -> $0;`).parse('a');
`a`

> new Dezent(`return {'a'*} -> $1;`).parse('aaa');
'aaa'
```
---
## `=` ruleset
---
```
{identifier} _ '=' _ {rule} ( _ ',' _ {rule} )* _ ';'
```
Rulesets provide abstraction, reusability, and recursion within Dezent grammars. A ruleset is given a name and one or more rules that match input. Rulesets are referred to within patterns via the ruleset's name. Its rules are evaluated in order, and the first rule to match will yield the ruleset's output, thereby termination matching for the ruleset. If no rules match, the ruleset will fail to match. Each ruleset name must be unique within the grammar.

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
```

Rules can be used recursively:
```javascript
> new Dezent(`
    a_rule = {'a'} {a_rule}? -> [$1, $2];
    return {a_rule} -> $1;
`).parse('aaa');
[ 'a', [ 'a', [ 'a', null ] ] ]
```

Dezent also support left recursion:
```javascript
> new Dezent(`
    number = [0-9]+ -> $0;
    add = {add} '+' {number} -> [$1, $2],
          {number} -> $1;
    return {add} -> $1;
`).parse('1+2+3');
[ [ '1', '2' ], '3' ]
```

---
## `->` rule
---
```
pattern _ ( '|' _ pattern _ )* _ '->' _ value
```
Rules are the core of Dezent's pattern matching power. Each rule consists of one or more patterns that may match and produce output. Patterns are evaluated in order from first to last, and the first pattern that matches will trigger the rule to return its output, thereby terminating matching for this rule. If no patterns successfully match, the rule itself fails to match.

```javascript
> new Dezent(`return 'ab' | 'cd' -> $0;`).parse('cd');
'cd'

> new Dezent(`return 'a'|'b'|'c' -> $0;`).parse('d'); // does not match
undefined
```

---
## pattern
---
```
(predicate (capture|group|string|class|ruleref|any) modifier _)+
```
Patterns consist of a sequence of tokens that match (or fail to match) input text.
```javascript
> new Dezent(`return 'a' 'b' 'c' -> $0;`).parse('abc');
'abc'
> new Dezent(`return 'a' 'b' 'c' -> $0;`).parse('xyz'); // does not match
undefined
```

Terminal tokens (string, class, or any) match a sequence of characters:
```javascript
> new Dezent(`return 'a string' -> $0;`).parse('a string');
'a string'
> new Dezent(`return [a-zA-Z !]* -> $0;`).parse('Hello World!');
'Hello World!'
> new Dezent(`return .* -> $0;`).parse('I can match anything.');
'I can match anything.'
```

Grouping tokens (group or capture) match one of a series of patterns:
```javascript
> new Dezent(`return ('a' . | 'b' .)+ -> $0;`).parse('acbx');
'acbx'
> new Dezent(`return {'a' . | 'b' .}+ -> $1;`).parse('acbx');
[ 'ac', 'bx' ]
```

A ruleref refers to a rule defined in the grammar:
```javascript
> new Dezent(`
    match_a = 'a' -> $0;
    return match_a+ -> $0;
`).parse('aaaa');
'aaaa'
```

All tokens within the pattern must match in order for the pattern to match.

```javascript
> let d = new Dezent(`return 'a' 'b' 'c' -> $0;`);
> d.parse('abx'); // does not match
undefined
> console.log(d.error.message);
Parse failed: expected: c
At line 1 char 3:
abx
  ^
```

---
## `[]` character class
---
```
'[' ( classChar '-' classChar | classChar )* ']'
```
Character class terminals match one of a set of characters or range of characters. They match one character at a time - use the `*` or `+` repeat modifiers to match a repeating sequence of the class.

```javascript
> new Dezent(`
    identifier = [a-zA-Z_][0-9a-zA-Z_]* -> $0;
    return identifier -> $0;
`).parse('myVarName_123');
'myVarName_123'
```

---
## `.` any character
---
The dot matches any character. 

```javascript
> new Dezent(`return .{...}. -> $1;`).parse('abcde');
'bcd'
```
Watch out - matching .* will consume all the remaining input. 

```javascript
> new Dezent(`return 'a' .* 'b' -> $0;`).parse('axxxxxxb'); // does not match
undefined
```
A repeating dot character is best used in conjunction with a not predicate.

```javascript
> new Dezent(`return 'a' (!'b' .)* 'b' -> $0;`).parse('axxxxxxb'); // does not match
'axxxxxxb'
```

---
## `''` string
---
```
['] (escape|stringText)* [']
```
Represents a specific sequence of characters to match. Escapes via backslash character are typical: The \u escape is followed by 4 hex digits and represents a unicode character. There are 5 whitespace escapes: 
\n (newline), \t (tab), \r (carriage return), \b (backsape), and \f (form feed). Any other character preceded by a 
backslash will be replaced with the character itself.

```javascript
> new Dezent(`return 'abc\\txyz\\.' -> $0;`).parse('abc\txyz.');
'abc\txyz.'
```

---
## `*` modifier - repeat 0 or more
---
Indicates that this token should repeat 0 or more times. Repeat modifiers are greedy, which means they consume as much
input as possible. 

```javascript
> new Dezent(`return 'a'* -> $0;`).parse('aaa');
'aaa'
> new Dezent(`return [ab]* 'b' -> $0;`).parse('aaabb'); // does not match
undefined
```
To avoid consuming too much input, use a predicate (predicates don't consume input).

```javascript
> new Dezent(`return '"' { (!'"' .)* } '"' -> $1;`).parse('"parsed string"');
'parsed string'
```
Any capture contained within a repeated token will return an array as output, regardless of how many times the token matches.

```javascript
> new Dezent(`return 'a' {'b'}* 'a' -> $1;`).parse('abbba');
[ 'b', 'b', 'b' ]
> new Dezent(`return 'a' {'b'}* 'a' -> $1;`).parse('aa');
[]
> new Dezent(`return ( {[a-z]*} [0-9]* )* -> $1;`).parse('ab12cd34');
[ 'ab', 'cd' ]
```

---
## `+` modifier - repeat 1 or more
---
Indicates that this token should repeat 1 or more times. Repeat modifiers are greedy, which means they consume as much
input as possible. 

```javascript
> new Dezent(`return 'a'+ -> $0;`).parse('aaa');
'aaa'
> new Dezent(`return [ab]+ 'b' -> $0;`).parse('aaabb'); // does not match
undefined
```
To avoid consuming too much input, use a token with predicate as guard (predicates don't consume input). Any capture contained within a repeated token will return an array as output, regardless of how many times the token matches.

```javascript
> new Dezent(`return 'a' {'b'}+ 'a' -> $1;`).parse('abbba');
[ 'b', 'b', 'b' ]
> new Dezent(`return 'a' {'b'}+ 'a' -> $1;`).parse('aba');
[ 'b' ]
> new Dezent(`return 'a' {'b'}+ 'a' -> $1;`).parse('aa'); // does not match
undefined
> new Dezent(`return ( {[a-z]+} [0-9]+ )+ -> $1;`).parse('ab12cd34');
[ 'ab', 'cd' ]
```

---
## `?` modifier - maybe
---
Indicates that the given token is not required to match. 

```javascript
> new Dezent(`return 'a' 'b'? 'a' -> $0;`).parse('aba');
'aba'
> new Dezent(`return 'a' 'b'? 'a' -> $0;`).parse('aa');
'aa'
```
A capture within a maybe token will return either the captured value or null, depending on whether the token matched.

```javascript
> new Dezent(`return 'a' {'b'}? 'a' -> $1;`).parse('aba');
'b'
> new Dezent(`return 'a' {'b'}? 'a' -> $1;`).parse('aa');
null
```

---
## `()` group
---
```
'(' _ pattern _ ( '|' _ pattern _ )*  _ ')'
```
Groups a set of patterns into a single token. The first pattern to match wins, thereby terminating matching for this token.

```javascript
> new Dezent(`return 'a' ('bc' | 'de') 'a' -> $0;`).parse('abca');
'abca'
```

---
## `{}` capture
---
```
'{' _ capturePattern _ ( '|' _ capturePattern _ )* _ '}'
```
This is the mechanism by which matched tokens are made available to a rule's output. Each capture is referred to by back reference, numbering from 1 to n, left to right.

```javascript
> new Dezent(`return {.} {.} -> [$1, $2];`).parse('ab');
[ 'a', 'b' ]
```
Captures also work as a grouping mechanism, although captures cannot be nested (i.e. captures can't contain captures).

```javascript
> new Dezent(`return {'a' | 'b'} -> $1;`).parse('b');
'b'
> new Dezent(`return { {'a'} | {'b'} } -> $1;`).parse('b'); // parse error
Error: Error parsing grammar: expected one of the following: 
        (
        '
        [
        _ a-z A-Z
        .
At line 1 char 10:
return { {'a'} | {'b'} } -> $1;
         ^
```
By default, captures yield string output. However, if a capture matches (and only matches) a rule reference, it yields the output of that rule.

```javascript
> new Dezent(`
    rule1 = 'a' -> { value: $0 };
    rule2 = 'b' -> { value: $0 };
    return {rule1 | rule2} -> $1;
`).parse('b');
{ value: 'b' }
```
If a capture matches multiple tokens, the matching string segment is always returned.

```javascript
> new Dezent(`
    rule1 = 'a' -> { value: $0 };
    rule2 = 'b' -> { value: $0 };
    return {rule1 rule2} -> $1;
`).parse('ab');
'ab'
```

---
## `&` predicate - matches
---
The 'and' predicate allows a pattern to match only if the predicate's token matches. Note that predicates do not consume input.

```javascript
> new Dezent(`return &'foo' 'foobar' -> $0;`).parse('foobar');
'foobar'
```

---
## `!` predicate - does not match
---
The 'not' predicate allows a pattern to match only if the predicate's token does not match. Note that predicates do not consume input.

```javascript
> new Dezent(`return !'x' ... -> $0;`).parse('axx');
'axx'
> new Dezent(`return !'x' ... -> $0;`).parse('xyz'); // does not match
undefined
```
The 'not' predicate is particularly useful in conjunction with the 'any' token.

```javascript
> new Dezent(`return '"' { (!'"' .)* } '"' -> $1;`).parse('"parsed string"');
'parsed string'
```

---
## `=` constant
---
```
'$' identifier _ '=' _ value _ ';'
```
Declares constants within your grammar. Constants cannot be used within rules, only output.

```javascript
> new Dezent(`
    $myconst = { foo: 'bar' };
    return .* -> $myconst;
`).parse('abc');
{ foo: 'bar' }
```

# Reference - Output

## JSON-like

## `$0` back reference

## `$1` back reference

## `$identifier` constant reference

## `@identifier` meta reference

## `...` spread

## `^` pivot

## `.` property access

## `[]` property access

