import { parseModel } from "./format.js";

export type AskOptions = {
  url: string;
  system?: string;
  model?: string;
};

type MessageResponse = {
  info?: Record<string, unknown>;
  parts?: Array<Record<string, unknown>>;
};

export async function createSession(url: string, title: string): Promise<string> {
  const res = await fetch(`${url}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`session create failed: ${res.status}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("session create missing id");
  return data.id;
}

export async function message(
  url: string,
  sessionID: string,
  prompt: string,
  opts: AskOptions
): Promise<MessageResponse> {
  const model = parseModel(opts.model);
  const payload: Record<string, unknown> = {
    parts: [{ type: "text", text: prompt }],
  };
  if (opts.system) payload.system = opts.system;
  if (model) payload.model = model;

  const res = await fetch(`${url}/session/${sessionID}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`message failed: ${res.status} ${text}`);
  }

  const text = await res.text();
  if (!text) return {};
  return JSON.parse(text) as MessageResponse;
}

export async function promptAsync(
  url: string,
  sessionID: string,
  messageID: string,
  prompt: string,
  opts: AskOptions
): Promise<void> {
  const model = parseModel(opts.model);
  const payload: Record<string, unknown> = {
    messageID,
    parts: [{ type: "text", text: prompt }],
  };
  if (opts.system) payload.system = opts.system;
  if (model) payload.model = model;

  const res = await fetch(`${url}/session/${sessionID}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`prompt_async failed: ${res.status} ${text}`);
  }
}

export async function health(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/global/health`);
    return res.ok;
  } catch {
    return false;
  }
}
