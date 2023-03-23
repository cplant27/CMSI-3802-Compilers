import util from "util"
import assert from "assert/strict"
import analyze from "../src/analyzer.js"

const semanticChecks = [
  ["print statements", 'make x with 1 ; print x; print 5; print "hello"; print true;'],
  ["variables can be all basic types", 'make a with 1; make b with 1.1; make c with true; make d with "string";'],
  ["variables can be expressions", 'make a with 2 plus 2; make b with 1 is less than 2;'],
  ["variables can be reassigned", 'make x with 1 ; change x to 2;'],
  ["variables can be auto calls", 'automate x(y){} make z with x(1);'],
  ["if/ifnot statement", 'make x with 5 ; if x is 5 { print "X IS 5"; } ifnot { print "X IS NOT 5";}'],
  ["if statements with variable as condition", 'make x with true; if x{}'],
  ["while loop", 'make x with 0; loop while x is less than 5 {add 1 to x;}'],
  ["while loop with break", 'make x with 0; loop while x is less than 5 {add 1 to x; break;}'],
  ["for loop with break", 'make x with [1,2,3]; loop over e in x{print e;}'],
  [
    "for loops and lists", 
    `make this_list with [1,"hello", [1,2,3], []];
    loop over element in this_list {
      print element;
    }`
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
    }`
  ],
  [
    "automations and calls",
    `automate addNums( num , num2 ) {
      output num plus num2;
    } 
    make x with 9;
    make y with 1;
    change x to addNums(x, 5);
    addNums(x, y);`
  ],
  [
    "operators",
    `make x with 1;
    change x to x plus 1;
    change x to x minus 1;
    change x to x times 1;
    change x to x divided by 1;
    change x to x to the 1;
    change x to x mod 1;`
  ],
  [
    "variable expressions", 
    `make x with 1;
    add 1 to x;
    subtract 1 from x;
    multiply x by 1;
    divide x by 1;
    raise x to the 1;
    mod x by 1;`
  ],
  ["complex equations", 'make x with 1 plus (1 minus -8) times 2;'],
  ["paren placement issue", 'make x with ( 1 plus 1 ) minus 1;'],
  ["booleans", 'make x with true; change x to false;'],
  [
    "boolean expressions as variables", 
    `make a with 1 is greater than 2;
    make b with 1 is less than 2 ;
    make c with 1 is 2 ;
    make d with 1 is not 2 ;
    make e with 1 is greater than or equal to 2 ;
    make f with 1 is less than or equal to 2 ;`
  ],
  ["variables declared in scope", 'automate x(y) {} make y with 1;'],
  ["call expressions", 'automate add_one(y) { add 1 to y; output y; } make x with 1; multiply x by addone(1);']
]

const semanticErrors = [
  ["no semicolon", 'make x with 0', /Expected ";"/],
  ["number as an identifier", 'make 5 with 5;', /Expected not a numeral/],
  ["keyword as an identifier", 'make if with 5;', /Expected not a keyword/],
  ["else statements with no if", 'ifnot{}', /Expected not an idchar/],
  ["not closing brackets in a list",'make x with [1,2,3;',/Expected "]"/],
  ["not closing quotes in a string", 'make x with "hello;', /Expected "\\""/],
  ["non-boolean condition for if statement", 'if 5 {}', /Expected "is", "is not", "is less than", "is greater than", "is less than or equal to", "is greater than or equal to", "mod", "to the", "divided by", "times", "minus", or "plus"/],

  ["assigning unidintified identifier", 'change x to 1;', /ContextLookupError: Identifier 'x' not declared./],
  ["adding to an undeclared var", 'add 5 to x;', /ContextLookupError: Identifier 'x' not declared./],

  ["re-declared var id", "make x with 1; make x with 2;", /ContextAddError: Identifier 'x' has already been declared./],
  ["re-declared auto id", "automate x(y){} automate x(z){}", /ContextAddError: Identifier 'x' has already been declared./],
  ["var id re-declared as auto", "make x with 1; automate x(y){}", /ContextAddError: Identifier 'x' has already been declared./],
  ["auto id re-declared as var", "automate x(y){} make x with 2;", /ContextAddError: Identifier 'x' has already been declared./],

  ["changing the value of a function",'automate x(y){} change x to 5;',/AssignError: Cannot assign value to automation 'x'./],
  ["adding to an automation",'automate x(y){} add 5 to x;',/AssignError: Cannot assign value to automation 'x'./],
  ["multiplying an automation",'automate x(y){} multiply x by 5;',/AssignError: Cannot assign value to automation 'x'./],
  ["an attempt to write a read-only var", "constantly make x with 1; change x to 2;", /AssignError: Cannot change value of constant 'x'./],

  ["calling a variable as a function", 'make x with 5; x(5);', /CallError: Trying to call Variable 'x' as an Automation./ ],
  ["calling variable as an automation 2", 'make x with 2; multiply x by x(2);', /CallError: Trying to call Variable 'x' as an Automation./ ],
  ["too few arguments", 'automate x ( y, z ) { output y plus z; } x(1);', /CallError: Expected 2 arg\(s\), found 1./],
  ["too many arguments", "automate x ( y, z ) { output y plus z; } x(1,2,3);", /CallError: Expected 2 arg\(s\), found 3./],
  ["break outside of a loop", 'break;', /CallError: Break must be called in a loop./],
  ["output outside an automation", 'output 1;', /CallError: Output must be called in an automation./],
  
  ["printing undeclared identifiers", "print x;", /TypeDetermineError: Value 'x' cannot be identified./],
  ["checks types when modifying variables", 'make x with 5; make y with "hello"; add y to x;', /TypeError: Expected a numeric value, got type 'string'./],
  ["non-boolean variable for if statement", 'make x with 5; if x{}', /TypeError: Expected a true\/false value, got type 'integer'/],
]

const sample = `
 make x with 5;
 if x is 5 {
   print "X IS 5";
 }
 ifnot {
   print "X IS NOT 5";
 }`

const expected = `   1 | Program statements=[#2,#5]
   2 | VariableDeclaration variable=#3 initializer=5
   3 | Variable name='x' readOnly=false type=#4
   4 | Type description='integer'
   5 | IfStatement test=#6 consequent=[#7]
   6 | BooleanExpression op='=' left='x' right=5
   7 | PrintStatement argument=#8 type=#9
   8 | StringLiteral contents='"X IS 5"'
   9 | Type description='string'`

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(source))
    })
  }
  for (const [scenario, source, errorMessagePattern] of semanticErrors) {
    it(`throws on ${scenario}`, () => {
      assert.throws(() => analyze(source), errorMessagePattern)
    })
  }
  it(`produces the expected graph for the simple sample program`, () => {
    assert.deepEqual(util.format(analyze(sample)), expected)
  })
})