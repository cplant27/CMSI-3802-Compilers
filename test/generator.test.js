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
      make y with true;
      print x;
    `,
    expected: dedent`
      let x_1 = (3 * 7);
      x_1 = x_1 + 1;
      x_1 = x_1 - 1;
      let y_2 = true_3;
      console.log(x_1);
    `,
  },
  {
    name: "if statement",
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
  // {
  //   name: "small",
  //   source: `
  //     let x = 3 * 7;
  //     x++;
  //     x--;
  //     let y = true;
  //     y = 5 ** -x / -100 > - x || false;
  //     print((y && y) || false || (x*2) != 5);
  //   `,
  //   expected: dedent`
  //     let x_1 = 21;
  //     x_1++;
  //     x_1--;
  //     let y_2 = true;
  //     y_2 = (((5 ** -(x_1)) / -(100)) > -(x_1));
  //     console.log(((y_2 && y_2) || ((x_1 * 2) !== 5)));
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
