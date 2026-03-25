import { describe, expect, it } from "bun:test";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("defaults to streaming, rendering, renderFinal off", () => {
    const args = parseArgs(["hello"]);
    expect(args.stream).toBe(true);
    expect(args.render).toBe(true);
    expect(args.renderFinal).toBe(false);
  });

  it("parses model and prompt", () => {
    const args = parseArgs(["-m", "anthropic/claude-3-5-haiku-latest", "hello", "world"]);
    expect(args.model).toBe("anthropic/claude-3-5-haiku-latest");
    expect(args.prompt).toBe("hello world");
  });

  it("--one-line sets oneLine flag", () => {
    const args = parseArgs(["-1", "list dirs"]);
    expect(args.oneLine).toBe(true);
    expect(args.prompt).toBe("list dirs");
    // stream/render are mutated in main(), not in parseArgs
  });

  it("parses render flags", () => {
    const args = parseArgs(["--no-render", "--render-final", "ping"]);
    expect(args.render).toBe(false);
    expect(args.renderFinal).toBe(true);
  });

  it("parses copy and timeout", () => {
    const args = parseArgs(["-c", "-T", "5", "ping"]);
    expect(args.copy).toBe(true);
    expect(args.timeoutMs).toBe(5000);
  });

  it("parses --daemon and --stop", () => {
    expect(parseArgs(["--daemon"]).daemon).toBe(true);
    expect(parseArgs(["-d"]).daemon).toBe(true);
    expect(parseArgs(["--stop"]).stop).toBe(true);
  });

  it("--daemon and --stop default to false", () => {
    const args = parseArgs(["hello"]);
    expect(args.daemon).toBe(false);
    expect(args.stop).toBe(false);
  });

  it("parses --model= inline form", () => {
    const args = parseArgs(["--model=openai/gpt-4o", "hi"]);
    expect(args.model).toBe("openai/gpt-4o");
  });

  it("parses --timeout= inline form", () => {
    const args = parseArgs(["--timeout=10", "hi"]);
    expect(args.timeoutMs).toBe(10000);
  });

  it("--full disables streaming", () => {
    const args = parseArgs(["-S", "hi"]);
    expect(args.stream).toBe(false);
  });

  it("--no-system sets noSystem", () => {
    const args = parseArgs(["--no-system", "hi"]);
    expect(args.noSystem).toBe(true);
  });

  it("--json sets json flag", () => {
    const args = parseArgs(["--json", "hi"]);
    expect(args.json).toBe(true);
  });
});
