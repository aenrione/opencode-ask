import { describe, expect, it } from "bun:test";
import { extractOneLine, parseModel } from "../src/format.js";

describe("parseModel", () => {
  it("parses provider:model", () => {
    expect(parseModel("anthropic:claude")).toEqual({
      providerID: "anthropic",
      modelID: "claude",
    });
  });

  it("parses provider/model", () => {
    expect(parseModel("openai/gpt-5.1")).toEqual({
      providerID: "openai",
      modelID: "gpt-5.1",
    });
  });
});

describe("extractOneLine", () => {
  it("returns first fenced line", () => {
    const text = "```bash\nls -d */\n```\n";
    expect(extractOneLine(text)).toBe("ls -d */");
  });

  it("returns first non-empty line", () => {
    const text = "\n\nUse find:\nfind . -type d\n";
    expect(extractOneLine(text)).toBe("Use find:");
  });

  it("strips backticks from inline code", () => {
    const text = "`ls -d */`";
    expect(extractOneLine(text)).toBe("ls -d */");
  });

  it("prefers fenced content over prose", () => {
    const text = "Use this:\n```\nfind . -type d\n```";
    expect(extractOneLine(text)).toBe("find . -type d");
  });
});
