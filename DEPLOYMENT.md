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
