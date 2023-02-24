import util from "util"
import assert from "assert/strict"
import analyze from "../src/analyzer.js"

const semanticChecks = [
  ["variables can be printed", 'make x with 1; print x;'],
  ["variables can be reassigned", 'make x with 1; change x to 2;'],
  ["if statement", 'make x with 5; if x is 5 { print "X IS 5"; } if not { print "X IS NOT 5";}'],
  ["while loop with break", 'make x with 0; loop while x is less than 5 {add 1 to x; break;}'],
  ["for loops and lists", 'make this_list with [1,"hello", [1,2,3]]; loop over element in this_list { print element;}'],
  ["loops in loops", 'make x with 0; loop while x is less than 10 { print x; if x is 5 { break; } add 1 to x; }'],
  ["automations and calls", 'automate addNums( num , num2 ) { output num plus num2; } make x with 9; make y with 1; change x to addNums(x, 5);'],
  ["operators", 'make x with 1; change x to x plus 1; change x to x minus 1; change x to x times 1; change x to x divided by 1; change x to x to the 1; change x to x mod 1;'],
  ["variable expressions", 'make x with 1; add 1 to x; subtract 1 from x; multiply x by 1; divide x by 1; raise x to the 1; mod x by 1;'],
  ["complex equations", 'make x with 1 plus (1 minus -8) times 2;'],
//   ["paren placement issue", 'make x with ( 1 plus 1 ) minus 1;'],
  ["booleans", 'make x with true; change x to false;'],
//   ["boolean expressions as variables", 'make a with 1 is greater than 2; make b with 1 is less than 2; make c with 1 is 2; make d with 1 is not 2; make e with 1 is greater than or equal to 2; make f with 1 is less than or equal to 2;'],
]

const semanticErrors = [
//   ["using undeclared identifiers", "print x;", /Variable x has not been declared./],
//   ["a variable used as function", "make x with 1; x(2);", /Expected "Expected end of input"/],
// //   ["a function used as variable", "print(sin + 1);", /expected/],
//   ["re-declared identifier", "make x with 1; make x with 2;", /x has already been declared/],
//   ["an attempt to write a read-only var", "constantly make x with 1; change x to 2;", /π is read only/],
// //   ["too few arguments", "print(sin());", /Expected 1 arg\(s\), found 0/],
// //   ["too many arguments", "print(sin(5, 10));", /Expected 1 arg\(s\), found 2/],
]

const sample = `make x with 5; if x is 5 { print "X IS 5"; } if not { print "X IS NOT 5";}`

const expected = `   1 | Program statements=[#2,#4]
   2 | VariableDeclaration variable=#3 initializer=5
   3 | Variable name='x' readOnly=false
   4 | IfStatement test=#5 consequent=[#6]
   5 | BooleanExpression op='=' left='x' right=5
   6 | PrintStatement argument=#7
   7 | StringLiteral contents='"X IS 5"'`

describe("The analyzer", () => {
  for (const [scenario, source] of semanticChecks) {
    it(`recognizes ${scenario}`, () => {
      assert.ok(analyze(source))
    })
  }
//   for (const [scenario, source, errorMessagePattern] of semanticErrors) {
//     it(`throws on ${scenario}`, () => {
//       assert.throws(() => analyze(source), errorMessagePattern)
//     })
//   }
//   it(`produces the expected graph for the simple sample program`, () => {
//     assert.deepEqual(util.format(analyze(sample)), expected)
//   })
})