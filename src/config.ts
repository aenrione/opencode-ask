export type Config = {
  host: string;
  port: number;
  url: string;
  timeoutMs: number;
  systemPrompt: string;
};

const defaultSystemPrompt =
  "You are a concise CLI assistant. Answer directly. Do not claim to run commands. Provide commands only when explicitly asked. Avoid tool narration.";

export function getConfig(): Config {
  const host = process.env.OPENCODE_SERVER_HOST || "127.0.0.1";
  const port = Number(process.env.OPENCODE_SERVER_PORT || 4096);
  const url = `http://${host}:${port}`;
  const timeoutMs = Number(process.env.OPENCODE_SERVER_TIMEOUT_MS || 8000);
  const systemPrompt = process.env.OPENCODE_ASK_SYSTEM || defaultSystemPrompt;

  return { host, port, url, timeoutMs, systemPrompt };
}
