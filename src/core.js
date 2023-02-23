import util from "util";

export class Program {
  constructor(statements) {
    this.statements = statements;
  }
}

export class Variable {
  constructor(name, readOnly) {
    Object.assign(this, { name, readOnly })
  }
}

export class VariableDeclaration {
  constructor(variable, initializer) {
    Object.assign(this, { variable, initializer })
  }
}

export class Assignment {
  constructor(target, source) {
    Object.assign(this, { target, source })
  }
}

export class PrintStatement {
  constructor(argument) {
    this.argument = argument
  }
}

export class Expression {
  constructor(op, left, right) {
    Object.assign(this, { op, left, right })
  }
}

export class BooleanExpression {
  constructor(op, left, right) {
    Object.assign(this, { op, left, right })
  }
}

export class UnaryExpression {
  constructor(op, operand) {
    Object.assign(this, { op, operand })
  }
}

export class ChangeVariable {
  constructor(op, term, target) {
    Object.assign(this, { op, term, target })
  }
}

export class Automation {
  constructor(name, paramCount) {
    Object.assign(this, { name, paramCount })
  }
}

export class AutomationDeclaration {
  constructor(fun, params, body) {
    Object.assign(this, { fun, params, body })
  }
}

export class CallStatement {
  constructor(callee, args) {
    Object.assign(this, { callee, args })
  }
}

export class CallExpression {
  constructor(callee, args) {
    Object.assign(this, { callee, args })
  }
}

export class Output {
  constructor(term) {
    this.term = term
  }
}

export class IfStatement {
  constructor(test, consequent) {
    Object.assign(this, { test, consequent })
  }
}

export class WhileLoop {
  constructor(test, body) {
    Object.assign(this, { test, body })
  }
}

export class ForLoop {
  constructor(tempVar, list, body) {
    Object.assign(this, { tempVar, list, body })
  }
}

export class Break {
  constructor(loop) {
    this.loop = loop
  }
}

export class StringLiteral {
  constructor(contents) {
    this.contents = contents
  }
}

export const standardLibrary = Object.freeze({
  e: new Variable("e", true),
  append: new Automation("append", 2),
  remove: new Automation("remove", 2),
  typeOf: new Automation("typeOf", 1),
});

// Return a compact and pretty string representation of the node graph,
// taking care of cycles. Written here from scratch because the built-in
// inspect function, while nice, isn't nice enough. Defined properly in
// the root class prototype so that it automatically runs on console.log.
Program.prototype[util.inspect.custom] = function () {
  const tags = new Map();

  // Attach a unique integer tag to every node
  function tag(node) {
    if (tags.has(node) || typeof node !== "object" || node === null) return;
    tags.set(node, tags.size + 1);
    for (const child of Object.values(node)) {
      Array.isArray(child) ? child.forEach(tag) : tag(child);
    }
  }

  function* lines() {
    function view(e) {
      if (tags.has(e)) return `#${tags.get(e)}`;
      if (Array.isArray(e)) return `[${e.map(view)}]`;
      return util.inspect(e);
    }
    for (let [node, id] of [...tags.entries()].sort((a, b) => a[1] - b[1])) {
      // console.log(node.constructor)
      let type = node.constructor.name;
      let props = Object.entries(node).map(([k, v]) => `${k}=${view(v)}`);
      yield `${String(id).padStart(4, " ")} | ${type} ${props.join(" ")}`;
    }
  }

  tag(this);
  return [...lines()].join("\n");
};