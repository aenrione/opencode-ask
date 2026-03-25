#!/usr/bin/env bun
import { mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { parseArgs, printHelp } from "./args.js";
import { getConfig } from "./config.js";
import { extractOneLine, extractText } from "./format.js";
import { createSession, health, message, promptAsync } from "./opencode.js";

async function runServer(host: string, port: number): Promise<number> {
  const proc = Bun.spawn(["opencode", "serve", "--hostname", host, "--port", String(port)], {
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

const DATA_DIR = `${process.env.HOME}/.local/share/opencode-ask`;
const PID_FILE = `${DATA_DIR}/server.pid`;

function runDaemon(host: string, port: number): void {
  const logPath = `${DATA_DIR}/server.log`;
  mkdirSync(DATA_DIR, { recursive: true });
  const fd = openSync(logPath, "a");
  const proc = Bun.spawn(["opencode", "serve", "--hostname", host, "--port", String(port)], {
    stdout: fd,
    stderr: fd,
    detached: true,
  });
  proc.unref();
  writeFileSync(PID_FILE, String(proc.pid));
  console.log(`opencode server started (pid ${proc.pid}), logging to ${logPath}`);
}

function stopDaemon(): void {
  let pid: number;
  try {
    pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
  } catch {
    console.error("no daemon pid file found — server may not be running");
    process.exit(1);
  }
  try {
    process.kill(pid, "SIGTERM");
    unlinkSync(PID_FILE);
    console.log(`opencode server stopped (pid ${pid})`);
  } catch {
    unlinkSync(PID_FILE);
    console.error(`could not signal pid ${pid} — process may have already exited`);
    process.exit(1);
  }
}

function newMessageId(): string {
  return `msg_cli_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function streamResponse(
  url: string,
  messageID: string,
  timeoutMs: number
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${url}/event`, {
    headers: { Accept: "text/event-stream" },
    signal: controller.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error("event stream not available");
  }

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
        try {
          evt = JSON.parse(payload);
        } catch {
          continue;
        }

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
              const delta = evt.properties?.delta || part.text || "";
              text += delta;
              process.stdout.write(delta);
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

async function renderMarkdown(text: string): Promise<void> {
  const glow = await Bun.which("glow");
  if (glow) {
    const proc = Bun.spawn([glow, "-"], {
      stdin: "pipe",
      stdout: "inherit",
      stderr: "inherit",
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
    await proc.exited;
    return;
  }

  const bat = await Bun.which("bat");
  if (bat) {
    const proc = Bun.spawn([bat, "-l", "markdown", "-p"], {
      stdin: "pipe",
      stdout: "inherit",
      stderr: "inherit",
    });
    proc.stdin?.write(text);
    proc.stdin?.end();
    await proc.exited;
    return;
  }

  process.stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
}

async function copyToClipboard(text: string): Promise<void> {
  const pbcopy = await Bun.which("pbcopy");
  if (!pbcopy) {
    throw new Error("pbcopy not found (clipboard copy failed)");
  }
  const proc = Bun.spawn([pbcopy], {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "ignore",
  });
  proc.stdin?.write(text);
  proc.stdin?.end();
  await proc.exited;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.serve) {
    const code = await runServer(getConfig().host, getConfig().port);
    process.exit(code);
  }
  if (args.stop) {
    stopDaemon();
    return;
  }
  if (args.daemon) {
    const config = getConfig();
    if (await health(config.url)) {
      console.log(`opencode server already running at ${config.url}`);
      return;
    }
    runDaemon(config.host, config.port);
    return;
  }
  if (!args.prompt) {
    printHelp();
    process.exit(1);
  }

  const config = getConfig();
  const timeoutMs = args.timeoutMs ?? config.timeoutMs;
  let systemPrompt = args.noSystem
    ? ""
    : args.systemPrompt ?? config.systemPrompt;

  if (args.oneLine) {
    const suffix = "Return a single command only. No prose, no code fences.";
    systemPrompt = systemPrompt ? `${systemPrompt}\n${suffix}` : suffix;
    args.stream = false;
    args.render = false;
  }

  if (!(await health(config.url))) {
    throw new Error("opencode server not running — run 'ask --daemon' to start it in the background, or 'ask --serve' for foreground");
  }

  const sessionID = await createSession(config.url, "cli-ask");
  if (args.stream) {
    const msgId = newMessageId();
    const streamPromise = streamResponse(config.url, msgId, timeoutMs);
    await promptAsync(config.url, sessionID, msgId, args.prompt, {
      url: config.url,
      model: args.model,
      system: systemPrompt,
    });
    const streamed = await streamPromise;
    if (args.renderFinal) {
      process.stdout.write("\n");
      await renderMarkdown(streamed);
    }
    if (args.copy) {
      await copyToClipboard(streamed);
    }
    return;
  }

  const res = await message(config.url, sessionID, args.prompt, {
    url: config.url,
    model: args.model,
    system: systemPrompt,
  });

  if (args.json) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  const text = extractText(res.parts ?? []);
  if (args.oneLine) {
    const one = extractOneLine(text);
    console.log(one);
    if (args.copy) {
      await copyToClipboard(one);
    }
    return;
  }

  if (!text) return;

  if (args.render && !args.oneLine) {
    await renderMarkdown(text);
    if (args.copy) {
      await copyToClipboard(text);
    }
    return;
  }

  console.log(text);
  if (args.copy) {
    await copyToClipboard(text);
  }
}

main().catch((err) => {
  console.error(String(err.message || err));
  process.exit(1);
});
