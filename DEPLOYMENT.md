# Deployment Record

## Aztec Testnet

| Field | Value |
|---|---|
| Network | Aztec Testnet |
| CLI Version | aztec 5.0.0 |
| aztec-nr Version | v5.0.0 |
| Noir Version | 1.0.0-beta.22 |
| Deployed | 2026-07-16 |
| Node URL | https://v5.testnet.rpc.aztec-labs.com |
| Contract Address | 0x2264d5c685966bfb075173b9423293bfaaac2a27fd80f07547812515e789f7ed |
| Admin / Deployer | 0x060dd7c748a4ee855001c456bbf4c76ed2ca2af6576baf03d61a8af2fc204987 |
| Sponsored FPC | 0x0628377e98bca5913dc86765ad0758f7b7aa83eac49079c6fba125807b393fe1 |

## Deploy Commands

```bash
export NODE_URL=https://v5.testnet.rpc.aztec-labs.com
export SPONSORED_FPC=0x0628377e98bca5913dc86765ad0758f7b7aa83eac49079c6fba125807b393fe1

# Register the Sponsored FPC locally (required before it can be used as a payment method)
aztec-wallet register-contract \
  --node-url $NODE_URL \
  --alias sponsoredfpc \
  $SPONSORED_FPC SponsoredFPC \
  --salt 0

# Create and deploy the admin account, fees paid by the Sponsored FPC
aztec-wallet create-account \
  --node-url $NODE_URL \
  --alias dev-wallet \
  --payment method=fpc-sponsored,fpc=$SPONSORED_FPC

# Deploy the PrivateVoting contract, admin = dev-wallet
aztec-wallet deploy \
  --node-url $NODE_URL \
  --from accounts:dev-wallet \
  --payment method=fpc-sponsored,fpc=$SPONSORED_FPC \
  --alias private_voting \
  target/private_voting_contract-PrivateVoting.json \
  --args accounts:dev-wallet
```

## Transaction History

### 2026-07-16 — M2 testnet deployment

| Operation | Tx Hash |
|---|---|
| create-account (dev-wallet) | 0x06f31da23714949952a3bab8c5ef75bae86d6eeb2ce7e0f96db408060a660309 |
| deploy PrivateVoting | 0x0a2479f50526ce127cc774a1e3ff2f73f8f5db659859aa91202ebae3d11719ed |

## E2E Test Results

### 2026-07-16 — full flow via `e2e/src/e2e.ts` (aztec.js EmbeddedWallet)

| Operation | Tx Hash | Block |
|---|---|---|
| create_poll({id:1}) | 0x1dfe07b04634457d6481f1a94c43d411ea93ab5b339eb96a0a7a98d3232f60d7 | 3196 |
| cast_vote({id:1}, 1) — YES, dev-wallet | 0x220a0dd669c017574d238ace9c030fb3473ad6f66e01f4e980844a618b6e74e0 | 3197 |
| cast_vote({id:1}, 0) — NO, second voter | 0x2274b12367a7ecf783457efe5a46488fa3742eb601ee8e7decf2611353a896da | 3198 |
| end_poll({id:1}) | 0x17bf2c953119ed60fb548d618210236e8e501b5a9686b76b9c68adde9d4372ec | 3199 |

**Second voter** (initializerless account, no deployment tx): `0x004d8858d56236b7c3b8d569d072079c9157b2a4ad117909c22afbeac1230829`

| Query | Result |
|---|---|
| get_vote_count({id:1}, 1) — YES | 1 |
| get_vote_count({id:1}, 0) — NO | 1 |
| is_poll_ended({id:1}) | true |

## Contract Verification

Source verification attempted on Aztecscan but timed out due to
aztec-packages monorepo clone size (~12k files). Known infrastructure
limitation, not a code issue. Re-attempt after Aztecscan improves
compilation worker capacity.

## Aztec Alpha Mainnet (M3)

| Field | Value |
|---|---|
| Network | Aztec Alpha Mainnet |
| CLI Version | aztec 5.0.1 (upgraded from 5.0.0 same day AZUP-2 went live) |
| Node URL | https://aztec-mainnet.drpc.org |
| L1 Chain ID | 1 (Ethereum mainnet) |
| Deployed | 2026-07-21 |
| Contract Address | 0x25bb47296b98070aaef61167a966cc6416d8a3f7b18b285796b7fd47c1a3e38e |
| Admin / Deployer | 0x2abaa9934abaee33e83916a01c982fa5eee603484f6a449e1b4ebf098509f3e3 (alias `mainnet-admin-v2`) |
| Fee-paying asset | $AZTEC (`0xa27ec0006e59f245217ff08cd52a7e8b169e62d2` on L1) -- Fee Juice on mainnet is *not* free ETH like testnet's Sponsored FPC; it's the network's own token |
| Fee Juice Portal (L1) | 0xaf73Dd51D1eb8a079BB097f39c832cDD00ac691c |

No sponsored FPC exists on mainnet. Deployment required bridging real $AZTEC
into Fee Juice before any transaction could be sent.

### Deploy Commands

```bash
# 1. Bridge $AZTEC -> Fee Juice (requires an L1 account already holding $AZTEC;
#    $AZTEC is both the Fee Juice AND staking asset on mainnet, NOT ETH)
aztec-wallet bridge-fee-juice \
  30000000000000000000 \
  <mainnet-admin-v2 address> \
  --l1-rpc-urls "$L1_RPC_URL" \
  --l1-private-key "$L1_PRIVATE_KEY" \
  --l1-chain-id 1 \
  --node-url https://aztec-mainnet.drpc.org

# 2. Register the address locally (no tx, no funds needed)
aztec-wallet --node-url https://aztec-mainnet.drpc.org create-account \
  --register-only --alias mainnet-admin-v2

# 3. Deploy the account, claiming the bridged Fee Juice inline as payment
#    (claimSecret/claimAmount/messageLeafIndex are printed by step 1)
aztec-wallet deploy-account <mainnet-admin-v2 address> \
  --from mainnet-admin-v2 \
  --payment method=fee_juice,claimSecret=<...>,claimAmount=30000000000000000000,messageLeafIndex=<...> \
  --node-url https://aztec-mainnet.drpc.org

# 4. Deploy the PrivateVoting contract, paid from the now-funded account
aztec-wallet deploy \
  --from mainnet-admin-v2 \
  --payment method=fee_juice \
  --alias private_voting_mainnet \
  target/private_voting_contract-PrivateVoting.json \
  --args accounts:mainnet-admin-v2 \
  --node-url https://aztec-mainnet.drpc.org
```

### Transaction History

| Operation | Tx Hash |
|---|---|
| bridge-fee-juice: approve $AZTEC (L1) | 0x232ca0f4ebb8dbe24cd00041bf75284dea6b0c2c10840f4d0e788dc4587bd991 |
| bridge-fee-juice: depositToAztecPublic (L1) | 0x562d086051d8b8e35f494e57b3d0f23056e1a5e9a7652a99805c8d120b9579d0 |
| deploy-account (mainnet-admin-v2) | 0x157942227afaba1fca4dceeb8c63f7cf6dfc4228128c905fb612ce7a1833c360 |
| deploy PrivateVoting | 0x295698d0e89954d1c8268a87b003ceab4409c4d8e54f93594ccd64cea7e2d190 |

### Known issue: `aztec-wallet` CLI 5.0.1 SchnorrAccount references a stale HandshakeRegistry address

`cast_vote` (a private function) failed on mainnet with:

```
Error: Cannot call 0x0193c31bd24d0347aa9ed889cd6d304832988625c2f21c411e7af9d703591aa5:0xc475a0eb:
the contract is not registered.
```

Root cause (confirmed by diffing `@aztec/standard-contracts@5.0.0` vs `@5.0.1`):
the account contract bundled with `aztec-wallet` CLI 5.0.1 has the **v5.0.0-vintage
`HandshakeRegistry` standard-contract address** (`0x0193c31b...`) baked into its
compiled bytecode, instead of the v5.0.1 address (`0x086c3c67...`) that the rest of
the CLI/network uses. This affects every account deployed via this CLI version, not
just this project's contract -- not something recompiling PrivateVoting fixes.

Fix: `HandshakeRegistry` is a permissionless "standard contract" (fixed salt=1,
universal deployment, no constructor), so anyone can deploy it at its deterministic
address. Deployed it ourselves:

```bash
aztec-wallet deploy \
  --from mainnet-admin-v2 \
  --payment method=fee_juice \
  --salt 0x0000000000000000000000000000000000000000000000000000000000000001 \
  --universal \
  --no-init \
  --alias handshake_registry_v500 \
  e2e/.standard-contracts-v500/HandshakeRegistry.json \
  --node-url https://aztec-mainnet.drpc.org
```

Tx hash: `0x29bf39cc29c8694ff346613e5961cf2533ab23228f5c853504bbaa4ad4dd1351`
(deployed at `0x0193c31bd24d0347aa9ed889cd6d304832988625c2f21c411e7af9d703591aa5`, as expected).

Any aztec.js client also needs to (a) locally register that HandshakeRegistry
instance/artifact, and (b) configure a PXE `authorizeUtilityCall` hook that
authorizes calls into it -- see `e2e/src/e2e-mainnet.ts`. Both steps are required
even after the on-chain deployment exists; PXE never infers artifacts or
authorization from chain state alone.

### E2E Test Results

### 2026-07-21 -- single-account flow via `e2e/src/e2e-mainnet.ts` (aztec.js EmbeddedWallet)

Single admin account only (no second voter, unlike testnet -- mainnet has no
sponsored FPC, so a second voter would need its own bridged funds).

| Operation | Tx Hash | Block |
|---|---|---|
| create_poll({id:1}) (sent directly via `aztec-wallet send`) | 0x1d83a1f49fa603b30cc84a0e3b0bf9e04f44a85a10ce3d3198cbace508770f0d | -- |
| cast_vote({id:1}, 1) -- YES, mainnet-admin-v2 | 0x2a7715d90619b31bd5a01e69e1d879a9d45af46fb2c17448a55fb3806cd22c1b | 7823 |
| end_poll({id:1}) | 0x28566deb2941b2829ccaef6664e0d6c60085ee29fb990cd5bf4b444351b507bc | 7824 |

| Query | Result |
|---|---|
| get_vote_count({id:1}, 1) -- YES | 1 |
| get_vote_count({id:1}, 0) -- NO | 0 |
| is_poll_ended({id:1}) | true |

### 2026-07-23 -- second flow, poll 2, via `e2e/src/e2e-mainnet.ts`

Poll 1 was already ended, so this round used `POLL_ID = {id: 2}`. Ran into two
new mainnet-specific issues along the way (see below); both are now reflected
in the script.

| Operation | Tx Hash | Block |
|---|---|---|
| create_poll({id:2}) | 0x1b64e1ffbd1cb81b61b8baba6f34428f5b002f2c90eef37d22760fb73f18dac9 | -- |
| cast_vote({id:2}, 1) -- YES, mainnet-admin-v2 | 0x27a614c17abaa0300ab4996cca1f17956e491b6f50516f228fba9c3aaa81ea7b | -- |
| end_poll({id:2}) | 0x015eabaafe7b97d89ffd6cf8b8871e8f23d4fa3351c133ead68d77ccdd101dc4 | 10332 |

| Query | Result |
|---|---|
| get_vote_count({id:2}, 1) -- YES | 1 |
| get_vote_count({id:2}, 0) -- NO | 0 |
| is_poll_ended({id:2}) | true |

The `create_poll` and `cast_vote` sends each reported a client-side
`Request timeout on the free plan, please upgrade to paid plan` error from
`aztec-mainnet.drpc.org`, and `aztec-wallet get-tx <hash>` subsequently reported
`Status: dropped / Tx dropped by P2P node` for both hashes. Both were actually
on-chain -- confirmed read-only (no tx) via `is_poll_ended`/`get_vote_count`
showing the expected post-tx state, and via the account's Fee Juice balance
dropping by the exact fee amount each time. **dRPC's free-tier `get-tx` status
cannot be trusted as ground truth for mainnet on this project** -- prefer
re-deriving state from the contract's own read functions, and cross-checking
`get-fee-juice-balance` deltas, before assuming a "dropped"/timed-out send
failed. Only `end_poll` above returned a clean confirmation end-to-end (tx
hash, block number, fee) without hitting this issue.

#### Known issue: default fee estimation reserves against the network's max gas, not actual usage

Calling `.send({ from })` with no explicit `fee` option failed at the AVM
simulation step with `Not enough balance for fee payer to pay for transaction`,
even though the account held 20.71 FJ -- comfortably more than the ~1.2-1.3 FJ
a `create_poll`/`cast_vote`/`end_poll` call actually costs (confirmed via prior
runs and via `aztec get-current-min-fee`).

Root cause: `@aztec/wallet-sdk`'s `completeFeeOptions` (`base_wallet.js`) falls
back to `GasSettings.fallback({ gasLimits: maxTxGasLimits, ... })` whenever no
explicit `gasLimits` is given, where `maxTxGasLimits` comes from the node's
advertised `txsLimits.gas` -- the network's absolute per-tx ceiling (l2Gas
6,540,000 / daGas 117,668 as of 2026-07-23), not an estimate of the call's real
usage (~630k-730k l2Gas for these functions). `maxFeesPerGas` is the worst-case
*predicted* min fee (`getPredictedMinFees`, not just the current one) padded
1.5x, so the reserved amount can end up costing several times the account's
actual balance even though the real bill afterward is tiny.

Fix: pass explicit gas limits well below the network max but with headroom
over observed usage, e.g. `fee: { gasSettings: { gasLimits: { l2Gas: 3_000_000,
daGas: 5_000 } } }`. `e2e/src/e2e-mainnet.ts` now sets this on every `.send()`
call via a shared `GAS_LIMITS` constant.
