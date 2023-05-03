import * as core from "./core.js";

const Type = core.Type;

// Throw an error message that takes advantage of Ohm's messaging
function error(message, node) {
  if (node) {
    throw new Error(`${node.source.getLineAndColumnMessage()}${message}`);
  }
  throw new Error(message);
}

function check(condition, message, node) {
  if (!condition) error(message, node);
}

function checkNotReadOnly(e, node) {
  check(
    !e.readOnly,
    `AssignError: Cannot change value of constant '${e.name}'.`,
    node
  );
}

function checkInLoop(context, node) {
  check(context.inLoop, "CallError: Break must be called in a loop.", node);
}

function checkInAutomation(context, node) {
  check(
    context.automation,
    "CallError: Output must be called in an automation.",
    node
  );
}

function checkType(type, types, expectation, node) {
  check(types.includes(type), `TypeError: Expected ${expectation}`, node);
}

function checkNumeric(t, node) {
  checkType(
    t,
    [Type.num, Type.any],
    `a numeric value, got type '${t.description}'.`,
    node
  );
}

function checkNumericOrString(t, node) {
  checkType(
    t,
    [Type.num, Type.string, Type.any],
    `a numeric or string value, got type '${t.description}'.`,
    node
  );
}

function checkBoolean(t, node) {
  checkType(
    t,
    [Type.bool, Type.any],
    `a true/false value, got type '${t.description}'.`,
    node
  );
}

function checkList(t, node) {
  checkType(
    t,
    [Type.list, Type.any],
    `a list, got type '${t.description}'.`,
    node
  );
}

function checkReturnsNothing(f, node) {
  check(f.type === Type.none, "Something should be returned here", node);
}

function checkReturnsSomething(f, node) {
  check(f.output !== Type.none, "Cannot return a value here", node);
}

function checkHasOutput(bodyRep, node) {
  let hasOutput = false;
  let nested = false;
  bodyRep.forEach((stmt) => {
    if (stmt.body) {
      if (!(stmt instanceof core.AutomationDeclaration)) {
        checkHasOutput(stmt.body, node);
        nested = true;
      }
    }
    if (stmt instanceof core.Output) {
      hasOutput = true;
    }
  });
  check(
    hasOutput || nested,
    `AutoError: '${node.sourceString}' must have an output.`
  );
}

function checkAutoCallArgs(argsRep, auto, context, node) {
  check(
    auto.params.length === argsRep.length,
    `CallError: ${auto.params.length} argument(s) required, but ${argsRep.length} passed.`,
    node
  );
  auto.params.forEach((p, i) => {
    check(
      argsRep[i].type === p.type || p.type === Type.any,
      `CallError: Argument ${i + 1} (${
        argsRep[i].type.description
      }) must be of type: ${p.type.description}.`,
      node
    );
  });
}

function checkTypesMatch(fromType, toType, id, node) {
  check(
    fromType === toType,
    `AssignError: Variable '${id}' (${fromType.description}) cannot have a value of type ${toType.description}.`,
    node
  );
}

function checkHasBeenFound(entity, name, node) {
  check(
    entity,
    `ContextLookupError: Identifier '${name}' has not been declared`,
    node
  );
}

function isVar(sourceString, context) {
  if (context.localvars.has(sourceString)) {
    return true;
  } else if (context.parent !== null) {
    return isVar(sourceString, context.parent);
  } else {
    return false;
  }
}

function isAuto(sourceString, context) {
  if (context.localautos.has(sourceString)) {
    return true;
  } else if (context.parent !== null) {
    return isAuto(sourceString, context.parent);
  } else {
    return false;
  }
}

// function checkInteger(t, node) {
//   checkType(t, [Type.INT, Type.EXP, Type.any], `an integer value, got type '${t.description}'`, node)
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
  constructor({
    parent = null,
    localvars = new Map(),
    localautos = new Map(),
    inLoop = false,
    automation: a = null,
  }) {
    Object.assign(this, {
      parent,
      localvars,
      localautos,
      inLoop,
      automation: a,
    });
  }
  sees(name) {
    // Search "outward" through enclosing scopes
    return (
      this.localvars.has(name) ||
      this.localautos.has(name) ||
      this.parent?.sees(name)
    );
  }
  add(name, entity, node) {
    // No shadowing! Prevent addition if id anywhere in scope chain! This is
    // a T.O.A.L thing. Many other languages allow shadowing, and in these,
    // we would only have to check that name is not in this.locals
    if (entity instanceof core.Variable) {
      check(
        !this.sees(name),
        `ContextAddError: Identifier '${name}' has already been declared.`,
        node
      );
      this.localvars.set(name, entity);
    } else if (entity instanceof core.Automation) {
      check(
        !this.sees(name),
        `ContextAddError: Identifier '${name}' has already been declared.`,
        node
      );
      this.localautos.set(name, entity);
    }
  }
  lookup(name, node) {
    const locals = new Map([...this.localvars, ...this.localautos]);
    const entity = locals.get(name);
    if (entity) {
      return entity;
    } else if (this.parent) {
      return this.parent.lookup(name);
    }
    error(`ContextLookupError: Identifier '${name}' not declared.`, node);
  }
  newChildContext(props) {
    const c = new Context({
      ...this,
      ...props,
      parent: this,
      localvars: new Map(),
      localautos: new Map(),
    });
    return c;
  }
  isVarOrAuto(sourceString) {
    return isVar(sourceString, this) || isAuto(sourceString, this);
  }
  getRep(rawVal) {
    if (this.isVarOrAuto(rawVal.sourceString)) {
      return this.lookup(rawVal.sourceString);
    } else {
      return rawVal.rep();
    }
  }
}

export default function analyze(match) {
  let context = new Context({});

  const analyzer = match.matcher.grammar.createSemantics().addOperation("rep", {
    Program(body) {
      return new core.Program(body.rep());
    },
    Var(identifier) {
      return identifier.rep();
    },
    Statement_vardec(
      constant,
      _make,
      identifier,
      _with,
      initializer,
      _semicolon
    ) {
      const initRep = context.getRep(initializer);
      check(
        initRep.type,
        `AssignError: '${initializer.sourceString}' is not defined.`,
        initializer
      );
      check(
        initRep.type !== Type.none,
        `AssignError: Cannot assign a value with type 'none' to a variable.`,
        initializer
      );
      const id = identifier.sourceString;
      const readOnly = constant.sourceString === "constantly";
      const decVar = new core.Variable(id, readOnly, initRep.type);
      context.add(id, decVar, identifier);
      return new core.VariableDeclaration(decVar, initRep);
    },
    Statement_varass(_change, identifier, _to, value, _semicolon) {
      const id = identifier.sourceString;
      const valueRep = context.getRep(value);
      if (!valueRep?.type)
        error(`AssignError: '${value.sourceString}' is not defined.`, value);
      const assVar = context.lookup(identifier.sourceString, identifier);
      check(
        assVar instanceof core.Variable,
        `AssignError: Cannot assign value to automation '${id}'.`,
        identifier
      );
      checkNotReadOnly(assVar, identifier);
      checkTypesMatch(assVar.type, valueRep.type, id, value);
      context.localvars.set(id, assVar);
      return new core.Assignment(assVar, valueRep);
    },
    ChngVar1(op, term, _tofrom, target, _semicolon) {
      const targetRep = context.getRep(target);
      const termRep = context.getRep(term);
      const targetVariable = context.lookup(target.sourceString, target);
      check(
        targetVariable instanceof core.Variable,
        `AssignError: Cannot assign value to automation '${target.sourceString}'.`,
        target
      );
      const targetType = targetVariable.type;
      checkNumeric(targetType, target); //in test.toal 'add 5 to 5' confusing error
      checkNotReadOnly(targetVariable, target);
      checkNumeric(termRep.type, term); //grammar catches this before analyzer for non-vars
      switch (op.sourceString) {
        case "add":
          return new core.ChangeVariable("+", termRep, targetRep);
        case "subtract":
          return new core.ChangeVariable("-", termRep, targetRep);
      }
    },
    ChngVar0(op, target, _by, term, _semicolon) {
      const targetRep = context.getRep(target);
      const termRep = context.getRep(term);
      const targetVariable = context.lookup(target.sourceString, target);
      check(
        targetVariable instanceof core.Variable,
        `AssignError: Cannot assign value to automation '${target.sourceString}'.`,
        target
      );
      const targetType = targetVariable.type;
      checkNumeric(targetType, target); //in test.toal 'add 5 to 5' confusing error
      checkNotReadOnly(targetVariable, target);
      checkNumeric(termRep.type, term); //grammar catches this before analyzer for non-vars
      switch (op.sourceString) {
        case "multiply":
          return new core.ChangeVariable("*", termRep, targetRep);
        case "divide":
          return new core.ChangeVariable("/", termRep, targetRep);
        case "raise":
          return new core.ChangeVariable("^", termRep, targetRep);
        case "mod":
          return new core.ChangeVariable("%", termRep, targetRep);
      }
    },
    Statement_prnt(_print, argument, _semicolon) {
      const argRep = argument.rep();
      return new core.PrintStatement(argRep);
    },
    Param(type, _colon, identifier) {
      return new core.Param(
        identifier.sourceString,
        Type.fromName(type.sourceString)
      );
    },
    Statement_autodec(_auto, identifier, _open, params, _close, output, body) {
      const paramsRep = params.asIteration().rep();
      const id = identifier.sourceString;
      const outputType = Type.fromName(output.sourceString);
      check(
        outputType !== Type.any,
        `AutoError: Must specify automation output type (cannot be ANY).`,
        output
      );
      const auto = new core.Automation(id, paramsRep, outputType);
      // Add the automation to the context before analyzing the body, because
      // we want to allow automations to be recursive
      context.add(id, auto);
      context = context.newChildContext({
        automation: identifier.sourceString,
      });
      for (const p of paramsRep) {
        check(
          p.type !== Type.none,
          `AutoError: Type of parameter '${p.name}' cannot be NONE.`,
          params
        );
        context.add(p.name, new core.Variable(p.name, false, p.type), params);
      }
      const bodyRep = body.rep();
      if (auto.type === Type.none) {
      } else {
        checkHasOutput(bodyRep, identifier);
      }
      context = context.parent;
      return new core.AutomationDeclaration(
        id,
        auto,
        paramsRep,
        outputType,
        bodyRep
      );
    },
    Statement_callstmt(identifier, _open, args, _close, _semicolon) {
      const auto = context.lookup(identifier.sourceString, identifier);
      check(
        !(auto instanceof core.Variable),
        `CallError: Trying to call Variable '${identifier.sourceString}' as an Automation.`,
        identifier
      );
      const argsRep = args.asIteration().rep();
      checkAutoCallArgs(argsRep, auto, context, args);
      return new core.CallStatement(auto, argsRep);
    },
    CallExp(identifier, _open, args, _close) {
      const auto = context.lookup(identifier.sourceString, identifier);
      check(
        !(auto instanceof core.Variable),
        `CallError: Trying to call Variable '${identifier.sourceString}' as an Automation.`,
        identifier
      );
      const argsRep = args.asIteration().rep();
      checkAutoCallArgs(argsRep, auto, context, args);
      return new core.CallExpression(auto, argsRep);
    },
    Statement_output(_output, value, _semicolon) {
      let valueRep = context.getRep(value); // returns an array when value is not a variable
      if (valueRep.length === 0) {
        valueRep.type = Type.none;
      } else if (Array.isArray(valueRep)) {
        valueRep = valueRep[0];
      }
      checkInAutomation(context, _output);
      const auto = context.lookup(context.automation);
      if (value.rep().length === 0) {
        checkReturnsNothing(auto, value);
      } else {
        checkReturnsSomething(auto, value);
        check(
          valueRep.type === auto.type,
          `AutoError: Automation '${auto.name}' cannot output a value of type '${valueRep.type.description}' (must output '${auto.type.description}').`,
          value
        );
      }
      return new core.Output(value.rep(), valueRep.type);
    },
    Block(_open, body, _close) {
      return body.rep();
    },
    Statement_if(_if, condition, body, alternate) {
      const conditionRep = context.getRep(condition);
      checkBoolean(conditionRep.type, condition);
      return new core.IfStatement(condition.rep(), body.rep(), alternate.rep());
    },
    ElseStmt(_ifnot, body) {
      return new core.ElseStatement(body.rep());
    },
    Statement_while(_loop, _while, test, body) {
      const testRep = context.getRep(test);
      checkBoolean(testRep.type, test);
      context = context.newChildContext({ inLoop: true });
      const bodyRep = body.rep();
      context = context.parent;
      return new core.WhileLoop(testRep, bodyRep);
    },
    Statement_for(_loop, _over, tempVar, _in, list, body) {
      const tempRep = tempVar.rep();
      const listRep = context.getRep(list);
      // FIX LISTS
      checkList(listRep.type, list);
      context = context.newChildContext({ inLoop: true });
      context.add(
        tempRep,
        new core.Variable(tempVar.sourceString, false, Type.any),
        tempVar
      );
      const bodyRep = body.rep();
      context = context.parent;
      return new core.ForLoop(tempRep, listRep, bodyRep);
    },
    Statement_break(_break, _semicolon) {
      checkInLoop(context, _break);
      return new core.Break();
    },
    Exp0_parentheses(_open, expression, _close) {
      return new core.ParenthesesExpression(expression.rep());
    },
    Exp_expression(left, operator, right) {
      const leftRep = context.getRep(left);
      const rightRep = context.getRep(right);
      checkNumeric(rightRep.type, right);
      checkNumeric(leftRep.type, left);
      switch (operator.sourceString) {
        case "plus":
          return new core.Expression("+", leftRep, rightRep);
        case "minus":
          return new core.Expression("-", leftRep, rightRep);
        case "times":
          return new core.Expression("*", leftRep, rightRep);
        case "divided by":
          return new core.Expression("/", leftRep, rightRep);
        case "to the":
          return new core.Expression("^", leftRep, rightRep);
        case "mod":
          return new core.Expression("%", leftRep, rightRep);
      }
    },
    BoolExp(left, operator, right) {
      const leftRep = context.getRep(left);
      const rightRep = context.getRep(right);
      checkNumericOrString(leftRep.type, left);
      checkNumericOrString(rightRep.type, right);
      switch (operator.sourceString) {
        case "is greater than":
          return new core.BooleanExpression(">", leftRep, rightRep);
        case "is less than":
          return new core.BooleanExpression("<", leftRep, rightRep);
        case "is":
          return new core.BooleanExpression("===", leftRep, rightRep);
        case "is not":
          return new core.BooleanExpression("!=", leftRep, rightRep);
        case "is greater than or equal to":
          return new core.BooleanExpression(">=", leftRep, rightRep);
        case "is less than or equal to":
          return new core.BooleanExpression("<=", leftRep, rightRep);
      }
    },
    Var(id) {
      const entity = context.lookup(id.sourceString);
      checkHasBeenFound(entity, id.sourceString, { at: id });
      return entity;
    },
    true(_) {
      return true;
    },
    false(_) {
      return false;
    },
    id(chars) {
      return chars.sourceString;
    },
    numeral(_neg, _whole, _dot, _decimal) {
      return Number(this.sourceString);
    },
    strlit(_open, chars, _close) {
      return new core.StringLiteral(this.sourceString);
    },
    List(_open, elements, _close) {
      return new core.List(elements.asIteration().rep());
    },
    _iter(children) {
      return children.map((child) => child.rep());
    },
  });

  for (const [name, entity] of Object.entries(core.standardLibrary)) {
    context.localvars.set(name, entity);
  }
  return analyzer(match).rep();
}
