import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("defaults to streaming and rendering", () => {
    const args = parseArgs(["hello"]);
    expect(args.stream).toBe(true);
    expect(args.render).toBe(true);
    expect(args.renderFinal).toBe(true);
  });

  it("parses model and prompt", () => {
    const args = parseArgs(["-m", "anthropic/claude-3-5-haiku-latest", "hello", "world"]);
    expect(args.model).toBe("anthropic/claude-3-5-haiku-latest");
    expect(args.prompt).toBe("hello world");
  });

  it("parses one-line and full", () => {
    const args = parseArgs(["-1", "-S", "list", "dirs"]);
    expect(args.oneLine).toBe(true);
    expect(args.stream).toBe(false);
    expect(args.prompt).toBe("list dirs");
  });

  it("parses render flags", () => {
    const args = parseArgs(["--no-render", "--no-render-final", "ping"]);
    expect(args.render).toBe(false);
    expect(args.renderFinal).toBe(false);
  });

  it("parses copy and timeout", () => {
    const args = parseArgs(["-c", "-T", "5", "ping"]);
    expect(args.copy).toBe(true);
    expect(args.timeoutMs).toBe(5000);
  });
});
