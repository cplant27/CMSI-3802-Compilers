import assert from "node:assert/strict";
import analyze from "../src/analyzer.js";
import optimize from "../src/optimizer.js";
import generate from "../src/generator.js";
import parse from "../src/parser.js";

function dedent(s) {
  return `${s}`.replace(/(?<=\n)\s+/g, "").trim();
}

const fixtures = [
  {
    name: "small",
    source: `
      make x with 3 times 7;
      add 1 to x;
      subtract 1 from x;
      multiply x by 1;
      divide x by 1;
      raise x to the 1;
      mod x by 1;
      make y with true;
      print x;
    `,
    expected: dedent`
      let x_1 = 3 * 7;
      x_1 = x_1 + 1;
      x_1 = x_1 - 1;
      x_1 = x_1 * 1;
      x_1 = x_1 / 1;
      x_1 = x_1 ^ 1;
      x_1 = x_1 % 1;
      let y_2 = true_3;
      console.log(x_1);
    `,
  },
  {
    name: "long math",
    source: `
    make x with 1 plus (2 plus 3) plus 4;
    `,
    expected: dedent`
    let x_1 = 1 + (2 + 3) + 4;
    `,
  },
  {
    name: "if",
    source: `
      make x with 5;
      if x is 5 { 
        print "X IS 5";
      }
      ifnot {
        print "X IS NOT 5";
      }
    `,
    expected: dedent`
      let x_1 = 5;
      if (x_1 === 5) {
        console.log("X IS 5");
      } else {
        console.log("X IS NOT 5");
      }
    `,
  },
  {
    name: "auto",
    source: `
      automate addNums( num: num1 , num: num2 ) -> num {
          output num1 plus num2;
      }
      make x with 9;
      make y with 1;
      change x to addNums(x, 5);
      addNums(x, 5);
    `,
    expected: dedent`
      function addNums_1( num1, num2 ) {
        return num1 + num2;
      }
      let x = 9;
      let y = 1;
      x = addNums_1(x, 5);
      addNums(x, 5);
    `,
  },
  {
    name: "while",
    source: `
      make x with 0;

      loop while x is less than 5{
        change x to x plus 1;
        print x;
        break;
      }
    `,
    expected: dedent`
      let x_1 = 0;
      while (x_1 < 5) {
        x_1 = x_1 + 1;
        console.log(x_1);
        break;
      }
    `,
  },
    {
    name: "for",
    source: `
      make this_list with [1,"hello", [1,2,3], []];
      loop over element in this_list {
          print element;
      }
      loop over element in [1,2,3] {
          print element;
      }
    `,
    expected: dedent`
      let this_list = [1, "hello", [1,2,3], []];
      for (let element of this_list){
        console.log(element);
      }
      for (let element of [1,2,3]){
        console.log(element);
      }
    `,
  },
  {
    name: "stdLib",
    source: `
    print type(π);
    print type(inf);
    make a_list with [1,2,3];
    append(4, a_list);
    remove(4, a_list);
    print length(a_list);
    print type(true);
    print type(false);
    `,
    expected: dedent`
    console.log(typeof Math.PI);
    console.log(typeof Infinity);
    let a_list_1 = [1,2,3];
    a_list_1.push(4);
    a_list_1.pop(4);
    console.log(a_list_1.length);
    console.log(typeof true);
    console.log(typeof false);
    `,
  },
  // {
  //   name: "name",
  //   source: `

  //   `,
  //   expected: dedent`

  //   `,
  // },
];

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected js output for the ${fixture.name} program`, () => {
      const actual = generate(analyze(parse(fixture.source)));
      // const actual = generate(optimize(analyze(parse(fixture.source))))
      assert.deepEqual(actual, fixture.expected);
    });
  }
});
