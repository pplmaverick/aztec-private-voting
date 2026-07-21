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
- **M3 in progress** (2026-07-21): PrivateVoting deployed to Alpha Mainnet, full e2e flow
  (create_poll/cast_vote/end_poll) passing — see DEPLOYMENT.md. Grant application still todo.

## Testnet deployment (v5.0.0)

- Contract address: `0x2264d5c685966bfb075173b9423293bfaaac2a27fd80f07547812515e789f7ed`
- Deploy tx hash: `0x0a2479f50526ce127cc774a1e3ff2f73f8f5db659859aa91202ebae3d11719ed`
- Admin wallet: `0x060dd7c748a4ee855001c456bbf4c76ed2ca2af6576baf03d61a8af2fc204987`
- Testnet RPC: `https://v5.testnet.rpc.aztec-labs.com`
- Sponsored FPC: `0x0628377e98bca5913dc86765ad0758f7b7aa83eac49079c6fba125807b393fe1`
- Full tx history: see DEPLOYMENT.md

## Mainnet status

- Alpha (mainnet) upgraded to **v5.0.1** on 2026-07-21 — AZUP-2 executed. Confirmed via
  official @aztecnetwork announcement ("Aztec Alpha V5 is live") and https://docs.aztec.network/networks
  (Alpha Mainnet and Testnet both show version `5.0.1`).
- Mainnet RPC: `https://aztec-mainnet.drpc.org` — verified genuine (its reported rollup version
  `4248422647` matches the official docs table exactly).
- **PrivateVoting is now deployed and fully working on mainnet** — see DEPLOYMENT.md's
  "Aztec Alpha Mainnet (M3)" section for contract address, deploy commands, and tx history.
- No sponsored FPC on mainnet (unlike testnet). Fee Juice on mainnet is the **$AZTEC token**
  itself (`0xa27ec0006e59f245217ff08cd52a7e8b169e62d2` on L1) — NOT ETH. Bridging requires
  actually holding $AZTEC on L1, not just ETH for gas.

## Known gotchas

- Noir comments must be ASCII only — em dashes and non-ASCII characters cause compile errors
- Noir package names cannot contain hyphens — use underscores
- macOS ships Bash 3.2 which is too old; aztec requires Bash 5 from Homebrew (`/opt/homebrew/bin/bash`)
- Use `curl -sL` to install, not `curl -s` — the `-L` flag is required to follow redirects
- **aztec.js v5.0.0**: `AztecAddress.fromString()` was removed — the unchecked constructor is now
  `AztecAddress.fromStringUnsafe()` (breaking rename, see v5.0.0 release notes). `Fr`/`GrumpkinScalar`
  still have a plain `.fromString()` — only `AztecAddress` got the `Unsafe` suffix.
- **aztec.js v5.0.0**: `wallet.getContractMetadata(address).instance` only reflects contracts the
  wallet already knows about locally — it does NOT fetch a fresh EmbeddedWallet's unknown contract
  from the node, even if it's live on-chain (`isContractPublished` is the field that tells you that).
  To reconnect to a contract deployed in a different session/CLI, reconstruct the instance with
  `getContractInstanceFromInstantiationParams(artifact, { constructorArtifact, constructorArgs, deployer, salt })`
  using the original deployment parameters, then `wallet.registerContract(instance, artifact)`.
- **aztec.js/wallets npm version must match the `aztec` CLI version exactly**, or account address
  derivation from raw secret/signing-key silently produces a *different* address (no error thrown).
  Caused a real debugging detour: e2e's `package.json` had `@aztec/aztec.js@^5.0.0` while the CLI
  had been upgraded to `5.0.1` — pin both to the exact same patch version.
- **`aztec-wallet` CLI 5.0.1's bundled `SchnorrAccount` has a stale reference to the v5.0.0-vintage
  `HandshakeRegistry` standard-contract address** baked into its compiled bytecode (a real bug in
  that CLI release, not our code). Any private function call fails with "the contract is not
  registered" at address `0x0193c31b...` until that specific HandshakeRegistry instance is deployed
  (permissionless, salt=1, universal, no-init) AND locally registered with a PXE
  `authorizeUtilityCall` hook authorizing it. See DEPLOYMENT.md mainnet section for the full fix —
  affects every mainnet account made with this CLI version, unrelated to this project's contract.

## Versions

- aztec CLI (local, `aztec-up`): 5.0.1 (matches live mainnet/testnet as of 2026-07-21)
- aztec-nr (contract dependency, Nargo.toml): v5.0.0 — deliberately unchanged; the deployed
  PrivateVoting contract works fine on the v5.0.1 network, no recompile needed
- e2e's `@aztec/aztec.js` / `@aztec/wallets` (package.json): pinned to 5.0.1 to match the CLI
- Noir: 1.0.0-beta.22
- Node.js: 24.12.0 (via nvm)
- Bash: 5.3.15 (via Homebrew)
