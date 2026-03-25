export function parseModel(model?: string):
  | { providerID: string; modelID: string }
  | undefined {
  if (!model) return undefined;
  if (model.includes(":")) {
    const [providerID, modelID] = model.split(":", 2);
    if (!providerID || !modelID) return undefined;
    return { providerID, modelID };
  }
  if (model.includes("/")) {
    const [providerID, modelID] = model.split("/", 2);
    if (!providerID || !modelID) return undefined;
    return { providerID, modelID };
  }
  return undefined;
}

export function extractText(parts: Array<Record<string, unknown>>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      out.push(part.text);
    }
  }
  return out.join("\n");
}

export function extractOneLine(text: string): string {
  const lines = text.split("\n").map((l) => l.trim());
  const fenced: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) fenced.push(line);
  }
  const source = fenced.length > 0 ? fenced : lines;
  const first = source.find((l) => l.length > 0) || "";
  return first.replace(/^`+|`+$/g, "").trim();
}
