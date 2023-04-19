#! /usr/bin/env node

import fs from "fs/promises";
import process from "process";
import compile from "./compiler.js";

const help = `T.O.A.L. Compiler
Syntax: node toal.js <filename> <outputType>
Prints to stdout according to <outputType>, which must be one of:
  parsed     the parse tree
  analyzed   the semantically analyzed representation
  optimized  the optimized semantically analyzed representation
  js         the translation to JavaScript
`;

const OnlyToalErrors = false;

async function compileFromFile(
  filename,
  outputType,
  showFullErrors = !OnlyToalErrors
) {
  // Show only T.O.A.L. generated errors (does not work for 'npm test')
  if (!showFullErrors) {
    try {
      const buffer = await fs.readFile(filename);
      console.log(compile(buffer.toString(), outputType));
    } catch (e) {
      console.error(`\u001b[31m${e}\u001b[39m`);
      process.exitCode = 1;
    }
  }
  // Show full OHM error message
  if (showFullErrors) {
    const buffer = await fs.readFile(filename);
    console.log(compile(buffer.toString(), outputType));
  }
}

if (process.argv.length !== 4) {
  console.log(help);
} else {
  compileFromFile(process.argv[2], process.argv[3]);
}
