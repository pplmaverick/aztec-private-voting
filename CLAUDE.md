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
- **M2 done** (2026-07-16): Upgraded to Aztec v5.0.0, deployed PrivateVoting to testnet — see DEPLOYMENT.md
- **M3 todo**: Grant application + mainnet deployment (blocked on AZUP-2 governance upgrade — see Mainnet status below)

## Testnet deployment (v5.0.0)

- Contract address: `0x2264d5c685966bfb075173b9423293bfaaac2a27fd80f07547812515e789f7ed`
- Deploy tx hash: `0x0a2479f50526ce127cc774a1e3ff2f73f8f5db659859aa91202ebae3d11719ed`
- Admin wallet: `0x060dd7c748a4ee855001c456bbf4c76ed2ca2af6576baf03d61a8af2fc204987`
- Testnet RPC: `https://v5.testnet.rpc.aztec-labs.com`
- Sponsored FPC: `0x0628377e98bca5913dc86765ad0758f7b7aa83eac49079c6fba125807b393fe1`
- Full tx history: see DEPLOYMENT.md

## Mainnet status

- Alpha (mainnet) is still on **v4.3.1** as of 2026-07-16 (confirmed live at https://docs.aztec.network/networks)
- v5.0.0 needs the AZUP-2 governance proposal to pass and execute before it's usable on mainnet
- Mainnet governance timeline: 3-day voting delay + 7-day voting duration + 30-day execution delay (~40 days end to end)
- Estimated activation: mid-to-late August 2026 — **this is a rough estimate from the governance timeline, not a confirmed date**; re-check the Networks page before assuming mainnet is upgraded

## Known gotchas

- Noir comments must be ASCII only — em dashes and non-ASCII characters cause compile errors
- Noir package names cannot contain hyphens — use underscores
- macOS ships Bash 3.2 which is too old; aztec requires Bash 5 from Homebrew (`/opt/homebrew/bin/bash`)
- Use `curl -sL` to install, not `curl -s` — the `-L` flag is required to follow redirects

## Versions

- aztec: 5.0.0
- aztec-nr: v5.0.0
- Noir: 1.0.0-beta.22
- Node.js: 24.12.0 (via nvm)
- Bash: 5.3.15 (via Homebrew)
