# opencode-ask

A lightweight CLI for querying a running [opencode](https://opencode.ai) server from your terminal. Stream responses, get single-line commands, copy to clipboard, and pipe into scripts.

## Requirements

- [opencode](https://opencode.ai) running as a server (`opencode serve`)
- [Bun](https://bun.sh) v1.0+

## Installation

```sh
git clone https://github.com/aenrione/opencode-ask
cd opencode-ask
bun install
```

Add the `ask` binary to your PATH by symlinking it:

```sh
ln -s "$(pwd)/bin/ask" ~/.local/bin/ask
```

Make sure `~/.local/bin` is in your `$PATH`. Alternatively use any directory already on your PATH:

```sh
ln -s "$(pwd)/bin/ask" /usr/local/bin/ask
```

## Usage

```
ask [options] <prompt>
```

opencode must be running as a server before you use `ask`. Start it as a background daemon:

```sh
ask --daemon
```

This starts `opencode serve` detached from your terminal and logs output to `~/.local/share/opencode-ask/server.log`. You only need to do this once per session (or add it to your shell's startup file).

To run it in the foreground instead:

```sh
ask --serve
```

Then query it from any terminal:

```sh
ask "how do I reverse a string in Python?"
ask -1 "git command to undo last commit"
ask -m anthropic/claude-3-5-haiku-latest "explain what a monad is"
```

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help |
| `--model <id>` | `-m` | Model to use (`provider/model` or `provider:model`) |
| `--prompt <text>` | `-p` | Override the system prompt |
| `--no-system` | | Disable the system prompt entirely |
| `--one-line` | `-1` | Return a single command only — no prose, no fences |
| `--stream` | `-s` | Stream the response as it arrives (default) |
| `--full` | `-S` | Wait for the full response before printing |
| `--no-render` | | Disable markdown rendering |
| `--render-final` | | Render markdown after streaming completes |
| `--no-render-final` | | Disable final render after streaming |
| `--copy` | `-c` | Copy the response to the clipboard |
| `--json` | | Print the raw JSON response |
| `--serve` | | Start `opencode serve` in the foreground |
| `--daemon` | `-d` | Start `opencode serve` detached in the background |
| `--timeout <s>` | `-T` | Response timeout in seconds (default: 8) |

## Examples

```sh
# Plain question, streamed with markdown rendering
ask "what is the difference between tcp and udp"

# Get a shell command directly (no explanation)
ask -1 "compress a folder with tar"

# Use a specific model
ask -m openai/gpt-4o "review this code for security issues"

# Pipe output somewhere
ask --no-render "list 5 git aliases I should have" | pbcopy

# Disable the system prompt for raw output
ask --no-system "translate 'hello world' to Spanish"
```

## Configuration

All settings can be overridden with environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_SERVER_HOST` | `127.0.0.1` | Host where opencode is running |
| `OPENCODE_SERVER_PORT` | `4096` | Port opencode is listening on |
| `OPENCODE_SERVER_TIMEOUT_MS` | `8000` | Response timeout in milliseconds |
| `OPENCODE_ASK_SYSTEM` | *(built-in)* | Override the default system prompt |

The default system prompt instructs the model to be concise and not narrate tool use — suitable for interactive CLI use.

## Markdown Rendering

By default, responses are rendered with [glow](https://github.com/charmbracelet/glow) if available, then [bat](https://github.com/sharkdp/bat) as a fallback, then plain text. Install either for a nicer experience:

```sh
brew install glow   # recommended
brew install bat    # fallback
```

## Development

```sh
bun run dev -- "your prompt here"   # run without building
bun test                             # run tests
bun run build                        # compile to dist/
```

## License

MIT
