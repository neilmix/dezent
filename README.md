# Dezent

Powerful pattern matching and parsing that's readable, recursive, and structured.

# Table of contents
* [Introduction](#Introduction)
* [Motivation](#Motivation)
* [Status](#Status)
* [License](#License)
* [Quick Start](#Quick-Start)
* [Reference - the Dezent object](#Reference---the-dezent-object)
* [Reference - the DezentStream object](#Reference---the-dezentstream-object)
* [Reference - command-line util](#Reference---command-line-util)
* [Reference - grammar - pattern matching](#Reference---grammar---pattern-matching)
  * [return](#return)
  * [`=` ruleset](#-ruleset)
  * [`->` rule](#--rule)
  * [pattern](#pattern)
  * [\[\] character class](#-character-class)
  * [. any character](#-any-character)
  * [`''` string](#-string)
  * [`*` modifier - repeat 0 or more](#-modifier---repeat-0-or-more)
  * [`+` modifier - repeat 1 or more](#-modifier---repeat-1-or-more)
  * [`?` modifier - maybe](#-modifier---maybe)
  * [`()` group](#-group)
  * [`{}` capture](#-capture)
  * [`&` predicate - match](#-predicate---match)
  * [`!` predicate - does not match](#-predicate---does-not-match)
  * [`=` constant](#-constant)
* [Reference - grammar - output](#Reference---grammar---output)
  * [JSON-like](#JSON-like)
  * [`$0` back reference](#0-back-reference)
  * [`$1...$n` back references](#1n-back-references)
  * [`$identifier` constant reference](#identifier-constant-reference)
  * [`@identifier` meta reference](#identifier-meta-reference)
  * [`...` spread](#-spread)
  * [pivot callback](#-pivot-callback)
  * [`.` or `[]` property access](#-or--property-access)
  * [`?` collapse](-collapse)
  * [callbacks](#-callbacks)

# Introduction

Dezent is an alternative to regular expressions for difficult use-cases, providing complex pattern matching that's easier to build, maintain, and use. It is a pattern matching engine similar to regular expressions, plus reusable rules that can be nested recursively, with whitespace-friendly syntax containing comments, plus malleable JSON output yielding data structures perfectly suited to your specific use-case. As an added bonus, Dezent is capable of partial parsing, making it great for situations where you are reading data in asynchronous chunks.

Dezent is ideal for:
* Complex nested pattern matching
* Converting text data into hierarchical data structures
* Extracting text segments into structured output
* Recursive descent parsing
* Parsing asynchronously delivered input

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Motivation

I built Dezent as a side-project to a side-project I was working on. I desired a custom configuration syntax that happened to be a small subset of Typescript - something that could be parsed into a simple JSON data structure (aka abstract syntax tree) while still being valid, compilable Typescript. This is a task that's too complex for regular expressions, but it wasn't really worth hand-crafting a recursive descent parser. All the parsing frameworks I'd seen were a bit complex, and I thought "why can't there be a regular-expression-like syntax that parses recursively and yields simple JSON data structures?" And thus Dezent was born.

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Status

Dezent is fully functional - please try it out! I'd love your feedback. I am awaiting feedback to consider where to take it next.

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# License

Dezent is made available under the MIT License, see License.txt for details. Please contact neilmix@gmail.com for support.

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Quick Start

Dezent is inspired by [Parsing Expression Grammars](https://en.wikipedia.org/wiki/Parsing_expression_grammar) - if you understand the basic concepts of PEGs, Dezent will be easier to follow.

The Dezent javascript library and the dezent command-line tool are included in this distribution, see below for documentation. To parse a document, you must create a grammar that describes how your document is parsed. Reference documentation for grammars is included below.

The following examples are included in this distribution:
* [URLparser.js](examples/URLparser.js): A utility to interactively read and parse URLs. This example demonstrates general-purpose complex pattern matching.
* [randomJSONGenerator.js](examples/randomJSONGenerator.js) and [randomJSONParser.js](examples/randomJSONParser.js): a hypothentical advanced example of streamed log file parsing. This example demonstrates how Dezent can be used to parse asynchronous streams of data. The ```randomJSONGenerator.js``` script generates log files consisting of timestamps followed by
a JSON object. The ```randomJSONParser.js``` parses and processes the JSON object on each line
 and displays how quickly the parser is able to consume data. To try out the example, run<br>
 ```    node examples/randomJSONGenerator.js | node examples/randomJSONParser.js```<br>
 from your command line.
* [calculator.js](examples/calculator.js): A utility that interactively parses and calculates simple math expressions follow proper order of operations including left-associativity. This example demonstrates a powerful parsing concept called left recursion that's useful for parsing arithmentic expressions.

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Reference - the Dezent object

The Dezent constructor parses and compiles your grammar:
```javascript
> Dezent = require('dezent').Dezent;
[Function: Dezent]
> let d = new Dezent(`return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[!.?]} -> [$1, $2, $3];`);
```

If your grammar has an error, you'll get an exception:
```javascript
> d = new Dezent(`return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[!.?]} -> [$1, $2, $3]`);
Error: Error parsing grammar: expected: ;
At line 1 char 60:
return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[!.?]} -> [$1, $2, $3]
                                                           ^
```

The parse method parses an input string:
```javascript
> d.parse('Hello world!');
[ 'Hello', 'world', '!' ]
```

If the text doesn't parse correctly, the parse method returns undefined. To see what went wrong, examine the error member of the Dezent object:
```javascript
> d.parse('Hello to the whole world!');
undefined
> console.log(d.error.message);
Parse failed: expected one of the following: 
        a-z A-Z
        ! . ?
At line 1 char 9:
Hello to the whole world!
        ^
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Reference - the DezentStream object

The DezentStream class provides partial or chunked parsing, which is useful for large files.
It works much like the Dezent class, but uses the ```write``` and ```close``` methods in place of the ```parse``` method.
```javascript
> DezentStream = require('dezent').DezentStream;
[Function: DezentStream]
> let ds = new DezentStream(`return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[!.?]} -> [$1, $2, $3];`);
undefined
ds.write('Hello w');
undefined
ds.write('orld!');
undefined
ds.close();
[ 'Hello', 'world', '!' ]
```

The ```minBufferSizeInMB``` configuration controls when input text is released from memory. Take
care to ensure that this value isn't too small, or you may trigger an exception by referencing
input text that's already been released (for example, referencing a $0 value that's bigger than
```minBufferSizeInMB```). The default is 1, for 1 megabyte.
```javascript
> let ds = new DezentStream(grammar, { minBufferSizeInMB: 15 }); // minimum buffer size is 15 MB
```

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Reference - performance profiling

If you're curious about the performance profile of your grammar, use the ```enableProfiling```
configuration flag to output a profiling summary of your parse to console.log. Consider
the following silly grammar that performs very poorly:

```javascript
> Dezent = require('dezent').Dezent;
[Function: Dezent]
> let d = new Dezent(`
    return { letter+ '-' | number | letter }+ -> $1[0];
    letter = [a-zA-Z] -> $0;
    number = [0-9] -> $0;`, { enableProfiling: true });
> d.parse('abcdefghijklmnopqrstuvwxyz0123456789');
      rule name  call count   call time  pass count   pass time  fail count   fail time   redundant  
      ---------  ----------   ---------  ----------   ---------  ----------   ---------   ---------  
         letter         415           1         377           1          38           0         378  
         number          37           0          10           0          27           0           0  

'a'
```

# Reference - command-line util

```bash
% npm install -g dezent
% dezent
usage: dezent [grammar path] [text path]
% echo "return {[a-zA-Z]+} ' '+ {[a-zA-Z]+} {[\!.?]} [ \\\n]* -> [\$1, \$2, \$3];" > helloworld.dezent
% echo 'Hello world!' > input.txt
% dezent helloworld.dezent input.txt
["Hello","world","!"]
% echo 'Hello world!' | dezent helloworld.dezent -
["Hello","world","!"]
```

<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Reference - grammar - pattern matching

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `->` rule
---
```
pattern _ ( '|' _ pattern _ )* _ '->' _ value
```
Rules are the core of Dezent's pattern matching power. Each rule consists of one or more patterns that may match and produce output. Patterns are evaluated in order from first to last, and the first pattern that matches will trigger the rule to return its output, thereby terminating matching for this rule. If no patterns successfully match, the rule itself fails to match.

```javascript
> new Dezent(`myRule = 'ab' | 'cd' -> $0; return myRule -> $0;`).parse('cd');
'cd'

> new Dezent(`myRule = 'a'|'b'|'c' -> $0; return myRule -> $0;`).parse('d'); // does not match
undefined
```
The yield of a rule is optional and defaults to $0. (The yield of a return is mandatory.)
```javascript
> new Dezent(`myRule = 'ab' | 'cd'; return myRule -> $0;`).parse('cd');
'cd'
```

<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
> new Dezent(`return 'a' (!'b' .)* 'b' -> $0;`).parse('axxxxxxb');
'axxxxxxb'
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `{}` capture
---
```
'{' _ capturePattern _ ( '|' _ capturePattern _ )* _ '}'
```
This is the mechanism by which matched rules in a pattern are made available to the enclosing rule's output. Each capture is referred to by back reference, numbering from 1 to n, left to right.

```javascript
> new Dezent(`char = . -> $0; return {char} {char} -> [$1, $2];`).parse('ab');
[ 'a', 'b' ]
```
Captures yield the output of the matched rule, and support selection from any number of rules.

```javascript
> new Dezent(`
    rule1 = 'a' -> { value: $0 };
    rule2 = 'b' -> { value: $0 };
    return {rule1 | rule2} -> $1;
`).parse('b');
{ value: 'b' }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `&` predicate - match
---
The 'and' predicate allows a pattern to match only if the predicate's token matches. Note that predicates do not consume input.

```javascript
> new Dezent(`return &'foo' 'foobar' -> $0;`).parse('foobar');
'foobar'
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

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
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `=` constant
---
```
'$' identifier _ '=' _ value _ ';'
```
Declares constants within your grammar. Constants cannot be used within rules, only output.

```javascript
> new Dezent(`
    $pi = 3.14;
    return .* -> $pi;
).parse('anything');
3.14
> new Dezent(`
    $myconst = { foo: 'bar' };
    return .* -> $myconst;
`).parse('anything');
{ foo: 'bar' }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

# Reference - grammar - output

---
## JSON-like
---

Dezent rules yield output in JSON format. Keep in mind that Dezent grammar syntax uses single-quoted strings. Also, quotes around object member names are optional (as in javascript). The command-line tool yields standard JSON - with double-quote strings and quoted member names - when generating its output.

```javascript
> new Dezent(`
    return .* -> {
        bool: true,
        number: 2.4e-5,
        string: 'a string',
        null: null,
        array: [1, 2, 'another string']
    };
`).parse('anything');
{ bool: true,
  number: 0.000024,
  string: 'a string',
  null: null,
  array: [ 1, 2, 'another string' ] }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `$0` back reference
---

The $0 back reference returns the entire string matched during rule processing, regardless of any captures.

```javascript
> new Dezent(`return ... -> $0;`).parse('xyz');
'xyz'
> new Dezent(`return .{...}. -> $0;`).parse('abcde');
'abcde'
> new Dezent(`return ... -> 'foo\\$0baz';`).parse('bar');
'foobarbaz'
```

<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `$1...$n` back references
---

Back references refer to sequences captured during a rule's parse. Each reference is numbered from 1 to n, left to right.

```javascript
> new Dezent(`return {.} {.} -> [$1, $2];`).parse('ab');
[ 'a', 'b' ]
> new Dezent(`return {.} {.} -> 'a\\$1c\\$2e';`).parse('bd');
'abcde'
```
A repeated capture will always return an array as output, regardless of how many times the token matches.

```javascript
> new Dezent(`return 'a' {'b'}* 'a' -> $1;`).parse('abbba');
[ 'b', 'b', 'b' ]
> new Dezent(`return 'a' {'b'}* 'a' -> $1;`).parse('aa');
[]
> new Dezent(`return ( {[a-z]*} [0-9]* )* -> $1;`).parse('ab12cd34');
[ 'ab', 'cd' ]
```

Note the subtle but powerful difference between repeats inside the capture vs. outside:
```javascript
> new Dezent(`return {'a'*} -> $1;`).parse('aaa');
'aaa'
> new Dezent(`return {'a'}* -> $1;`).parse('aaa');
[ 'a', 'a', 'a' ]
```

When token matching is optional (the '?' modifier), null may be returned

```javascript
> new Dezent(`return 'a' {'b'}? 'a' -> $1;`).parse('aa');
null
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

<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `$identifier` constant reference
---

You can define constants and refer to them in your output:

```javascript
> new Dezent(`
    $pi = 3.14;
    return .* -> $pi;
`).parse('anything');
3.14
> new Dezent(`
    $myconst = { foo: 'bar' };
    return .* -> $myconst;
`).parse('anything');
{ foo: 'bar' }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `@identifier` meta reference
---

There are two meta-references available in output: the ordinal position of the rule's match, and its length.

```javascript
> new Dezent(`
    rule = (!'x' .)* -> { match: $0, pos: @position, length: @length };
    return 'x'* {rule} 'x'* -> $1;
`).parse('xabcx');
{ match: 'abc', pos: 1, length: 3 }
```

Meta-references can be used within a constant definition and their values will be populated when the rule is processed.
```javascript
> new Dezent(`
    $meta = { match: $0, pos: @position, length: @length };
    rule = (!'x' .)* -> { type: 'rule', ...$meta };
    return 'x'* {rule} 'x'* -> $1;
`).parse('xabcx');
{ match: 'abc', pos: 1, length: 3 }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `...` spread
---

The spread operator allows you to incorporate one array or object within another array or object.
```javascript
> new Dezent(`
    $array = [1, 2, 3];
    return .* -> [ ...$array, 4, 5, 6];
`).parse('anything');
[ 1, 2, 3, 4, 5, 6 ]
> new Dezent(`
    $object = { foo: 1, bar: 2 };
    return .* -> [ ...$object ];
`).parse('anything');
[ [ 'foo', 1 ], [ 'bar', 2 ] ]
> new Dezent(`
    $array = [ [ 'foo', 1 ], [ 'bar', 2 ] ];
    return .* -> { ...$array };
`).parse('anything');
{ foo: 1, bar: 2 }
> new Dezent(`
    $object = { foo: 1, bar: 2 };
    return .* -> { ...$object, baz: 3 };
`).parse('anything');
{ foo: 1, bar: 2, baz: 3 }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## pivot callback
---

The pivot callback swaps an array's rows with its columns. This is particularly useful for spreading a pair of captures inside an object:
```javascript
> new Dezent(`
    return {[a-z]}* {[0-9]}* -> 
        { 
            '1': $1, 
            '2': $2, 
            pivot([$1, $2]), 
            spread: { ...pivot([$1, $2]) }
        };
`).parse('abc123');
{ '1': [ 'a', 'b', 'c' ],
  '2': [ '1', '2', '3' ],
  pivot: [ [ 'a', '1' ], [ 'b', '2' ], [ 'c', '3' ] ],
  spread: { a: '1', b: '2', c: '3' } }
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## `.` or `[]` property access
---

You can access object and array properties much like you would in javascript:
```javascript
> new Dezent(`
    $myconst = { foo: 1, bar: [2, 3, 4] };
    return .* -> [$myconst.foo, $myconst['bar'][2]];
`).parse('anything');
[ 1, 4 ]
```
<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## ? collapse
---

You can cause null or empty backrefs to be collapsed in an array context.

```javascript
> new Dezent(`
    return {.} {'b'}? {.} -> [ $1, $2?, $3 ];
`).parse('aa');
[ 'a', 'a' ]
> new Dezent(`
    letter = 
        { [a-d] | [f-i] } -> $1,
        'e' -> null;
    return {letter}* -> $1?;
`).parse('abcdefghi');
[ 'a', 'b', 'c', 'd', 'f', 'g', 'h', 'i' ]
```

<div align="right"><a href="#table-of-contents">table of contents</a></div>

---
## callbacks
---

Provide your own custom callback functions to produce special output, or even SAX-style parsing.

```javascript
> new Dezent(
    `return {.*} -> translate($1);`,
    { 
        callbacks: {
            translate: (txt) => txt.replace("foo", "bar") 
        }
    }
).parse('all foo all the time');
'all bar all the time'
```

Alternatively, callbacks can be late-bound and supplied at the time of parsing:
```javascript
> new Dezent(`return {.*} -> translate($1);`).parse(
    'all foo all the time', 
    { translate: (txt) => txt.replace("foo", "bar") }
);
'all bar all the time'
```


<div align="right"><a href="#table-of-contents">table of contents</a></div>
