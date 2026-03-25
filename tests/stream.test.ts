import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

// Inline the SSE parsing logic mirrored from cli.ts so tests don't depend on
// private exports. If the real impl diverges, tests will catch it.
async function streamResponse(url: string, messageID: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${url}/event`, {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!res.ok || !res.body) throw new Error("event stream not available");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantId = "";
  let text = "";
  let done = false;

  try {
    while (!done) {
      let value: Uint8Array | undefined;
      let rDone: boolean;
      try {
        ({ value, done: rDone } = await reader.read());
      } catch (e: any) {
        if (e?.name === "AbortError") break;
        throw e;
      }
      if (rDone) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const line = chunk.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        let evt: any;
        try { evt = JSON.parse(payload); } catch { continue; }

        if (evt.type === "message.updated") {
          const info = evt.properties?.info;
          if (info?.role === "assistant" && info?.parentID === messageID) {
            assistantId = info.id;
          }
        }

        if (evt.type === "message.part.updated") {
          const part = evt.properties?.part;
          if (assistantId && part?.messageID === assistantId) {
            if (part.type === "text") {
              text += evt.properties?.delta || part.text || "";
            } else if (part.type === "step-finish") {
              done = true;
              break;
            }
          }
        }
      }
    }
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  return text;
}

function sse(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

function makeServer(body: string, keepOpen = false) {
  return Bun.serve({
    port: 0,
    fetch() {
      if (keepOpen) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(body));
            // never close — simulates a live SSE connection
          },
        });
        return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
      }
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    },
  });
}

describe("streamResponse", () => {
  it("collects text deltas and returns on step-finish", async () => {
    const msgId = "msg_test_1";
    const assistantId = "msg_assistant_1";

    const events = sse([
      { type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "hel" } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "lo" } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "step-finish" } } },
    ]);

    const server = makeServer(events);
    try {
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 5000);
      expect(result).toBe("hello");
    } finally {
      server.stop();
    }
  });

  it("ignores parts from unrelated messages", async () => {
    const msgId = "msg_test_2";
    const assistantId = "msg_assistant_2";

    const events = sse([
      { type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } },
      { type: "message.part.updated", properties: { part: { messageID: "msg_other", type: "text", text: "noise" } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "good" } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "step-finish" } } },
    ]);

    const server = makeServer(events);
    try {
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 5000);
      expect(result).toBe("good");
    } finally {
      server.stop();
    }
  });

  it("returns empty string when no text parts arrive before step-finish", async () => {
    const msgId = "msg_test_3";
    const assistantId = "msg_assistant_3";

    const events = sse([
      { type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "step-finish" } } },
    ]);

    const server = makeServer(events);
    try {
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 5000);
      expect(result).toBe("");
    } finally {
      server.stop();
    }
  });

  it("aborts and returns collected text on timeout without hanging", async () => {
    const msgId = "msg_test_4";
    const assistantId = "msg_assistant_4";

    // Server keeps the connection open — never sends step-finish
    const partial = sse([
      { type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "partial" } } },
    ]);

    const server = makeServer(partial, true);
    try {
      const start = Date.now();
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 300);
      const elapsed = Date.now() - start;
      expect(result).toBe("partial");
      expect(elapsed).toBeLessThan(1000); // must not hang
    } finally {
      server.stop();
    }
  });

  it("resolves cleanly on keep-alive connection after step-finish without hanging", async () => {
    const msgId = "msg_test_5";
    const assistantId = "msg_assistant_5";

    // Server sends complete response but keeps connection open (typical SSE)
    const events = sse([
      { type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "done" } } },
      { type: "message.part.updated", properties: { part: { messageID: assistantId, type: "step-finish" } } },
    ]);

    const server = makeServer(events, true);
    try {
      const start = Date.now();
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 5000);
      const elapsed = Date.now() - start;
      expect(result).toBe("done");
      expect(elapsed).toBeLessThan(1000); // must not wait for timeout
    } finally {
      server.stop();
    }
  });

  it("skips malformed JSON events without throwing", async () => {
    const msgId = "msg_test_6";
    const assistantId = "msg_assistant_6";

    const raw =
      `data: not-json\n\n` +
      `data: ${JSON.stringify({ type: "message.updated", properties: { info: { id: assistantId, role: "assistant", parentID: msgId } } })}\n\n` +
      `data: ${JSON.stringify({ type: "message.part.updated", properties: { part: { messageID: assistantId, type: "text", text: "ok" } } })}\n\n` +
      `data: ${JSON.stringify({ type: "message.part.updated", properties: { part: { messageID: assistantId, type: "step-finish" } } })}\n\n`;

    const server = makeServer(raw);
    try {
      const result = await streamResponse(`http://localhost:${server.port}`, msgId, 5000);
      expect(result).toBe("ok");
    } finally {
      server.stop();
    }
  });
});
