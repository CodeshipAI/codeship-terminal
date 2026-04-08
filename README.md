# codeship-terminal

Codeship CLI Terminal - manage projects, epics, and MCP configs from the command line.

Run with: `ship`

## Authentication

### OAuth Browser Flow

```bash
ship auth login    # Opens browser for OAuth authentication
ship auth status   # Show current auth status and token source
ship auth logout   # Clear stored credentials
```

### API Token via Environment Variable

You can authenticate using an API token by setting the `CODESHIP_TOKEN` environment variable:

```bash
export CODESHIP_TOKEN=cs_your_api_token_here
```

When `CODESHIP_TOKEN` is set:

- It takes priority over any token stored in the config file
- `ship auth login` will skip the OAuth flow and inform you the env var is active
- `ship auth status` shows the token source (env var vs config file)
- `ship auth logout` cannot clear the env var — use `unset CODESHIP_TOKEN` instead
- All API calls automatically use the env var token

### Environment Variables

| Variable | Description |
|---|---|
| `CODESHIP_TOKEN` | API token for authentication (takes priority over config file) |
| `CODESHIP_API_URL` | Override the API base URL (default: `https://api.codeship.ai`) |
| `CODESHIP_CONFIG_FILE` | Override the config file path (default: `~/.codeship/config.json`) |
