// export default function generate() {
//   throw new Error("Not yet implemented");
// }

// CODE GENERATOR
//
// Invoke generate(program) with the program node to get back the JavaScript
// translation as a string.

import { IfStatement, Type, standardLibrary } from "./core.js"

export default function generate(program) {
  const output = []

  const standardFunctions = new Map([
    [standardLibrary.print, x => `console.log(${x})`],
    [standardLibrary.append, x => `${x}.append(${e})`],
    [standardLibrary.remove, x => `${x}.remove(${e})`],
    [standardLibrary.type, x => `typeof ${x}`],
    [standardLibrary.bytes, s => `[...Buffer.from(${s}, "utf8")]`],
    [standardLibrary.codepoints, s => `[...(${s})].map(s=>s.codePointAt(0))`],
  ])

  // Variable and function names in JS will be suffixed with _1, _2, _3,
  // etc. This is because "switch", for example, is a legal name in Carlos,
  // but not in JS. So, the Carlos variable "switch" must become something
  // like "switch_1". We handle this by mapping each name to its suffix.
  const targetName = (mapping => {
    return entity => {
      if (!mapping.has(entity)) {
        mapping.set(entity, mapping.size + 1)
      }
      return `${entity.name ?? entity.description}_${mapping.get(entity)}`
    }
  })(new Map())

  function gen(node) {
    return generators[node.constructor.name](node)
  }

  const generators = {
    // Key idea: when generating an expression, just return the JS string; when
    // generating a statement, write lines of translated JS to the output array.
    Program(p) {
      gen(p.statements)
    },
    Variable(v) {
      // Standard library constants just get special treatment
      if (v === standardLibrary.π) {
        return "Math.PI"
      }
      if (v === standardLibrary.inf) {
        return "Infinity"
      }
      return targetName(v)
    },
    VariableDeclaration(d) {
      // We don't care about const vs. let in the generated code! The analyzer has
      // already checked that we never updated a const, so let is always fine.
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`)
    },
    Assignment(a) {
      output.push(`${gen(a.target)} = ${gen(a.value)};`)
    },
    ChangeVariable(v) {
      output.push(`${v.term} = ${v.term} ${v.op} ${v.target}`)
    },
    PrintStatement(s) {
      const argument = gen(s.argument)
      output.push(`console.log(${argument});`)
    },
    Expression(e) {
      output.push(`${e.left} ${e.op} ${e.right}`)
    },
    ParenthasesExpression(e) {
      output.push(`(${e.contents})`)
    },
    BooleanExpression(e) {
      output.push(`${e.left} ${e.op} ${e.right}`)
    },
    Automation(a) {
      return targetName(a)
    },
    AutomationDeclaration(d) {
      output.push(`function ${gen(d.auto)}(${gen(d.params).join(", ")}) {`)
      gen(d.body)
      output.push("}")
    },
    CallStatement(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(gen(c.args))
        : `${gen(c.callee)}(${gen(c.args).join(", ")})`
      // Calls in expressions vs in statements are handled differently
      if (c.callee.type.returnType !== Type.VOID) {
        return targetCode
      }
      output.push(`${targetCode};`)
    },
    CallExpression(c) {
      const targetCode = standardFunctions.has(c.callee)
        ? standardFunctions.get(c.callee)(gen(c.args))
        : `${gen(c.callee)}(${gen(c.args).join(", ")})`
      // Calls in expressions vs in statements are handled differently
      if (c.callee.type.returnType !== Type.VOID) {
        return targetCode
      }
      output.push(`${targetCode};`)
    },
    Output(s) {
      output.push(`return ${gen(s.expression)};`)
    },
    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`)
      gen(s.consequent)
      if (s.alternate) {
        output.push("} else")
        gen(s.alternate.body)
      } else {
        output.push("}")
      }
    },
    WhileLoop(s) {
      output.push(`while (${gen(s.test)}) {`)
      gen(s.body)
      output.push("}")
    },
    ForLoop(s) {
      output.push(`for (let ${gen(s.tempVar)} of ${gen(s.list)}) {`)
      gen(s.body)
      output.push("}")
    },
    Break(s) {
      output.push("break;")
    },
    List(e) {
      return `[${gen(e.elements).join(",")}]`
    },
    Number(e) {
      return e
    },
    Boolean(e) {
      return e
    },
    StringLiteral(e) {
      return e.contents
    },
    Array(a) {
      return a.map(gen)
    }
  }

  // let randomCalled = false
  gen(program)
  // if (randomCalled) output.push("function _r(a){return a[~~(Math.random()*a.length)]}")
  return output.join("\n")
}