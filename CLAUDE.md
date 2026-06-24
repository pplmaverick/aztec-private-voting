# Aztec Private Voting — Dev Notes

## Session setup (required every time)

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
export PATH="/opt/homebrew/bin:$HOME/.aztec/current/bin:$HOME/.aztec/current/node_modules/.bin:$HOME/.aztec/bin:$PATH"
```

## Run tests (no sandbox needed)

```bash
cd ~/aztec-private-voting && aztec test
```

## Start local network (only needed for M2 deployment)

```bash
aztec start --local-network
# Wait for "Aztec Server listening on port 8080"
```

## Milestones

- **M1 done** (2026-06-24): Noir contract + 11/11 tests passing, pushed to GitHub
- **M2 todo**: TypeScript e2e script + deploy to Aztec testnet (after V5 goes live)
- **M3 todo**: Grant application + mainnet deployment

## Known gotchas

- Noir comments must be ASCII only — em dashes and non-ASCII characters cause compile errors
- Noir package names cannot contain hyphens — use underscores
- macOS ships Bash 3.2 which is too old; aztec requires Bash 5 from Homebrew (`/opt/homebrew/bin/bash`)
- Use `curl -sL` to install, not `curl -s` — the `-L` flag is required to follow redirects

## Versions

- aztec: 4.3.1
- Noir: 1.0.0-beta.21
- Node.js: 24.12.0 (via nvm)
- Bash: 5.3.15 (via Homebrew)
