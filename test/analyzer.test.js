import util from "util";
import assert from "assert/strict";
import analyze from "../src/analyzer.js";
import parse from "../src/parser.js";

const semanticChecks = [
  [
    "print statements",
    'make x with 1 ; print x; print 5; print "hello"; print true;',
  ],
  ["print statements with 0", "print 0;"],
  [
    "variables can be all types",
    'make a with 1; make b with true; make c with "string"; make d with [1,2,3];',
  ],
  [
    "variables can be negative and decimals",
    "make a with -1; make b with 1.1;",
  ],
  [
    "variables can be expressions",
    "make a with 2 plus 2; make b with 1 is less than 2;",
  ],
  ["variables can be reassigned", "make x with 1 ; change x to 2;"],
  [
    "variables can be auto calls",
    "automate x(any: y) -> num { output 0; } make z with x(1);",
  ],
  [
    "if/ifnot statement",
    'make x with 5 ; if x is 5 { print "X IS 5"; } ifnot { print "X IS NOT 5";}',
  ],
  ["if statements with variable as condition", "make x with true; if x{}"],
  ["while loop", "make x with 0; loop while x is less than 5 {add 1 to x;}"],
  [
    "while loop with break",
    "make x with 0; loop while x is less than 5 {add 1 to x; break;}",
  ],
  ["for loop with break", "make x with [1,2,3]; loop over e in x{print e;}"],
  [
    "for loops and lists",
    `make this_list with [1,"hello", [1,2,3], []];
    loop over element in this_list {
      print element;
    }`,
  ],
  [
    "loops in loops",
    `make x with 0;
    loop while x is less than 10 {
      print x; 
      if x is 5 {
        break; 
      } 
      add 1 to x;
    }`,
  ],
  [
    "automations and calls",
    `automate addNums( num: num1 , num: num2) -> num {
      output num1 plus num2;
    } 
    make x with 9;
    make y with 1;
    change x to addNums(x, 5);
    addNums(x, y);
    addNums(addNums(x,y), addNums(x,y));`,
  ],
  [
    "operators",
    `make x with 1;
    change x to x plus 1;
    change x to x minus 1;
    change x to x times 1;
    change x to x divided by 1;
    change x to x to the 1;
    change x to x mod 1;`,
  ],
  [
    "variable expressions",
    `make x with 1;
    add 1 to x;
    subtract 1 from x;
    multiply x by 1;
    divide x by 1;
    raise x to the 1;
    mod x by 1;`,
  ],
  ["complex equations", "make x with 1 plus (1 minus -8) times 2;"],
  ["paren placement issue", "make x with ( 1 plus 1 ) minus 1;"],
  ["booleans", "make x with true; change x to false;"],
  [
    "boolean expressions as variables",
    `make a with 1 is greater than 2;
    make b with 1 is less than 2 ;
    make c with 1 is 2 ;
    make d with 1 is not 2 ;
    make x with 1 is greater than or equal to 2 ;
    make f with 1 is less than or equal to 2 ;`,
  ],
  [
    "variables declared in scope",
    "automate x(any: y) -> num { output 0; } make y with 1;",
  ],
  [
    "call expressions",
    "automate add_one( num: y) -> num { add 1 to y; output y; } make x with add_one(1); add add_one(1) to x; multiply x by add_one(1);",
  ],
  ["nested outputs", "automate x(num: y) -> num { if true { output 4; } }"],
  [
    "auto-ception",
    `automate add_one(num: y) -> none {
      add 4 to y;
      automate add_two(num: z) -> num {
        output 2;
      }
    }`,
  ],
];

const semanticErrors = [
  ["assigning undeclared variable", "make x with 0; change x to y;", /ContextLookupError: Identifier 'y' not declared./],
  ["no semicolon", "make x with 0", /Expected ";"/],
  ["number as an identifier", "make 5 with 5;", /Expected not a numeral/],
  ["keyword as an identifier", "make if with 5;", /Expected not a keyword/],
  ["else statements with no if", "ifnot{}", /Expected not an idchar/],
  ["not closing brackets in a list", "make x with [1,2,3;", /Expected "]"/],
  ["not closing quotes in a string", 'make x with "hello;', /Expected "\\""/],
  ["undeclared variable in print", "print x;", /ContextLookupError/],
  [
    "non-boolean condition for if statement",
    "if 5 {}",
    /Expected "is", "is not", "is less than", "is greater than", "is less than or equal to", "is greater than or equal to", "mod", "to the", "divided by", "times", "minus", or "plus"/,
  ],
  [
    "output in function that should not have an output",
    "automate x(num: y) -> none { if 5 is 5 {output 1;} }",
    /cannot output a value of type 'number'/,
  ],
  [
    "assigning unidintified identifier",
    "change x to 1;",
    /ContextLookupError: Identifier 'x' not declared./,
  ],
  [
    "adding to an undeclared var",
    "add 5 to x;",
    /ContextLookupError: Identifier 'x' not declared./,
  ],
  [
    "function called out of scope",
    "automate add_one(num: y) -> none { add 4 to y; automate add_two(num: z) -> num { output 2; } add_two(5); } add_two(5);",
    /ContextLookupError: Identifier 'add_two' not declared./,
  ],

  [
    "re-declared var id",
    "make x with 1; make x with 2;",
    /ContextAddError: Identifier 'x' has already been declared./,
  ],
  [
    "re-declared auto id",
    "automate x(any: y) -> num { output 0; } automate x(any: z) -> num { output 0; }",
    /ContextAddError: Identifier 'x' has already been declared./,
  ],
  [
    "var id re-declared as auto",
    "make x with 1; automate x(any: y) -> num { output 0; }",
    /ContextAddError: Identifier 'x' has already been declared./,
  ],
  [
    "auto id re-declared as var",
    "automate x(any: y) -> num { output 0; } make x with 2;",
    /ContextAddError: Identifier 'x' has already been declared./,
  ],

  [
    "changing the value of a function",
    "automate x(any: y) -> num { output 0; } change x to 5;",
    /AssignError: Cannot assign value to automation 'x'./,
  ],
  [
    "adding to an automation",
    "automate x(any: y) -> num { output 0; } add 5 to x;",
    /AssignError: Cannot assign value to automation 'x'./,
  ],
  [
    "multiplying an automation",
    "automate x(any: y) -> num { output 0; } multiply x by 5;",
    /AssignError: Cannot assign value to automation 'x'./,
  ],
  [
    "an attempt to write a read-only var",
    "constantly make x with 1; change x to 2;",
    /AssignError: Cannot change value of constant 'x'./,
  ],
  [
    "assigning an undeclared variable",
    "make x with 1; change x to y;",
    /ContextLookupError: Identifier 'y' not declared./,
  ],

  [
    "incorrect output type",
    'automate hello() -> word { print "hello"; output 0; }',
    /AutoError: Automation 'hello' cannot output a value of type 'number' \(must output 'word'\)./,
  ],
  [
    "none automation with an output",
    "automate nothing() -> none { output 5; }",
    /AutoError: Automation 'nothing' cannot output a value of type 'number' \(must output 'none'\)./,
  ],
  [
    "nested outputs",
    "automate x(num: y) -> none { if true { output 4; } }",
    /AutoError: Automation 'x' cannot output a value of type 'number' \(must output 'none'\)./,
  ],

  [
    "calling a variable as a function",
    "make x with 5; x(5);",
    /CallError: Trying to call Variable 'x' as an Automation./,
  ],
  [
    "calling variable as an automation 2",
    "make x with 2; multiply x by x(2);",
    /CallError: Trying to call Variable 'x' as an Automation./,
  ],
  [
    "too few arguments",
    "automate x ( num: y, bool: z ) -> num { output y plus y; } x(1);",
    /CallError: 2 argument\(s\) required, but 1 passed./,
  ],
  [
    "too many arguments",
    "automate x ( num: y, list: z ) -> num { output y plus y; } x(1,[2],3);",
    /CallError: 2 argument\(s\) required, but 3 passed./,
  ],
  [
    "break outside of a loop",
    "break;",
    /CallError: Break must be called in a loop./,
  ],
  [
    "output outside an automation",
    "output 1;",
    /CallError: Output must be called in an automation./,
  ],
  [
    "incorrect argument types",
    'automate a(num: x, num: y) -> num { output 1; } make x with a(1,"hello");',
    /CallError: Argument 2 \(word\) must be of type: number./,
  ],

  [
    "printing undeclared identifiers",
    "print x;",
    /ContextLookupError: Identifier 'x' not declared./,
  ],
  [
    "checks types when incrementing variables",
    'make x with 5; make y with "hello"; add y to x;',
    /TypeError: Expected a numeric value, got type 'word'./,
  ],
  [
    "non-boolean variable for if statement",
    "make x with 5; if x {}",
    /TypeError: Expected a true\/false value, got type 'number'./,
  ],
  [
    "non returnable function with a return",
    "automate noOut(num: num1) -> none { output num1; }",
    /AutoError: Automation 'noOut' cannot output a value of type 'number' \(must output 'none'\)./,
  ],
  [
    "returning nothing from a function that should",
    "automate noOut(num: num1) -> num { output; }",
    /Something should be returned here/,
  ],
];

const sample = `
 make x with 5;
 if x is 5 {
   print "X IS 5";
 }
 ifnot {
   print "X IS NOT 5";
 }`;

const expected = `   1 | Program statements=[#2,#5]
   2 | VariableDeclaration variable=#3 initializer=5
   3 | Variable name='x' readOnly=false type=#4
   4 | Type description='number'
   5 | IfStatement test=#6 body=[#8] alternate=[#11]
   6 | BooleanExpression op='===' left=#3 right=5 type=#7
   7 | Type description='boolean'
   8 | PrintStatement argument=#9
   9 | StringLiteral contents='"X IS 5"' type=#10
  10 | Type description='word'
  11 | ElseStatement body=[#12]
  12 | PrintStatement argument=#13
  13 | StringLiteral contents='"X IS NOT 5"' type=#10`;

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(parse(source)));
    });
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(parse(source)), errorMessagePattern);
    });
  }
  it(`produces the expected graph for the simple sample program`, () => {
    assert.deepEqual(util.format(analyze(parse(sample))), expected);
  });
});
