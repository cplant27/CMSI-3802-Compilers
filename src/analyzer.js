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

  let context = {
    localvars: new Map(),
    localautos: new Map(),
  }

  const analyzer = toalGrammar.createSemantics().addOperation("val", {
    Program(body) {
      return new core.Program(body.val())
    },
    Var(identifier) {
      return identifier.val()
    },
    Statement_vardec(constant, _make, identifier, _with, initializer, _semicolon) {
      // Analyze the initializer *before* adding the variable to the context,
      // because we don't want the variable to come into scope until after
      // the declaration. That is, "let x=x;" should be an error (unless x
      // was already defined in an outer scope.)
      const initializerVal = initializer.val()
      const id = identifier.val()
      const readOnly = constant.sourceString === "constantly"
      if (context.localvars.has(id) ) {
         error(`Variabe '${id}' has already been declared.`, identifier) 
      }
      const variable = new core.Variable(identifier.sourceString, readOnly)
      context.localvars.set(identifier.sourceString, variable, identifier)
      return new core.VariableDeclaration(variable, initializerVal)
    },
    Statement_varass(_change, identifier, _to, expression, _semicolon) {
      const id = identifier.val()
      const variable = context.localvars.get(id)
      if (! variable ) { error(`Variabe '${id}' has not been declared.`, identifier) }
      return new core.Assignment(id, expression.val())
    },
    Statement_prnt(_print, argument, _semicolon) {
      return new core.PrintStatement(argument.val())
    },
    List(_open, elements, _close) {
      return elements.asIteration().val()
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
    Statement_autodec(_auto, identifier, _open, params, _close, body) {
      params = params.asIteration().children
      const auto = new core.Automation(identifier.sourceString, params.length, true)
      // Add the function to the context before analyzing the body, because
      // we want to allow functions to be recursive
      context.localautos.set(identifier.sourceString, auto, identifier)
      // context = new Context(context)
      const paramsVal = params.map(p => {
        let variable = new core.Variable(p.sourceString, true)
        context.localvars.set(p.sourceString, variable, p)
        return variable
      })
      const bodyVal = body.val()
      // context = context.parent
      return new core.AutomationDeclaration(auto, paramsVal, bodyVal)
    },
    Statement_callstmt(identifier, open, args, _close) {
      const auto = context.localautos.get(identifier.sourceString, core.Automation, identifier)
      const argsVal = args.asIteration().val()
      check(
        argsVal.length === auto.paramCount,
        `Expected ${auto.paramCount} arg(s), found ${argsVal.length}`,
        open
      )
      return new core.CallStatement(auto, argsVal)
    },
    CallExp(identifier, open, args, _close) {
      const auto = context.localautos.get(identifier.sourceString, core.Automation, identifier)
      const argsVal = args.asIteration().val()
      check(
        argsVal.length === auto.paramCount,
        `Expected ${auto.paramCount} arg(s), found ${argsVal.length}`,
        open
      )
      return new core.CallExpression(auto, argsVal)
    },
    Statement_output(_output, term, _semicolon) {
      return new core.Output(term.val())
    },
    Statement_while(_loop, _while, test, body) {
      return new core.WhileLoop(test.val(), body.val())
    },
    Statement_for(_loop, _for, tempVar, _in, list, body) {
      return new core.ForLoop(tempVar.val(), list.val(), body.val())
    },
    Statement_break(_break, _semicolon) {
      const loop = context.parent
      return new core.Break(loop)
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
    id(chars) {
      return chars.sourceString
    },
    numeral(_neg, _whole, _dot, _decimal) {
      return Number(this.sourceString)
    },
    strlit(_open, chars, _close) {
      return new core.StringLiteral(this.sourceString)
    },
    _terminal() {
      return this.sourceString
    },
    _iter(children) {
      return children.map(child => child.val())
    }
  })

  // for (const [name, entity] of Object.entries(core.standardLibrary)) {
  //   context.localvars.set(name, entity)
  // }
  const match = toalGrammar.match(sourceCode);
  if (!match.succeeded()) error(match.message);
  console.log("Grammar Check Passed!");
  return analyzer(match).val()
}
