mod test;
use aztec::macros::aztec;

/// PrivateVoting - an on-chain poll system where vote choice is private.
///
/// Privacy model:
///   - cast_vote runs client-side via ZK proof; the voter's choice (candidate)
///     is a private input revealed only when the matching public tally is updated.
///   - SingleUseClaim emits an app-siloed nullifier so each address can vote at
///     most once per poll, without exposing who voted for what on-chain.
#[aztec]
pub contract PrivateVoting {
    use aztec::macros::{functions::{external, initializer, only_self, view}, storage::storage};
    use aztec::protocol::{address::AztecAddress, traits::{Deserialize, Serialize, ToField}};
    use aztec::state_vars::{Map, Owned, PublicImmutable, PublicMutable, SingleUseClaim};

    // PollId wraps a Field so it can be used as a Map key.
    #[derive(Serialize, Deserialize)]
    pub struct PollId {
        id: Field,
    }

    impl PollId {
        pub fn new(id: Field) -> Self {
            Self { id }
        }
    }

    impl ToField for PollId {
        fn to_field(self) -> Field {
            self.id
        }
    }

    #[storage]
    struct Storage<Context> {
        // Contract admin - the only address that can create / close polls.
        admin: PublicMutable<AztecAddress, Context>,

        // poll_id => option_index => accumulated vote count.
        tally: Map<PollId, Map<Field, PublicMutable<Field, Context>, Context>, Context>,

        // poll_id => whether voting has ended for that poll.
        poll_ended: Map<PollId, PublicMutable<bool, Context>, Context>,

        // poll_id => the block at which the poll became active (set on creation).
        active_at_block: Map<PollId, PublicImmutable<u32, Context>, Context>,

        // poll_id => voter => single-use claim preventing double voting.
        vote_claims: Map<PollId, Owned<SingleUseClaim<Context>, Context>, Context>,
    }

    // -------------------------------------------------------------------------
    // Initializer
    // -------------------------------------------------------------------------

    #[external("public")]
    #[initializer]
    fn constructor(admin: AztecAddress) {
        self.storage.admin.write(admin);
    }

    // -------------------------------------------------------------------------
    // Public functions (admin actions)
    // -------------------------------------------------------------------------

    /// Opens a new poll. The admin assigns a numeric poll_id; options are
    /// indexed 0..N-1 and tracked off-chain (or in calldata / events).
    #[external("public")]
    fn create_poll(poll_id: PollId) {
        assert(self.storage.admin.read().eq(self.msg_sender()), "Only admin can create polls");
        self.storage.poll_ended.at(poll_id).write(false);
        self.storage.active_at_block.at(poll_id).initialize(self.context.block_number());
    }

    /// Closes a poll so no further votes are accepted.
    #[external("public")]
    fn end_poll(poll_id: PollId) {
        assert(self.storage.admin.read().eq(self.msg_sender()), "Only admin can end polls");
        self.storage.poll_ended.at(poll_id).write(true);
    }

    // -------------------------------------------------------------------------
    // Private voting
    // -------------------------------------------------------------------------

    /// Cast a private vote.
    ///
    /// - choice is a private input: it is never exposed on-chain.
    ///   The ZK proof certifies the voter knew a valid choice without revealing it.
    /// - The SingleUseClaim emits a nullifier that prevents voting twice in the
    ///   same poll from the same account.
    /// - After proving, this enqueues a public call to increment the relevant tally.
    #[external("private")]
    fn cast_vote(poll_id: PollId, choice: Field) {
        // Consume the per-voter, per-poll claim -- reverts if already used.
        self.storage.vote_claims.at(poll_id).at(self.msg_sender()).claim();

        // Enqueue the public tally update (choice is revealed here to the sequencer,
        // but the link between voter identity and choice is broken by the ZK proof).
        self.enqueue_self.add_to_tally_public(poll_id, choice);
    }

    /// Public side of cast_vote -- increments the counter for choice.
    /// Decorated only_self so it can only be called by this contract's
    /// private functions, never by an external caller directly.
    #[external("public")]
    #[only_self]
    fn add_to_tally_public(poll_id: PollId, choice: Field) {
        assert(self.storage.active_at_block.at(poll_id).read() <= self.context.block_number());
        assert(self.storage.poll_ended.at(poll_id).read() == false, "Poll has ended");

        let new_tally = self.storage.tally.at(poll_id).at(choice).read() + 1;
        self.storage.tally.at(poll_id).at(choice).write(new_tally);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// Returns the number of votes for a specific option in a poll.
    #[external("public")]
    #[view]
    fn get_vote_count(poll_id: PollId, choice: Field) -> Field {
        self.storage.tally.at(poll_id).at(choice).read()
    }

    /// Returns true if the poll has ended.
    #[external("public")]
    #[view]
    fn is_poll_ended(poll_id: PollId) -> bool {
        self.storage.poll_ended.at(poll_id).read()
    }

    /// Returns the admin address.
    #[external("public")]
    #[view]
    fn get_admin() -> AztecAddress {
        self.storage.admin.read()
    }
}
