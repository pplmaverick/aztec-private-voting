use crate::test::utils;
use crate::PrivateVoting;
use crate::PrivateVoting::PollId;
use aztec::protocol::storage::map::derive_storage_slot_in_map;

// helpers
fn poll_1() -> PollId { PollId::new(Field::from(1)) }
fn poll_2() -> PollId { PollId::new(Field::from(2)) }

// --- admin -------------------------------------------------------------------

#[test]
unconstrained fn test_admin_set_on_deploy() {
    let (env, contract_address, admin) = utils::setup();

    env.public_context_at(contract_address, |context| {
        let stored_admin = context.storage_read(PrivateVoting::storage_layout().admin.slot);
        assert_eq(stored_admin, admin);
    });
}

// --- create_poll -------------------------------------------------------------

#[test]
unconstrained fn test_create_poll() {
    let (env, contract_address, admin) = utils::setup();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));

    env.public_context_at(contract_address, |context| {
        let ended = context.storage_read(derive_storage_slot_in_map(
            PrivateVoting::storage_layout().poll_ended.slot,
            poll_1(),
        ));
        assert_eq(ended, false);
    });
}

#[test(should_fail_with = "Only admin can create polls")]
unconstrained fn test_non_admin_cannot_create_poll() {
    let (mut env, contract_address, _) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(alice, PrivateVoting::at(contract_address).create_poll(poll_1()));
}

// --- cast_vote ---------------------------------------------------------------

#[test]
unconstrained fn test_single_vote_counted() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));

    // choice 0 = "Yes"
    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 0));

    let count = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_1(), 0));
    assert_eq(count, 1);
}

#[test]
unconstrained fn test_two_voters_same_option() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));

    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 1));
    let _ = env.call_private(bob, PrivateVoting::at(contract_address).cast_vote(poll_1(), 1));

    let count = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_1(), 1));
    assert_eq(count, 2);
}

#[test]
unconstrained fn test_two_voters_different_options() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();
    let bob = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));

    // Alice votes option 0, Bob votes option 1
    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 0));
    let _ = env.call_private(bob, PrivateVoting::at(contract_address).cast_vote(poll_1(), 1));

    let yes = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_1(), 0));
    let no  = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_1(), 1));
    assert_eq(yes, 1);
    assert_eq(no, 1);
}

// --- double-vote prevention (nullifier) -------------------------------------

#[test(should_fail_with = "duplicate siloed nullifier")]
unconstrained fn test_double_vote_rejected() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));

    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 0));
    // Second attempt must fail -- nullifier already emitted.
    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 1));
}

// --- same voter, multiple polls ----------------------------------------------

#[test]
unconstrained fn test_same_voter_can_vote_in_two_polls() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));
    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_2()));

    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 0));
    let _ = env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_2(), 1));

    let p1 = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_1(), 0));
    let p2 = env.view_public(PrivateVoting::at(contract_address).get_vote_count(poll_2(), 1));
    assert_eq(p1, 1);
    assert_eq(p2, 1);
}

// --- end_poll ----------------------------------------------------------------

#[test]
unconstrained fn test_end_poll() {
    let (env, contract_address, admin) = utils::setup();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));
    env.call_public(admin, PrivateVoting::at(contract_address).end_poll(poll_1()));

    let ended = env.view_public(PrivateVoting::at(contract_address).is_poll_ended(poll_1()));
    assert_eq(ended, true);
}

#[test(should_fail_with = "Only admin can end polls")]
unconstrained fn test_non_admin_cannot_end_poll() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));
    env.call_public(alice, PrivateVoting::at(contract_address).end_poll(poll_1()));
}

#[test(should_fail_with = "Poll has ended")]
unconstrained fn test_cannot_vote_after_poll_ended() {
    let (mut env, contract_address, admin) = utils::setup();
    let alice = env.create_light_account();

    env.call_public(admin, PrivateVoting::at(contract_address).create_poll(poll_1()));
    env.call_public(admin, PrivateVoting::at(contract_address).end_poll(poll_1()));

    env.call_private(alice, PrivateVoting::at(contract_address).cast_vote(poll_1(), 0));
}
