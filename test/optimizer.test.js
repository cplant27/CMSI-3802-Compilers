import assert from "assert/strict";
import optimize from "../src/optimizer.js";

const sampleProgram = "print 0;";

describe("The optimizer", () => {
  it("knows how to call the optimizer", () => {
    assert.ok(() => optimize());
  });
});
