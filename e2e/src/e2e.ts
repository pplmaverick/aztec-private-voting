import "dotenv/config";
import { createAztecNodeClient, waitForNode } from "@aztec/aztec.js/node";
import { EmbeddedWallet } from "@aztec/wallets/embedded";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { PrivateVotingContract } from "./artifacts/PrivateVoting.js";

const NODE_URL = process.env.NODE_URL ?? "https://v5.testnet.rpc.aztec-labs.com";
const CONTRACT_ADDRESS =
  "0x2264d5c685966bfb075173b9423293bfaaac2a27fd80f07547812515e789f7ed";

// dev-wallet was created via `aztec-wallet create-account` and is already
// deployed on testnet. Re-deriving it locally with the same secret/salt/signing
// key resolves to the same address — no redeployment happens here.
const DEV_WALLET_SECRET = Fr.fromString(process.env.DEV_WALLET_SECRET!);
const DEV_WALLET_SIGNING_KEY = GrumpkinScalar.fromString(
  process.env.DEV_WALLET_SIGNING_KEY!,
);
const DEV_WALLET_SALT = Fr.fromString(
  "0x0000000000000000000000000000000000000000000000000000000000000000",
);

// The salt used when PrivateVoting was deployed via `aztec-wallet deploy`
// (see DEPLOYMENT.md). Needed to reconstruct the contract instance below.
const CONTRACT_DEPLOYMENT_SALT = Fr.fromString(
  "0x0975d538ad3af7a1b0a7798a1cd3cf272fbd00bfbf3fd1c588745e2da15e8228",
);

const POLL_ID = { id: 1n };
const CHOICE_YES = 1n;
const CHOICE_NO = 0n;

async function main() {
  // 1. Connect to testnet
  console.log(`Connecting to node: ${NODE_URL}`);
  const node = createAztecNodeClient(NODE_URL);
  await waitForNode(node);
  const wallet = await EmbeddedWallet.create(node, { ephemeral: true });

  const nodeInfo = await node.getNodeInfo();
  console.log(
    `Connected. Node version: ${nodeInfo.nodeVersion}, chain ID: ${nodeInfo.l1ChainId}`,
  );

  // 2. Re-derive the already-deployed dev-wallet account (local registration only)
  const devWallet = await wallet.createSchnorrAccount(
    DEV_WALLET_SECRET,
    DEV_WALLET_SALT,
    DEV_WALLET_SIGNING_KEY,
  );
  console.log(`dev-wallet address: ${devWallet.address.toString()}`);

  // 3. Sponsored FPC payment method — address derived, never hardcoded
  const sponsoredFPCInstance = await getContractInstanceFromInstantiationParams(
    SponsoredFPCContract.artifact,
    { salt: new Fr(0) },
  );
  await wallet.registerContract(sponsoredFPCInstance, SponsoredFPCContract.artifact);
  const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(
    sponsoredFPCInstance.address,
  );
  console.log(`Sponsored FPC address: ${sponsoredFPCInstance.address.toString()}`);

  // 4. Reconstruct the already-deployed PrivateVoting contract instance from its
  // known deployment parameters. `getContractMetadata().instance` is only populated
  // for contracts the wallet already knows about locally — a fresh EmbeddedWallet
  // has no record of a contract deployed by a separate `aztec-wallet` CLI session,
  // so `instance` comes back undefined even though the contract is live on-chain
  // (that's what `isContractPublished` would tell you, a different field).
  const contractAddress = AztecAddress.fromStringUnsafe(CONTRACT_ADDRESS);
  const reconstructedInstance = await getContractInstanceFromInstantiationParams(
    PrivateVotingContract.artifact,
    {
      constructorArtifact: "constructor",
      constructorArgs: [devWallet.address],
      deployer: devWallet.address,
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

  // 5. create_poll (admin-only public function)
  console.log("\n--- create_poll ---");
  const { receipt: createPollReceipt } = await privateVoting.methods
    .create_poll(POLL_ID)
    .send({ from: devWallet.address, fee: { paymentMethod: sponsoredPaymentMethod } });
  console.log(`Tx hash: ${createPollReceipt.txHash.toString()}`);
  console.log(
    `Block: ${createPollReceipt.blockNumber}, fee: ${createPollReceipt.transactionFee}`,
  );

  // 6. cast_vote — YES (choice = 1), from dev-wallet
  console.log("\n--- cast_vote (YES, choice=1) ---");
  const { receipt: voteYesReceipt } = await privateVoting.methods
    .cast_vote(POLL_ID, CHOICE_YES)
    .send({ from: devWallet.address, fee: { paymentMethod: sponsoredPaymentMethod } });
  console.log(`Tx hash: ${voteYesReceipt.txHash.toString()}`);
  console.log(
    `Block: ${voteYesReceipt.blockNumber}, fee: ${voteYesReceipt.transactionFee}`,
  );

  // 7. cast_vote — NO (choice = 0), from a second, temporary voter
  // Initializerless account: no deployment transaction needed, ready immediately.
  console.log("\n--- cast_vote (NO, choice=0), second voter ---");
  const voterTwo = await wallet.createSchnorrInitializerlessAccount(
    Fr.random(),
    Fr.random(),
    GrumpkinScalar.random(),
  );
  console.log(`Voter 2 address: ${voterTwo.address.toString()}`);

  const { receipt: voteNoReceipt } = await privateVoting.methods
    .cast_vote(POLL_ID, CHOICE_NO)
    .send({ from: voterTwo.address, fee: { paymentMethod: sponsoredPaymentMethod } });
  console.log(`Tx hash: ${voteNoReceipt.txHash.toString()}`);
  console.log(
    `Block: ${voteNoReceipt.blockNumber}, fee: ${voteNoReceipt.transactionFee}`,
  );

  // 8. get_vote_count(poll_id, 1) — YES tally
  console.log("\n--- get_vote_count (choice=1, YES) ---");
  const { result: yesCount } = await privateVoting.methods
    .get_vote_count(POLL_ID, CHOICE_YES)
    .simulate({ from: devWallet.address });
  console.log(`YES votes: ${yesCount}`);

  // 9. get_vote_count(poll_id, 0) — NO tally
  console.log("\n--- get_vote_count (choice=0, NO) ---");
  const { result: noCount } = await privateVoting.methods
    .get_vote_count(POLL_ID, CHOICE_NO)
    .simulate({ from: devWallet.address });
  console.log(`NO votes: ${noCount}`);

  // 10. end_poll (admin-only)
  console.log("\n--- end_poll ---");
  const { receipt: endPollReceipt } = await privateVoting.methods
    .end_poll(POLL_ID)
    .send({ from: devWallet.address, fee: { paymentMethod: sponsoredPaymentMethod } });
  console.log(`Tx hash: ${endPollReceipt.txHash.toString()}`);
  console.log(
    `Block: ${endPollReceipt.blockNumber}, fee: ${endPollReceipt.transactionFee}`,
  );

  // 11. is_poll_ended — confirm true
  console.log("\n--- is_poll_ended ---");
  const { result: ended } = await privateVoting.methods
    .is_poll_ended(POLL_ID)
    .simulate({ from: devWallet.address });
  console.log(`Poll ended: ${ended}`);
  if (ended !== true) {
    throw new Error(`Expected poll to be ended, got: ${ended}`);
  }

  console.log("\ne2e flow completed successfully");
}

main().catch((err) => {
  console.error("e2e flow failed:", err);
  process.exit(1);
});
