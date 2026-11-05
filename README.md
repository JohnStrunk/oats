# OATS — OpenCode Agent Token Stats

OATS is an OpenCode V2 TUI plugin that helps explain token usage and costs
across agents, subagents, and models. A brief **OATS loaded** toast confirms
startup.

## What OATS shows

- **Agent stats** summarizes OpenCode-reported costs by recorded agent name for
  the displayed session and its descendants.
- **Model stats** groups reported costs by recorded model ID across providers
  and agents.
- **Usage details** shows token categories and estimates based on current model
  prices alongside reported costs.
- The sidebar follows session changes and settled usage.

The sidebar shows reported costs; current-price estimates appear in the usage
details. These figures are informational, not billing guarantees. See the
[usage guide](docs/usage.md) and [data and cost details](docs/data-and-costs.md)
for behavior and limitations.

## Install

Add `git+https://github.com/JohnStrunk/oats.git#main` to the `plugins` array in
the global OpenCode V2 CLI config: `~/.config/opencode/cli.json`, or
`$XDG_CONFIG_HOME/opencode/cli.json` when `XDG_CONFIG_HOME` is set. Preserve
existing settings and plugin entries.
The `#main` ref follows the repository's main branch; it does not pin a specific
commit.

OATS is TUI-only and belongs in the global CLI `cli.json`, not `opencode.json`;
there is no project-local `cli.json`. See the official [CLI settings
documentation](https://opencode.ai/v2/docs/cli/config) for the config location
and [V2 CLI plugin documentation](https://opencode.ai/v2/docs/cli/plugins) for
plugin configuration.

Example `cli.json`:

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    "git+https://github.com/JohnStrunk/oats.git#main"
  ]
}
```

## Documentation

### User docs

- [Usage guide](docs/usage.md)
- [Data and cost details](docs/data-and-costs.md)

### Contributor docs

- [Development guide](docs/development.md)
- [Testing and CI](docs/testing-ci.md)
- [Supported OpenCode host version](docs/testing-ci.md#opencode-host); see the
  [host manifest](.github/tooling/opencode-host/package.json) for the pin.
- Project specifications: [Vision](Vision.md), [Architecture](Architecture.md),
  and [feature specifications](features/).
