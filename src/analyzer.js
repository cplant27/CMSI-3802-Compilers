import ohm from "ohm-js" 
import fs from "fs" 
import * as core from "./core.js" 

const toalGrammar = ohm.grammar(fs.readFileSync("src/toal.ohm"))

const Type = core.Type

// Throw an error message that takes advantage of Ohm's messaging
function error(message, node) {
  if (node) {
    throw new Error(`${node.source.getLineAndColumnMessage()}${message}`)
  }
  throw new Error(message)
}

function check(condition, message, node) {
  if (!condition) error(message, node)
}

function checkNotReadOnly(e, node) {
  check(!e.readOnly, `AssignError: Cannot change value of constant '${e.name}'.`, node)
}

function checkInLoop(context, node) {
  check(context.inLoop, "CallError: Break must be called in a loop.", node)
}

function checkInAutomation(context, node) {
  check(context.automation, "CallError: Output must be called in an automation.", node)
}

function checkType(type, types, expectation, node) {
  check(types.includes(type), `TypeError: Expected ${expectation}`, node)
}

function checkNumeric(t, node) {
  checkType(t, [Type.INT, Type.FLOAT, Type.EXP, Type.ANY], `a numeric value, got type '${t.description}'.`, node)
}

function checkNumericOrString(t, node) {
  checkType(t, [Type.INT, Type.FLOAT, Type.EXP, Type.STRING, Type.ANY], `a numeric or string value, got type '${t.description}'`, node)
}

function checkBoolean(t, node) {
  checkType(t, [Type.BOOLEAN, Type.BOOLEXP, Type.ANY], `a true/false value, got type '${t.description}'`, node)
}

function checkList(t, node) {
  checkType(t, [Type.LIST, Type.ANY], `a list, got type '${t.description}'`, node)
}

function checkReturnsNothing(f, node) {
  console.log(f)
  check(f.outputType === Type.VOID, "Something should be returned here", node)
}

function checkReturnsSomething(f, node) {
  check(f.output !== Type.VOID, "Cannot return a value here", node)
}

function checkAutomationCallArguments(args, calleeType, node) {
  checkArgumentsMatch(args, calleeType.paramTypes, node)
}

function checkArgumentsMatch(args, targetTypes) {
  check(
    targetTypes.length === args.length,
    `${targetTypes.length} argument(s) required but ${args.length} passed`
  )
  targetTypes.forEach((type, i) => checkAssignable(args[i], { toType: type }))
}

function evaluateExpression(value) {
  
}

function evaluateBooleanExpression(value) {

}

function runAutomation(value) {

}

function determineType(value, context) {
  const val = value.sourceString
  if ( val.startsWith('"') && val.endsWith('"') ) { return Type.STRING }
  else if ( val.startsWith('[') && val.endsWith(']') ) { return Type.LIST }
  else if ( !isNaN(val) ) {
    if ( val.includes('.') ) { return Type.FLOAT }
    return Type.INT
  }
  else if ( val === 'true' || val === 'false' ) { return Type.BOOLEAN }
  else if ( value.rep() instanceof core.Expression ) {
    evaluateExpression(value)
    return Type.EXP
  }
  else if ( value.rep() instanceof core.ParenthesesExpression ) {
    evaluateExpression(value.rep().contents)
    return Type.EXP
  }
  else if ( value.rep() instanceof core.BooleanExpression ) {
    evaluateBooleanExpression(value)
    return Type.BOOLEXP
  }
  else if ( value.rep() instanceof core.CallExpression ) {
    runAutomation(value)
    return Type.AUTO
  }
  else if ( context.sees(value.rep()) ) { return findVarInContext(value.rep(), context).type }
  else { 
    console.log(value.rep())
    console.log(context.localvars)
    error(`TypeDetermineError: Value '${val}' cannot be identified.`, value) 
  }
}

// function checkInteger(t, node) {
//   checkType(t, [Type.INT, Type.EXP, Type.ANY], `an integer value, got type '${t.description}'`, node)
// }

// function checkHaveSameType(t1, t2, node) {
//   check(t1.type.isEquivalentTo(t2.type), "Operands do not have the same type", node)
// }

// function checkIsAType(t, node) {
//   check(t instanceof Type, "Type expected", node)
// }

// function checkAllHaveSameType(expressions) {
//   check(
//     expressions.slice(1).every(e => e.type.isEquivalentTo(expressions[0].type)),
//     "Not all elements have the same type"
//   )
// }

class Context {
  constructor({ parent = null, localvars = new Map(), localautos = new Map(), inLoop = false, automation: a = null }) {
    Object.assign(this, { parent, localvars, localautos, inLoop, automation: a })
  }
  sees(name) {
    // Search "outward" through enclosing scopes
    return this.localvars.has(name) || this.localautos.has(name) || this.parent?.sees(name) 
  }
  add(name, entity, node) {
    // No shadowing! Prevent addition if id anywhere in scope chain! This is
    // a T.O.A.L thing. Many other languages allow shadowing, and in these,
    // we would only have to check that name is not in this.locals
    if ( entity instanceof core.Variable ) {
      if (this.sees(name)) error(`ContextAddError: Identifier '${name}' has already been declared.`, node)
      this.localvars.set(name, entity)
    }
    else if ( entity instanceof core.Automation ) {
      if (this.sees(name)) error(`ContextAddError: Identifier '${name}' has already been declared.`, node)
      this.localautos.set(name, entity)
    }
  }
  lookup(name, node) {
    const locals = new Map([...this.localvars, ...this.localautos])
    const entity = locals.get(name)
    if (entity) {
      return entity
    } else if (this.parent) {
      return this.parent.lookup(name)
    }
    error(`ContextLookupError: Identifier '${name}' not declared.`, node)
  }
  newChildContext(props) {
    const c = new Context({ ...this, ...props, parent: this, localvars: new Map(), localautos: new Map()})
    return c
  }
}

function findVarInContext(val, context) {
  if ( context.localvars.has(val) ) {
    return context.localvars.get(val)
  }
  return findVarInContext(val, context.parent)
}

export default function analyze(sourceCode) {

  let context = new Context({})

  const analyzer = toalGrammar.createSemantics().addOperation("rep", {
    Program(body) {
      return new core.Program(body.rep())
    },
    Var(identifier) {
      return identifier.rep()
    },
    Statement_vardec(constant, _make, identifier, _with, initializer, _semicolon) {
      const initializerRep = initializer.rep()
      const id = identifier.sourceString
      const readOnly = constant.sourceString === "constantly"
      const type = determineType(initializer, context)
      const variable = new core.Variable(id, readOnly, type)
      context.add(id, variable, identifier)
      return new core.VariableDeclaration(variable, initializerRep)
    },
    Statement_varass(_change, identifier, _to, expression, _semicolon) {
      const id = identifier.sourceString
      const variable = context.lookup(identifier.sourceString, identifier)
      if ( !(variable instanceof core.Variable) ) { error(`AssignError: Cannot assign value to automation '${id}'.`, identifier) }
      checkNotReadOnly(variable, identifier)
      const type = determineType(expression, context)
      context.localvars.set(id, variable)
      return new core.Assignment(identifier.rep(), expression.rep(), type)
    },
    ChngVar1(op, term, _tofrom, target, _semicolon) {
      const targetRep = target.rep()
      const termRep = term.rep()
      const targetVariable = context.lookup(target.sourceString, target)
      if ( !(targetVariable instanceof core.Variable) ) { error(`AssignError: Cannot assign value to automation '${targetRep}'.`, target) }
      const targetType = targetVariable.type
      checkNumeric(targetType, target)
      checkNotReadOnly(targetVariable, target)
      const termType = determineType(term, context)
      checkNumeric(termType, term)
      switch (op.sourceString) {
        case "add":
          return new core.ChangeVariable('+', termRep, targetRep)
        case "subtract":
          return new core.ChangeVariable('-', termRep, targetRep)
      }
    },
    ChngVar0(op, target, _by, term, _semicolon) {
      const targetRep = target.rep()
      const termRep = term.rep()
      const targetVariable = context.lookup(target.sourceString, target)
      if ( !(targetVariable instanceof core.Variable) ) { error(`AssignError: Cannot assign value to automation '${targetRep}'.`, target) }
      const targetType = targetVariable.type
      checkNumeric(targetType, target)
      checkNotReadOnly(targetVariable, target)
      const termType = determineType(term, context)
      checkNumeric(termType, term)
      switch (op.sourceString) {
        case "multiply":
          return new core.ChangeVariable('*', termRep, targetRep)
        case "divide":
          return new core.ChangeVariable('/', termRep, targetRep)
        case "raise":
          return new core.ChangeVariable('^', termRep, targetRep)
        case "mod":
          return new core.ChangeVariable('%', termRep, targetRep)
      }
    },
    Statement_prnt(_print, argument, _semicolon) {
      // check if its a variable
      const type = determineType(argument, context)
      return new core.PrintStatement(argument.rep(), type)
    },
    List(_open, elements, _close) {
      return elements.asIteration().rep()
    },
    Block(_open, body, _close) {
      return body.rep()
    },
    Param(type, _colon, identifier){
      return new core.Param(identifier.sourceString, Type.fromName(type.sourceString))
    },
    Statement_autodec(_auto, identifier, _open, params, _close, output, body) {
      const paramsRep = params.asIteration().rep()
      const id = identifier.sourceString
      const outputType = Type.fromName(output.sourceString)
      if (outputType === Type.ANY) error(`AutoError: Must specify automation output type (cannot be ANY).`, output)
      const auto = new core.Automation(id, paramsRep.length, outputType)
      // Add the automation to the context before analyzing the body, because
      // we want to allow automations to be recursive
      context.add(id, auto)
      context = context.newChildContext({ automation: identifier.sourceString })
      for (const p of paramsRep) {
        if (p.type === Type.NONE) error(`AutoError: Type of parameter '${p.name}' cannot be NONE.`, params)
        context.add(p.name, new core.Variable(p.name, false, p.type), params)
      }
      const bodyRep = body.rep()
      context = context.parent
      return new core.AutomationDeclaration(id, auto, paramsRep, outputType, bodyRep)
    },
    Statement_callstmt(identifier, _open, args, _close, _semicolon) {
      const auto = context.lookup(identifier.sourceString, identifier)
      if ( auto instanceof core.Variable ) { error(`CallError: Trying to call Variable '${identifier.sourceString}' as an Automation.`, identifier) }
      const argsRep = args.asIteration().rep()
      check(
        argsRep.length === auto.paramCount,
        `CallError: Expected ${auto.paramCount} arg(s), found ${argsRep.length}.`,
        _open
      )
      return new core.CallStatement(auto, argsRep)
    },
    CallExp(identifier, _open, args, _close) {
      const auto = context.lookup(identifier.sourceString, identifier)
      if ( auto instanceof core.Variable ) { error(`CallError: Trying to call Variable '${identifier.sourceString}' as an Automation.`, identifier) }
      const argsRep = args.asIteration().rep()
      check(
        argsRep.length === auto.paramCount,
        `CallError: Expected ${auto.paramCount} arg(s), found ${argsRep.length}.`,
        _open
      )
      return new core.CallExpression(auto, argsRep)
    },
    Statement_output(_output, value, _semicolon) {
      checkInAutomation(context, _output)
      if (value.rep().length === 0){
        const auto = context.lookup(context.automation)
        checkReturnsNothing(auto, value)
      }
      const type = determineType(value, context)
      return new core.Output(value.rep(), type)
    },
    Statement_if(_if, condition, body, alternate) {
      const condRep = condition.rep()
      const condType = determineType(condition, context)
      checkBoolean(condType, condition)
      return new core.IfStatement(condition.rep(), body.rep(), alternate.rep())
    },
    ElseStmt(_ifnot, body) {
      return body.rep()
    },
    Statement_while(_loop, _while, test, body) {
      const testRep = test.rep()
      const testType = determineType(test, context)
      checkBoolean(testType, test)
      context = context.newChildContext({ inLoop: true })
      const bodyRep = body.rep()
      context = context.parent
      return new core.WhileLoop(testRep, bodyRep)
    },
    Statement_for(_loop, _over, tempVar, _in, list, body) {
      const tempRep = tempVar.rep()
      const listRep = list.rep()
      const listType = determineType(list, context)
      checkList(listType, list)
      context = context.newChildContext({ inLoop: true })
      context.add(tempRep, new core.Variable(tempVar.sourceString, false, Type.ANY), tempVar)
      const bodyRep = body.rep()
      context = context.parent
      return new core.ForLoop(tempRep, listRep, bodyRep)
    },
    Statement_break(_break, _semicolon) {
      checkInLoop(context, _break)
      return new core.Break()
    },
    Exp0_parentheses(_open, expression, _close) {
      return new core.ParenthesesExpression(expression.rep())
    },
    Exp_expression(left, operator, right) {
      const rightRep = right.rep()
      const leftRep = left.rep()
      const rightType = determineType(right, context)
      const leftType = determineType(left, context)
      checkNumeric(rightType, right)
      checkNumeric(leftType, left)
      switch (operator.sourceString) {
        case "plus":
          return new core.Expression('+', leftRep, rightRep)
        case "minus":
          return new core.Expression('-', leftRep, rightRep)
        case "times":
          return new core.Expression('*', leftRep, rightRep)
        case "divided by":
          return new core.Expression('/', leftRep, rightRep)
        case "to the":
          return new core.Expression('^', leftRep, rightRep)
        case "mod":
          return new core.Expression('%', leftRep, rightRep)
      }
    },
    BoolExp(left, operator, right) {
      const rightRep = right.rep()
      const leftRep = left.rep()
      const rightType = determineType(right, context)
      const leftType = determineType(left, context)
      checkNumericOrString(rightType, right)
      checkNumericOrString(leftType, left)
      switch (operator.sourceString) {
        case "is greater than":
          return new core.BooleanExpression('>', leftRep, rightRep)
        case "is less than":
          return new core.BooleanExpression('<', leftRep, rightRep)
        case "is":
          return new core.BooleanExpression('=', leftRep, rightRep)
        case "is not":
          return new core.BooleanExpression('!=', leftRep, rightRep)
        case "is greater than or equal to":
          return new core.BooleanExpression('>=', leftRep, rightRep)
        case "is less than or equal to":
          return new core.BooleanExpression('<=', leftRep, rightRep)
      }
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
    // _terminal() {
    //   return this.sourceString
    // },
    _iter(children) {
      return children.map(child => child.rep())
    }
  })

  // for (const [name, entity] of Object.entries(core.standardLibrary)) {
  //   context.localvars.set(name, entity)
  // }
  const match = toalGrammar.match(sourceCode) 
  if (!match.succeeded()) error(match.message) 
  // console.log("Grammar Check Passed!") 
  return analyzer(match).rep()
}
