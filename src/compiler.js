import parse from "./parser.js";
import analyze from "./analyzer.js";
import optimize from "./optimizer.js";
import generate from "./generator.js";

export default function compile(source, outputType) {
  if (!["parsed", "analyzed", "optimized", "js"].includes(outputType)) {
    throw new Error(
      `Unknown output type: ${outputType} \nOutput types: "analyzed", "optimized", "js"`
    );
  }
  const parsed = parse(source);
  if (outputType === "parsed") return "Syntax ok";
  const analyzed = analyze(parsed);
  if (outputType === "analyzed") return analyzed;
  const optimized = optimize(analyzed);
  if (outputType === "optimized") return optimized;
  return generate(optimized);
}
