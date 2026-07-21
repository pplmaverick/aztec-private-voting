# Aztec Private Voting

[![CI](https://github.com/pplmaverick/aztec-private-voting/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/pplmaverick/aztec-private-voting/actions/workflows/test.yml)
![Network](https://img.shields.io/badge/Aztec_Alpha_Mainnet-v5.0.1-blue)
![Noir](https://img.shields.io/badge/Noir-1.0.0--beta.22-purple)
![License](https://img.shields.io/badge/license-MIT-green)

A privacy-preserving voting system built on Aztec Network using Noir.
Votes are cast with client-side ZK proofs — even Aztec sequencers cannot
see who voted for what.

**Live on Aztec Alpha Mainnet**

| Field | Value |
|---|---|
| Network | Aztec Alpha Mainnet |
| Aztec Version | 5.0.1 |
| Noir Version | 1.0.0-beta.22 |
| Contract Address | `0x25bb47296b98070aaef61167a966cc6416d8a3f7b18b285796b7fd47c1a3e38e` |
| Tests | 11/11 passing |
| Full deployment record | [DEPLOYMENT.md](./DEPLOYMENT.md) |

---

## Why Chain-Native

This project is not ported from EVM. Every design decision maps to an Aztec-native capability.

| Feature | General EVM | Midnight | Aztec |
|---|---|---|---|
| Vote visibility | Fully public | Private state (node honesty) | Client-side ZK proof |
| Privacy guarantee | None | Node does not see content | Mathematical guarantee |
| Double-vote prevention | On-chain record | Compact contract logic | Nullifier (client-side) |
| Result verifiability | Fully public | Selective disclosure | Public tally, private votes |
| Trust assumption | Trust miners | Trust node honesty | Trust math only |

---

## Privacy Technology Comparison

| Project | Chain | Privacy Mechanism | What's Hidden |
|---|---|---|---|
| Fhenix Confidential Market | Arbitrum Sepolia | FHE encryption (CoFHE euint64) | Encrypted server-side computation |
| Seismic Spread Monitor | Seismic Testnet | Shielded types (suint256, saddress) | Node-layer privacy |
| Ritual Weather Market | Ritual Testnet | TEE HTTP Precompile | Hardware-isolated execution |
| Miden Weather Market | Miden Testnet | ZK Poseidon2 commitments | UTXO-based ZK proofs |
| **Aztec Private Voting** | **Aztec Mainnet** | **Client-side ZK proof (Noir)** | **Inputs never leave user device** |

Aztec is the only project where private inputs are mathematically
guaranteed never to leave the user's device.

---

## Architecture

```
User Device                    Aztec Network              Ethereum L1

------------------             ------------------         --------------
castVote(choice)

+-------------+              +--------------+           +-----------+
| Noir circuit|              |  Sequencers  |           |  Rollup   |
| (private)   |--ZK proof-->|  (validate   |--batch-->| Contract  |
|             |              |   proof only)|           |           |
| nullifier   |              |              |           +-----------+
| generated   |              | public state |
+-------------+              | updated      |
                             +--------------+

choice: NEVER leaves         sequencer sees:
this device                  [x] proof is valid
                             [ ] what you voted
```

---

## How It Works

### 1. Create Poll (public function)
Admin calls `create_poll(poll_id)`. The poll becomes active at the current block.
Options are indexed as `0, 1, 2 ...` — metadata is stored off-chain or in calldata.

### 2. Cast Vote (private function)
Executes **locally on your device** as a Noir circuit. Generates a ZK proof
that you voted validly without revealing your choice.

```noir
#[external("private")]
fn cast_vote(poll_id: PollId, choice: Field) {
    self.storage.vote_claims.at(poll_id).at(self.msg_sender()).claim();
    self.enqueue_self.add_to_tally_public(poll_id, choice);
}
```

### 3. Nullifier (double-vote prevention)
`SingleUseClaim` emits an app-siloed nullifier derived from the voter's nullifier
hiding key and the storage slot. This prevents a second vote in the same poll
while revealing nothing about the voter's identity or their choice.

### 4. Tally Votes (public view)
Anyone can call `get_vote_count(poll_id, choice)` to read totals.
Individual votes are permanently private — there is no way to reconstruct them.

---

## Contract Interface

```noir
// Admin
constructor(admin: AztecAddress)
create_poll(poll_id: PollId)
end_poll(poll_id: PollId)

// Private voting
cast_vote(poll_id: PollId, choice: Field)          // private — choice hidden

// Internal (only callable by cast_vote)
add_to_tally_public(poll_id: PollId, choice: Field)

// Views
get_vote_count(poll_id: PollId, choice: Field) -> Field
is_poll_ended(poll_id: PollId) -> bool
get_admin() -> AztecAddress
```

---

## Quick Start

**Prerequisites**
- macOS with Homebrew
- Docker Desktop (running)
- Node.js >= 24.12.0

```bash
# 1. Install Aztec toolchain
bash -i <(curl -sL https://install.aztec.network)

# 2. Start local network (keep this terminal open)
aztec start --local-network

# 3. Clone and test
git clone https://github.com/pplmaverick/aztec-private-voting
cd aztec-private-voting
aztec test
```

Expected output:

```
[private_voting_contract] Running 11 test functions
[private_voting_contract] test_admin_set_on_deploy          ok
[private_voting_contract] test_create_poll                  ok
[private_voting_contract] test_non_admin_cannot_create_poll ok
[private_voting_contract] test_single_vote_counted          ok
[private_voting_contract] test_two_voters_same_option       ok
[private_voting_contract] test_two_voters_different_options ok
[private_voting_contract] test_double_vote_rejected         ok
[private_voting_contract] test_same_voter_can_vote_in_two_polls ok
[private_voting_contract] test_end_poll                     ok
[private_voting_contract] test_non_admin_cannot_end_poll    ok
[private_voting_contract] test_cannot_vote_after_poll_ended ok
[private_voting_contract] 11 tests passed
```

---

## Implementation Notes

**Bash version requirement**

Aztec scripts use `shopt -s inherit_errexit` which requires Bash 4.4+.
macOS ships with Bash 3.2 (GPL-2 license restriction). Fix:

```bash
brew install bash
# /opt/homebrew/bin/bash is added to PATH before /bin/bash
```

**Node.js version requirement**

Aztec 5.0.0 requires Node.js >= 24.12.0. Install via nvm:

```bash
nvm install 24.12.0 && nvm alias default 24.12.0
```

**Package name restriction**

Noir package names cannot contain hyphens. The workspace crate is named
`private_voting_contract` even though the git repo is `aztec-private-voting`.

**SingleUseClaim vs manual nullifier**

Rather than computing `poseidon2([voter_secret, poll_id])` manually,
`SingleUseClaim` from `aztec-nr` handles nullifier derivation using the voter's
app-siloed nullifier hiding key (`nhk`). This is safer and more auditable.

---

## Stack

| Layer | Technology |
|---|---|
| Smart contract | Noir 1.0.0-beta.22 (aztec-nr v5.0.0) |
| Proving backend | Barretenberg (UltraHonk) |
| Development | aztec-nargo + aztec CLI |
| Test framework | TXE (Testing Execution Environment) |
| Local network | `aztec start --local-network` |
| Mainnet | Live on Aztec Alpha Mainnet v5.0.1 — see [DEPLOYMENT.md](./DEPLOYMENT.md) |

---

## Roadmap

**M1 — Noir Contract (complete, 2026-06-24)**
- [x] Noir contract compiles with UltraHonk VK generation
- [x] 11 e2e tests: createPoll, castVote x2, double-vote rejection, endPoll
- [x] Nullifier-based double-vote prevention verified
- [x] Two accounts cast votes independently confirmed

**M2 — Testnet Deployment (complete, 2026-07-16)**
- [x] Upgraded to Aztec v5.0.0
- [x] Deployed PrivateVoting to Aztec Testnet
- [x] Full e2e flow on testnet (createPoll -> castVote x2 -> endPoll -> tally)

**M3 — Mainnet Deployment + Grant Application (in progress, 2026-07-21)**
- [x] Deployed PrivateVoting to Aztec Alpha Mainnet (v5.0.1, post AZUP-2)
- [x] Full e2e flow on mainnet (createPoll -> castVote -> endPoll -> tally)
- [ ] Aztec Ecosystem Grant submission
- [ ] Multi-poll support
- [ ] Delegation / anonymous credentials

Full deployment details, transaction hashes, and known issues: see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Activity Log

**Week 1 — M1 Local Network**
- Deployed PrivateVoting contract to Aztec local network
- Ran full e2e: createPoll -> castVote x2 -> nullifier check -> tallyVotes
- Confirmed votes are private: sequencer sees only ZK proof validity

**2026-07-16 — M2 Testnet**
- Upgraded to Aztec v5.0.0
- Deployed PrivateVoting to Aztec Testnet
- Full e2e (two voters) passing on testnet — see [DEPLOYMENT.md](./DEPLOYMENT.md)

**2026-07-21 — M3 Mainnet**
- Aztec Alpha Mainnet upgraded to v5.0.1 (AZUP-2 executed)
- Deployed PrivateVoting to Aztec Alpha Mainnet
- Full e2e (createPoll -> castVote -> endPoll -> tally) passing on mainnet
- Full transaction history and known issues: see [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Developer

GitHub: [pplmaverick](https://github.com/pplmaverick)
Wallet: `0xed2B5717c9b936ecC76d75401026A99143e278F5`

## License

MIT
