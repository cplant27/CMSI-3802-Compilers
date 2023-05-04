import { Type, standardLibrary } from "./core.js";

export default function generate(program) {
  const output = [];

  const standardFunctions = new Map([
    [standardLibrary.append, ([e, x]) => `${x}.push(${e})`],
    [standardLibrary.remove, ([e, x]) => `${x}.pop(${e})`],
    [standardLibrary.length, (x) => `${x}.length`],
    [standardLibrary.type, (x) => `typeof ${x}`],
    [standardLibrary.bytes, (s) => `[...Buffer.from(${s}, "utf8")]`],
    [standardLibrary.codepoints, (s) => `[...(${s})].map(s=>s.codePointAt(0))`],
  ]);

  const targetName = ((mapping) => {
    return (entity) => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1);
      }
      return `${entity.name}_${mapping.get(entity)}`;
    };
  })(new Map());

  function gen(node) {
    return generators[node.constructor.name](node);
  }

  const generators = {
    Program(p) {
      gen(p.statements);
    },
    Variable(v) {
      if (v === standardLibrary.π) {
        return "Math.PI";
      }
      if (v === standardLibrary.inf) {
        return "Infinity";
      }
      return targetName(v);
    },
    VariableDeclaration(d) {
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`);
    },
    Assignment(a) {
      output.push(`${gen(a.target)} = ${gen(a.value)};`);
    },
    ChangeVariable(v) {
      output.push(
        `${gen(v.target)} = ${gen(v.target)} ${v.op} ${gen(v.term)};`
      );
    },
    PrintStatement(s) {
      const argument = gen(s.argument);
      output.push(`console.log(${argument});`);
    },
    Expression(e) {
      return `${gen(e.left)} ${e.op} ${gen(e.right)}`;
    },
    ParenthesesExpression(e) {
      return `(${gen(e.contents)})`;
    },
    BooleanExpression(e) {
      return `${gen(e.left)} ${e.op} ${gen(e.right)}`;
    },
    Automation(a) {
      return targetName(a);
    },
    AutomationDeclaration(d) {
      const paramNames = d.params.map(gen).join(", ");
      output.push(`function ${gen(d.auto)}(${paramNames}) {`);
      gen(d.body);
      output.push("}");
    },
    CallStatement(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(gen(c.args))
        : `${gen(c.callee)}(${gen(c.args).join(", ")})`;
      output.push(`${targetCode};`);
    },
    CallExpression(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(gen(c.args))
        : `${gen(c.callee)}(${gen(c.args).join(", ")})`;
      return targetCode;
    },
    Output(s) {
      output.push(`return ${gen(s.value)};`);
    },
    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`);
      gen(s.body);
      if (s.alternate) {
        gen(s.alternate);
      }
      output.push("}");
    },
    ElseStatement(s) {
      output.push(`} else {`);
      gen(s.body);
    },
    WhileLoop(s) {
      output.push(`while (${gen(s.test)}) {`);
      gen(s.body);
      output.push("}");
    },
    ForLoop(s) {
      output.push(`for (let ${gen(s.tempVar)} of ${gen(s.list)}) {`);
      gen(s.body);
      output.push("}");
    },
    Break(s) {
      output.push("break;");
    },
    List(e) {
      return `[${gen(e.elements).join(", ")}]`;
    },
    Number(e) {
      return e;
    },
    Boolean(e) {
      return e;
    },
    String(s) {
      return s;
    },
    StringLiteral(e) {
      return e.contents;
    },
    Array(a) {
      return a.map(gen);
    },
  };

  gen(program);
  return output.join("\n");
}
