export type CliArgs = {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  noSystem: boolean;
  oneLine: boolean;
  json: boolean;
  serve: boolean;
  daemon: boolean;
  stream: boolean;
  render: boolean;
  renderFinal: boolean;
  copy: boolean;
  timeoutMs?: number;
  help: boolean;
};

export function parseArgs(argv: string[]): CliArgs {
  let prompt = "";
  let model: string | undefined;
  let systemPrompt: string | undefined;
  let noSystem = false;
  let oneLine = false;
  let json = false;
  let serve = false;
  let daemon = false;
  let stream = true;
  let render = true;
  let renderFinal = false;
  let copy = false;
  let timeoutMs: number | undefined;
  let help = false;

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) break;

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }
    if (arg === "-m" || arg === "--model") {
      model = args.shift();
      continue;
    }
    if (arg.startsWith("--model=")) {
      model = arg.slice("--model=".length);
      continue;
    }
    if (arg === "-p" || arg === "--prompt") {
      systemPrompt = args.shift();
      continue;
    }
    if (arg.startsWith("--prompt=")) {
      systemPrompt = arg.slice("--prompt=".length);
      continue;
    }
    if (arg === "--no-system") {
      noSystem = true;
      continue;
    }
    if (arg === "-1" || arg === "--one-line") {
      oneLine = true;
      continue;
    }
    if (arg === "-c" || arg === "--copy") {
      copy = true;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--no-render") {
      render = false;
      continue;
    }
    if (arg === "--render-final") {
      renderFinal = true;
      continue;
    }
    if (arg === "--no-render-final") {
      renderFinal = false;
      continue;
    }
    if (arg === "--serve") {
      serve = true;
      continue;
    }
    if (arg === "-d" || arg === "--daemon") {
      daemon = true;
      continue;
    }
    if (arg === "-s" || arg === "--stream") {
      stream = true;
      continue;
    }
    if (arg === "-S" || arg === "--full") {
      stream = false;
      continue;
    }
    if (arg === "-T" || arg === "--timeout") {
      const v = args.shift();
      if (v) timeoutMs = Number(v) * 1000;
      continue;
    }
    if (arg.startsWith("--timeout=")) {
      const v = arg.slice("--timeout=".length);
      timeoutMs = Number(v) * 1000;
      continue;
    }

    prompt = prompt ? `${prompt} ${arg}` : arg;
  }

  return {
    prompt: prompt.trim(),
    model,
    systemPrompt,
    noSystem,
    oneLine,
    json,
    serve,
    daemon,
    stream,
    render,
    renderFinal,
    copy,
    timeoutMs,
    help,
  };
}

export function printHelp(): void {
  console.log(`ask - OpenCode CLI helper

Usage:
  ask [options] <prompt>

Options:
  -h, --help                 Show help
  -m, --model <id>           provider:model or provider/model
  -p, --prompt <text>        Override system prompt
      --no-system            Disable system prompt
  -1, --one-line             Return a single-line answer (command)
  -s, --stream               Stream response text (default)
  -S, --full                 Wait for full answer (no streaming)
  --no-render                Disable markdown rendering
  --render-final             Render full response with markdown after streaming
  -c, --copy                 Copy response to clipboard
      --json                 Print raw JSON response
      --serve                Run opencode serve and exit
  -d, --daemon               Start opencode server in the background
  -T, --timeout <seconds>    Response timeout in seconds (default 8)

Examples:
  ask "list directories"
  ask -1 "list directories only"
  ask -m anthropic/claude-3-5-haiku-latest "explain git reset"
`);
}
