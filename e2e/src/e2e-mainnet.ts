import dotenv from "dotenv";
dotenv.config({ path: ".env.mainnet" });

import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { loadContractArtifact } from "@aztec/stdlib/abi";
import { PrivateVotingContract } from "./artifacts/PrivateVoting.js";
import HandshakeRegistryJson from "../.standard-contracts-v500/HandshakeRegistry.json" with { type: "json" };

const NODE_URL = process.env.NODE_URL ?? "https://aztec-mainnet.drpc.org";
const CONTRACT_ADDRESS =
  "0x25bb47296b98070aaef61167a966cc6416d8a3f7b18b285796b7fd47c1a3e38e";

// mainnet-admin-v2 was created via `aztec-wallet create-account --register-only`
// and deployed via `aztec-wallet deploy-account`. Re-deriving it locally with the
// same secret/salt/signing key resolves to the same address -- no redeployment
// happens here, and no new funds are moved.
const ADMIN_SECRET = Fr.fromString(process.env.MAINNET_ADMIN_SECRET!);
const ADMIN_SIGNING_KEY = GrumpkinScalar.fromString(
  process.env.MAINNET_ADMIN_SIGNING_KEY!,
);
const ADMIN_SALT = Fr.fromString(
  "0x0000000000000000000000000000000000000000000000000000000000000000",
);

// The salt used when PrivateVoting was deployed via `aztec-wallet deploy`
// (see DEPLOYMENT.md mainnet section).
const CONTRACT_DEPLOYMENT_SALT = Fr.fromString(
  "0x2a8f2bc0ab0322b827521c52c7265f72d45747f5a52f407e1cc982253467056a",
);

// Poll 1 (created 2026-07-21) was already ended by a prior e2e run -- see
// DEPLOYMENT.md. Using a fresh poll_id here since create_poll's
// active_at_block.initialize() would revert on a poll_id that's already active.
const POLL_ID = { id: 2n };
const CHOICE_YES = 1n;
const CHOICE_NO = 0n;

// Without an explicit `fee.gasSettings.gasLimits`, aztec.js reserves against the
// network's per-tx max (txsLimits.gas: l2Gas 6,540,000 / daGas 117,668 as of
// 2026-07-23) at a padded predicted-worst-case fee -- that reservation alone
// exceeded mainnet-admin-v2's 20.71 FJ balance even though create_poll's actual
// simulated usage was only ~730,686 l2Gas / 352 daGas. Capping the limit well
// below the network max (but with headroom over that observed usage) brings the
// reservation back within budget.
const GAS_LIMITS = { l2Gas: 3_000_000, daGas: 5_000 };

async function main() {
  console.log(`Connecting to node: ${NODE_URL}`);
  const node = createAztecNodeClient(NODE_URL);
  await waitForNode(node);

  // cast_vote's SingleUseClaim mechanism makes a cross-contract utility call
  // from PrivateVoting into the (now mainnet-deployed) HandshakeRegistry
  // standard contract. PXE denies cross-contract utility calls by default
  // unless the wallet explicitly authorizes the target -- see DEPLOYMENT.md.
  const HANDSHAKE_REGISTRY_ADDRESS = AztecAddress.fromStringUnsafe(
    "0x0193c31bd24d0347aa9ed889cd6d304832988625c2f21c411e7af9d703591aa5",
  );
  const wallet = await EmbeddedWallet.create(node, {
    ephemeral: true,
    pxe: {
      hooks: {
        authorizeUtilityCall: async (request) =>
          request.target.equals(HANDSHAKE_REGISTRY_ADDRESS)
            ? { authorized: true }
            : { authorized: false, reason: "Unknown target" },
      },
    },
  });

  const nodeInfo = await node.getNodeInfo();
  console.log(
    `Connected. Node version: ${nodeInfo.nodeVersion}, chain ID: ${nodeInfo.l1ChainId}`,
  );

  const adminWallet = await wallet.createSchnorrAccount(
    ADMIN_SECRET,
    ADMIN_SALT,
    ADMIN_SIGNING_KEY,
  );
  console.log(`mainnet-admin-v2 address: ${adminWallet.address.toString()}`);

  const contractAddress = AztecAddress.fromStringUnsafe(CONTRACT_ADDRESS);
  const reconstructedInstance = await getContractInstanceFromInstantiationParams(
    PrivateVotingContract.artifact,
    {
      constructorArtifact: "constructor",
      constructorArgs: [adminWallet.address],
      deployer: adminWallet.address,
      salt: CONTRACT_DEPLOYMENT_SALT,
    },
  );
  if (!reconstructedInstance.address.equals(contractAddress)) {
    throw new Error(
      `Reconstructed address ${reconstructedInstance.address.toString()} does not match expected ${CONTRACT_ADDRESS}`,
    );
  }
  await wallet.registerContract(reconstructedInstance, PrivateVotingContract.artifact);
  const privateVoting = await PrivateVotingContract.at(contractAddress, wallet);
  console.log(`Connected to PrivateVoting at: ${privateVoting.address.toString()}`);

  // The mainnet-admin-v2 account contract (deployed via aztec-wallet CLI 5.0.1)
  // has a stale reference baked into its bytecode to the v5.0.0-vintage
  // HandshakeRegistry standard-contract address. That contract was deployed for
  // real on mainnet at its deterministic address (salt=1, universal, no-init) --
  // see DEPLOYMENT.md -- but each local wallet session still needs to register
  // its artifact locally to be able to simulate calls into it.
  const HandshakeRegistryArtifact = await loadContractArtifact(HandshakeRegistryJson as any);
  const handshakeInstance = await getContractInstanceFromInstantiationParams(
    HandshakeRegistryArtifact,
    { salt: new Fr(1) },
  );
  console.log(`Reconstructed HandshakeRegistry address: ${handshakeInstance.address.toString()}`);
  await wallet.registerContract(handshakeInstance, HandshakeRegistryArtifact);

  // create_poll is intentionally skipped here: a prior run's create_poll(POLL_ID)
  // send() reported a client-side RPC timeout/dropped status, but the tx had
  // actually landed on-chain -- confirmed read-only via is_poll_ended({id:2}) ==
  // false with 0/0 votes (i.e. created, never voted, never ended). Re-sending
  // create_poll would revert with a duplicate-nullifier error on
  // active_at_block.initialize(). See DEPLOYMENT.md's 2026-07-23 section for
  // the full debugging trail.

  // cast_vote is intentionally skipped here too: the prior run's send() also
  // reported a client-side RPC timeout/dropped status, but the vote had
  // actually landed on-chain -- confirmed read-only via get_vote_count == 1
  // YES / 0 NO for poll 2, and the account's Fee Juice balance dropping by the
  // expected ~1.23 FJ. Re-sending would revert (vote_claims claim already used).

  console.log("\n--- get_vote_count (choice=1, YES) ---");
  const { result: yesCount } = await privateVoting.methods
    .get_vote_count(POLL_ID, CHOICE_YES)
    .simulate({ from: adminWallet.address });
  console.log(`YES votes: ${yesCount}`);

  console.log("\n--- get_vote_count (choice=0, NO) ---");
  const { result: noCount } = await privateVoting.methods
    .get_vote_count(POLL_ID, CHOICE_NO)
    .simulate({ from: adminWallet.address });
  console.log(`NO votes: ${noCount}`);

  console.log("\n--- end_poll ---");
  const { receipt: endPollReceipt } = await privateVoting.methods
    .end_poll(POLL_ID)
    .send({ from: adminWallet.address, fee: { gasSettings: { gasLimits: GAS_LIMITS } } });
  console.log(`Tx hash: ${endPollReceipt.txHash.toString()}`);
  console.log(
    `Block: ${endPollReceipt.blockNumber}, fee: ${endPollReceipt.transactionFee}`,
  );

  console.log("\n--- is_poll_ended ---");
  const { result: ended } = await privateVoting.methods
    .is_poll_ended(POLL_ID)
    .simulate({ from: adminWallet.address });
  console.log(`Poll ended: ${ended}`);
  if (ended !== true) {
    throw new Error(`Expected poll to be ended, got: ${ended}`);
  }

  console.log("\nmainnet e2e flow completed successfully");
}

main().catch((err) => {
  console.error("mainnet e2e flow failed:", err);
  process.exit(1);
});
