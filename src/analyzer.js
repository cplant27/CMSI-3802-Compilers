import ohm from "ohm-js";
import fs from "fs";
import * as core from "./core.js";

const toalGrammar = ohm.grammar(fs.readFileSync("src/toal.ohm"));

// Throw an error message that takes advantage of Ohm's messaging
function error(message, node) {
  if (node) {
    throw new Error(`${node.source.getLineAndColumnMessage()}${message}`);
  }
  throw new Error(message);
}

function check(condition, message, node) {
  if (!condition) error(message, node)
}

class Context {
  constructor(parent = null) {
    this.parent = parent
    this.locals = new Map()
  }
  add(name, entity, node) {
    check(!this.locals.has(name), `${name} has already been declared`, node)
    this.locals.set(name, entity)
    return entity
  }
  get(name, expectedType, node) {
    let entity
    for (let context = this; context; context = context.parent) {
      entity = context.locals.get(name)
      if (entity) break
    }
    check(entity, `${name} has not been declared`, node)
    check(
      entity.constructor === expectedType,
      `${name} was expected to be a ${expectedType.name}`,
      node
    )
    return entity
  }
}

export default function analyze(sourceCode) {

  let context = new Context()

  const analyzer = toalGrammar.createSemantics().addOperation("val", {
    Program(body) {
      return new core.Program(body.val())
    },
    id(chars) {
      return chars.sourceString
    },
    Var(id) {
      return id.val()
    },
    Statement_vardec(modifier, _make, id, _with, initializer, _semicolon) {
      // Analyze the initializer *before* adding the variable to the context,
      // because we don't want the variable to come into scope until after
      // the declaration. That is, "let x=x;" should be an error (unless x
      // was already defined in an outer scope.)
      const initializerVal = initializer.val()
      const readOnly = modifier.sourceString === "constantly"
      const variable = new core.Variable(id.sourceString, false)
      context.add(id.sourceString, variable, id)
      return new core.VariableDeclaration(variable, initializerVal)
    },
    Statement_varass(_change, id, _to, expression, _semicolon) {
      const target = id.val()
      return new core.Assignment(target, expression.val())
    },
    Statement_prnt(_print, argument, _semicolon) {
      return new core.PrintStatement(argument.val())
    },
    List(_open, elements, _close) {
      return elements.val()
    },
    Block(_open, body, _close) {
      return body.val()
    },
    ElseStmt(_if, _not, body) {
      return body.val()
    },
    Statement_if(_if, condition, body, alternate) {
      return new core.IfStatement(condition.val(), body.val(), alternate.val())
    },
    Statement_autodec(_auto, id, _open, params, _close, body) {
      params = params.asIteration().children
      const auto = new core.Automation(id.sourceString, params.length, true)
      // Add the function to the context before analyzing the body, because
      // we want to allow functions to be recursive
      context.add(id.sourceString, auto, id)
      context = new Context(context)
      const paramsVal = params.map(p => {
        let variable = new core.Variable(p.sourceString, true)
        context.add(p.sourceString, variable, p)
        return variable
      })
      const bodyVal = body.val()
      context = context.parent
      return new core.AutomationDeclaration(auto, paramsVal, bodyVal)
    },
    Statement_callstmt(id, open, args, _close) {
      const auto = context.get(id.sourceString, core.Automation, id)
      const argsVal = args.asIteration().val()
      check(
        argsVal.length === auto.paramCount,
        `Expected ${auto.paramCount} arg(s), found ${argsVal.length}`,
        open
      )
      return new core.CallStatement(auto, argsVal)
    },
    CallExp(id, open, args, _close) {
      const auto = context.get(id.sourceString, core.Automation, id)
      const argsVal = args.asIteration().val()
      check(
        argsVal.length === auto.paramCount,
        `Expected ${auto.paramCount} arg(s), found ${argsVal.length}`,
        open
      )
      return new core.CallExpression(auto, argsVal)
    },
    Statement_output(_output, term, _semicolon) {
      return new core.Output(term)
    },
    Statement_while(_loop, _while, test, body) {
      return new core.WhileLoop(test.val(), body.val())
    },
    Statement_for(_loop, _for, tempVar, _in, list, body) {
      return new core.ForLoop(tempVar.val(), list.val(), body.val())
    },
    Exp_parentheses(_open, expression, _close) {
      return expression.val()
    },
    Exp_exponents(left, _op, right) {
      return new core.Expression("^", left.val(), right.val())
    },
    Exp_multiplication(left, _op, right) {
      return new core.Expression("*", left.val(), right.val())
    },
    Exp_division(left, _op, right) {
      return new core.Expression("/", left.val(), right.val())
    },
    Exp_modulo(left, _op, right) {
      return new core.Expression("%", left.val(), right.val())
    },
    Exp_addition(left, _op, right) {
      return new core.Expression("+", left.val(), right.val())
    },
    Exp_subtraction(left, _op, right) {
      return new core.Expression("-", left.val(), right.val())
    },
    BoolExp_greater(left, _op, right) {
      return new core.BooleanExpression(">", left.val(), right.val())
    },
    BoolExp_less(left, _op, right) {
      return new core.BooleanExpression("<", left.val(), right.val())
    },
    BoolExp_equals(left, _op, right) {
      return new core.BooleanExpression("=", left.val(), right.val())
    },
    BoolExp_notEqual(left, _op, right) {
      return new core.BooleanExpression("!=", left.val(), right.val())
    },
    BoolExp_greaterEqual(left, _op, right) {
      return new core.BooleanExpression(">=", left.val(), right.val())
    },
    BoolExp_lessEqual(left, _op, right) {
      return new core.BooleanExpression("<=", left.val(), right.val())
    },
    ChngVar_addTo(op, term, _to, target, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    ChngVar_subFrom(op, term, _from, target, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    ChngVar_multBy(op, target, _by, term, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    ChngVar_divBy(op, target, _by, term, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    ChngVar_raiseTo(op, target, _toThe, term, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    ChngVar_modBy(op, target, _by, term, _semicolon) {
      return new core.ChangeVariable(op.val(), term.val(), target.val())
    },
    true(_) {
      return true
    },
    false(_) {
      return false
    },
    numeral(_neg, _whole, _dot, _decimal) {
      return this.sourceString
    },
    strlit(_open, chars, _close) {
      return this.sourceString
    },
    _terminal() {
      return this.sourceString
    },
    _iter(children) {
      return children.map(child => child.val())
    }
  })

  for (const [name, entity] of Object.entries(core.standardLibrary)) {
    context.locals.set(name, entity)
  }
  const match = toalGrammar.match(sourceCode);
  if (!match.succeeded()) error(match.message);
  console.log("Grammar Check Passed!");
  return analyzer(match).val()
}
