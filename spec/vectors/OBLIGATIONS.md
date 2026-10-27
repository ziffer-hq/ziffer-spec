# Obligations — what passing the vector corpus does not prove

**First draft · against ZIFFER-SPEC-001 v1.3.33 · produced by ACP-1 (VEC-1)**
**Completed by VEC-6 (ACP-3), which this draft exists to size.**

Read this before the corpus, not after it.

A shared conformance corpus expresses **input → verdict**. It hands an implementation a
set of bytes and asks what it decides. That is a real and useful thing to check across
languages, and it is a **minority of the evidence this repository actually relies on**.

**Of 185 cases in the four suites, 106 could become shared data and 79 could not.** The
audit suite is almost entirely in the second group: **15 of 17**, the exception being
the AU-1 chain derivation added in v1.3.15, which is expressible but not yet
extractable — see the canonicalisation note in `CLASSIFICATION.md`. On top of those 79 sit
**79 mutation cases**, which no data file can ever carry.

Passing every vector in the corpus is therefore a **partial** claim. An implementation
that passes all of them and does nothing else has demonstrated that it refuses the inputs
it was handed. It has not demonstrated that its checks are load-bearing, that its
orderings hold, that its notification path is genuinely a second path, or that its
accumulators count what they claim. Those are the obligations below, and they are
**per-implementation duties**: each implementation must discharge them with its own tests
and publish the result.

The derivation for every line here — which of three tests each case fails, and the run
that established it — is in [`CLASSIFICATION.md`](CLASSIFICATION.md).

---

## The reason this file is not a formality

Mutation testing cannot find a check that was never written. Suite 2's sixth lesson in
`dossier/05-TEST-EVIDENCE.md` records the case: for four releases, 24 mutants ran green
against a real gap in the handling of irreversible actions below floor-HIGH — **correctly**,
because there was no check present to delete. Only an external adversarial corpus found it.

The same limit applies here, one level up. A vector corpus is a set of inputs somebody
thought of. It says nothing about the input nobody thought of, and it cannot notice that a
rule is missing rather than wrong.

Concretely, and worth stating because it is recent and checkable: **three of the six
defects fixed on the `feat/rule-store` branch would have been invisible to any vector in
this corpus.** A bundle hash that silently dropped a field, a published file count that
had drifted from the signer's, and a fail-safe default that set a value nothing read — none
of them changes a verdict on any input. A corpus that had existed and been green
throughout would have been green through all three.

---

## Obligation 1 — sequences

The corpus presents one input and reads one verdict. These cases are about what happens
on the **second** call, and a transition is not an input. There is no way to write them as
data without the vector format becoming a scripting language, at which point it is no
longer a portable artifact.

One ordering in this family has **no case at all**, because the reference has no KMS:
§9.1.1 step 4a — the request's `tenant_id` compared against the verified manifest's — runs
**before** step 5 writes the durable high-water mark (RAD-5, v1.3.24; as numbered in v1.3.23
the write came first, and a request naming tenant B with tenant A's genuine bundle would have
raised B's mark before being denied — ACP-144). Nothing in `reference/` executes §9.1.1, so
no suite here can carry it. An implementation discharges it with a mutant that moves the
comparison below the write and a test that signs a genuine tenant-B request afterwards; the
product repository's `tenant-compare-before-mark-write` is the worked example. It is counted
nowhere below, because it is not a corpus case.

| Case | Suite | Rule | The transition |
| --- | --- | --- | --- |
| `a_nonce_replay` | conformance | `CL-2` | The same receipt executed twice. |
| `a_T14_attestation_replay` | conformance | `CL-3` | The same attestations under two receipts. |
| `a_Z3_origin_substitution` | conformance | `DS-6f` | A re-drive whose claimed origin is checked against the ledger's pinned one. |
| `a_epoch_rollback` | conformance | `RAD-3` | A genuine but superseded bundle, refused by a durable high-water mark. |
| `t_honest_redrive` | conformance | `DS-6` | Two executions must return the **same** idempotency key. |
| `a_DR_release_before_window` | conformance | `DR-1` | Execute, confirm, then release too early. |
| `a_DR_repudiation_by_outsider` | conformance | `DR-5` | Execute, then a non-recipient repudiates. |
| `a_DR9_irreversible_silent_release` | conformance | `DR-9` | Silence is not consent for an irreversible action. |
| `a_DR9_operator_confirms_own_action` | conformance | `DR-9` | The operator confirms their own action. |
| `a_DR1_hold_above_l28_ceiling` | conformance | `DR-1` | A hold above L-28's 3600 s ceiling, refused when the gate is built (v1.3.33; was DR-6's 120 s). |
| `a_DR9_approver_confirms_own_approval` | conformance | `DR-9` | Execute, then an approver in the verified quorum confirms. |
| `a_DR16_held_action_releases_on_silence` | conformance | `DR-16` | Execute, hold, release on silence. |
| `a_DR16_hold_past_the_ceiling` | conformance | `DR-16` | Hold until the ceiling, then hold again. |
| `a_DR16_hold_from_a_non_notified_party` | conformance | `DR-5` | Execute, then a non-recipient holds. |
| `a_DR16_ceiling_below_the_hold_window` | conformance | `DR-16` | A ceiling below one window, refused when the gate is built. |
| `a_DR16_held_to_the_ceiling_times_out` | conformance | `DR-9` | Hold, time out at the ceiling, then confirm: nothing is pending. |
| `a_DR17_machine_lifts_the_hold` | conformance | `DR-17` | Stop an operator, then a machine identity lifts it. |
| `a_DR17_operator_lifts_own_hold` | conformance | `DR-9` | Stop an operator, then the operator lifts it. |
| `a_DR17_hold_from_a_non_notified_party` | conformance | `DR-5` | One operator hold from outside the bundle's audience. |
| `a_DR18_one_person_declares_twice` | conformance | `DR-18` | One break-glass declaration by one person twice over. |
| `a_DR18_operator_declares_for_themselves` | conformance | `DR-18` | The operator is a declarant. |
| `a_DR18_machine_declares` | conformance | `DR-18` | A machine identity is a declarant. |
| `a_DR18_declarant_below_AS2` | conformance | `DR-18` | A declarant's authenticator is rated AS1. |
| `a_DR18_window_past_L34` | conformance | `DR-18` | A declared window past `break_glass_window_seconds`. |
| `a_DR18_release_outside_the_window` | conformance | `DR-18` | Declare, then release after the window. |
| `a_DR18_release_for_another_operator` | conformance | `DR-18` | Release under a declaration naming another operator. |
| `a_DR10_sampled_silent_release` | conformance | `DR-9` | A sampled reversible action released on silence. |
| `a_RV1_unclassified_action_defaults_irreversible` | conformance | `DR-9` | An unclassified action must not be releasable by silence. |
| `t_irreversible_requires_confirmation` | conformance | `DR-9` | Positive acknowledgement releases; nothing else does. |
| `t_honest_signed_ack_releases` | ack | — | Confirm, then release. |
| `t_honest_repudiation_blocks` | ack | `DR-4` | Repudiate, then release must fail. |
| `t_ACK5_replay_refused` | ack | `ACK-5` | An acknowledgement is single-use. |
| `t_sampling_forces_confirmation` | conformance | `DR-10` | A sampled reversible action inherits the confirmation duty, so an approver cannot learn that ignoring notifications is always safe. Injects a sampler to force the branch, then runs the sequence. |
| `t_DR6_decision_receipt_may_expire_during_the_hold` | conformance | `DR-6` | A decision receipt that expires mid-hold no longer blocks release (v1.3.33). |
| `t_DR9_relaxed_policy_lets_an_approver_confirm` | conformance | `DR-9` | Under the signed relaxation an approver's confirmation releases. |
| `t_DR16_a_held_action_releases_on_a_distinct_confirmation` | conformance | `DR-16` | Hold, extend by one window, confirm by a distinct person, release. |
| `t_DR17_operator_hold_until_a_person_lifts_it` | conformance | `DR-17` | A machine stops the operator; a person lifts it. |
| `t_DR18_two_as2_humans_declare_break_glass` | conformance | `DR-18` | Two AS2 humans declare for one hour. |
| `t_DR16_signed_hold_extends` | ack | `DR-16` | A signed hold, then silence refused. |
| `t_DR18_declared_operator_releases_on_silence` | conformance | `DR-18` | Declare, then release an irreversible action on silence. |
| `t_DR17_a_person_lifts_with_a_signed_lift` | ack | `DR-17` | Hold an operator, then a signed lift. |
| `t_DR17_a_machine_lift_is_refused` | ack | `DR-17` | Hold, then a machine's signed lift. |
| `t_DR17_the_operator_cannot_lift_own_hold` | ack | `DR-9` | Hold, then the operator's signed lift. |
| `t_HM2_a_person_confirms_a_release` | ack | `HM-2` | `confirm` with a WebAuthn assertion over `h(obj)`, then `release`: the human acknowledgement is a transition, and the release that follows it is a second call. |

**44 cases.**

---

## Obligation 2 — assertions about state, not verdicts

These reach their decision in one call, and then assert something about the
implementation's own records. A verdict is portable; a ledger is not.

| Case | Suite | What is asserted |
| --- | --- | --- |
| `t_DR10_cap_exhausted_releases_under_DR7` | conformance | DR-10 / L-36: a sampling miss counted, and the caller's per-attester counts left unchanged. |
| `t_DR12_asks_are_counted_per_attester` | conformance | DR-12 / L-37: the per-attester ask counts after a hold and a lever. |
| `t_dr13_irreversible_below_high_is_noticed` | conformance | The action **executes**, and a notice record naming the right recipients exists in the Executor's ledger beforehand. The verdict alone is indistinguishable from the defect it closes. |
| `t_deferred_holds_then_releases` | conformance | Released on silence **and** counted as an unverified release. |
| `t_PB10_alert_carries_its_signed_audience` | conformance | The replayed receipt is refused at `CL-2` **and** the alert is recorded with its PB-10 class and the recipients the signed bundle names for that class. PB-10's raise-time half is a positive-path obligation — deleting the record changes no verdict, so no mutant kills it — and this row is where that duty lands on a second implementation. |
| `t_the_gate_takes_its_hold_and_sampling_from_the_signed_bundle` | conformance | The gate's effective hold window and sampling percent equal the bundle's `limits.json` (PB-13): a configuration read, no proposal, no verdict. |
| `t_a_gate_with_no_bundle_gets_the_documents_numbers` | conformance | A gate built with no bundle carries 3600 / 60 / 10 (PB-13's absent rule at construction). |
| `t_a_persons_confirmation_faces_no_assurance_floor` | ack | §8.6c applies no AT-10 floor at the acknowledgement; the gap is held open as a passing test so that closing it is a visible change. |

**8 cases.** Each is worth reading closely by anyone building a second
implementation, because the verdict alone is exactly what the pre-fix code also
produced — "it executed", twice, and "it refused at CL-2" once. The whole content of
the check is in the record.

---

## Obligation 3 — structural properties of the deployment

The discriminator is which **code path** produced something, or how the deployment is
wired. No byte in any artifact carries it. This is the family the corpus is least able to
touch, and the one where the residual risk is highest.

| Case | Suite | Rule | The structure |
| --- | --- | --- | --- |
| `t_DR2_shared_render_library_is_not_caught_at_run_time` | conformance | `DR-2` | The realistic trap: renders honestly from canonical bytes and signs with its OWN notification key, but through the approval UI's renderer. One compromise lies to both channels at once, and no signature says which code drew the string — so since v1.3.25 the case asserts that the gate ACCEPTS it, and the obligation is what stands in place of the refusal. |
| `a_DR_notification_undeliverable` | conformance | `DR-8` | Delivery reaches fewer recipients than were named. |
| `a_DR_no_recipients` | conformance | `DR-8` | No reachable recipient at all. |
| `t_lying_screen_is_caught_by_notification` | conformance | `DR-4` | The positive form: a compromised approval screen is caught **because** the second channel renders the canonical bytes independently. |
| `a_DR1_hold_below_l28_floor` | conformance | `DR-1` | A deferred door configured with a hold window under 30 s is refused at construction (`HoldWindowBelowFloor`): the door's own configuration, not a proposal. |

**5 cases.** These are the rows classified `T` — trusted as transmitted — in
`dossier/02b-CLASSIFICATION-TABLE.md`, and they were why **T-32 was open** through
v1.3.24: the Executor took the notifier's word for the notifier's own independence. A
vector could not fix that, and neither could splitting the two services into separate
codebases. **v1.3.25 closes it for two of the three rows** (PB-11, DR-14): the bundle names
the two doors with keys, both summaries are signed Rendered Summary objects, and the
Executor verifies each under its door's key and binds it to its own proposal hash. What
that made vector-expressible is the identity and binding half — a summary signed by the
wrong door, by an unnamed key, or over another proposal's hash — and those cases are in
the conformance corpus now, classified in `CLASSIFICATION.md`.
`a_DR_notification_from_approval_chain` left this list with them: under DR-14 the object
it proxies from the approval chain is refused for its SIGNATURE rather than for a label it
chose, so its discriminator became serialisable and it is a vector. What stays an
obligation is the rendering half (no shared render path — a property of two code trees,
discharged by construction and by review, not by test) and `delivered`, which stays **T**
and bounded.

---

## Obligation 4 — environment and executor-local state

The discriminator is something the Executor knows or can reach, not something it was
handed. Note that this is not a weakness in the vector format — it is the **point** of
RES-8. A capability that could be asserted by an artifact would be a security value
accepted from the party being verified.

| Case | Suite | Rule | The state |
| --- | --- | --- | --- |
| `a_capability_revoked` | conformance | `9.3-9` | Authority revoked between issuance and execution. Live context, deliberately not transmissible. |
| `t_T29_no_anchor_no_release` | audit | `AU-7` | The anchoring service is unreachable. |
| `t_T29_anchor_drops_mid_release` | audit | `AU-7` | Reachable at the pre-check, gone before the terminal publish. |
| `t_AU8_genesis_anchor_down_fails_closed` | audit | `AU-8` | A tenant cannot be created without an anchored genesis. |
| `t_the_signature_counter_advances_in_the_ledger` | conformance | `HM-4 (f)` | Two executions under one credential with increasing counters; the ledger's stored counter after each is the assertion. |
| `a_HM4f_signature_counter_regresses` | conformance | `HM-4 (f)` | The second assertion's counter is below the stored one: `WebauthnCounter`. The stored value is ledger state the corpus cannot carry. |

**6 cases.** `t_T29_anchor_drops_mid_release` also carries a timing element no data file
expresses: the anchor must fail *between* two points in one release.

---

## Obligation 5 — the audit layer, in full

Beyond the 3 anchor-reachability cases above, the remaining audit cases assert counts
and orderings over sequences. **15 of the 17 audit cases are obligations** — every one
that asserts a count, an ordering or an environment; these are the other 12.

| Case | Rule | What must be shown |
| --- | --- | --- |
| `t_AU9_v1_3_33_records_chain` | `AU-9` | The three lever classes and a hashed ingress refusal chain (v1.3.33). |
| `t_DR16_hold_is_a_recorded_lever` | `DR-16` / `AU-9` | A hold is a `hold_extended` record; a pending refusal writes no `release`. |
| `t_release_record_is_written_once_at_the_terminal_answer` | §11.1 | One `release` record per action, at its terminal answer. |
| `t_DR18_release_under_declaration_is_one_record` | `DR-18` / `AU-7` | A declared release is one executed record, `acknowledged_by` empty, anchored. |
| `t_honest_release_counts_once` | `AU-7`, `AC-5` | The record is anchored **before** the release, and the operator's accumulator increments exactly once. Ordering is the whole claim. |
| `t_redrive_increments_once` | `DS-3` | Two releases of one logical action increment once. |
| `t_T28_repudiated_does_not_increment` | `AC-5` | Five actions attributed to a victim and repudiated leave the deny-effect accumulator at zero — and the victim is not locked out afterwards. |
| `t_T28_timeout_does_not_increment` | `AC-5` | A refusal does not increment. |
| `t_T29_post_anchor_rewrite_detected` | `AU-4` | The one rewrite that anchoring leaves possible is detected on reconciliation. |
| `t_T30_outage_suspends_sampling` | `AU-6` | During an anchoring outage, reversible actions demand zero acknowledgements while irreversible ones still demand theirs. |
| `t_AU8_genesis_survives_chain_destruction` | `AU-8` | A destroyed tenant chain still leaves evidence in the anchor. |
| `t_reconciliation_clean_on_honest_run` | — | An honest run reconciles with no findings. |

**12 cases here; 17 across the suite** — the other 5 being the 3 anchor-reachability cases
in Obligation 4 and the AU-1 chain derivation, which is vector-expressible. An
implementation may pass every vector in the corpus while having no audit chain at all.

---

## Obligation 6 — duties on the encoder

A vector supplies bytes and asks whether they are accepted. It cannot ask whether an
implementation **refuses to produce** something, or whether what it produces **fits a
bound**.

| Case | Suite | Rule | The duty |
| --- | --- | --- | --- |
| `t7_floats_refused_both_ways` | CBOR | `WE-1` | The decoder must refuse a float — that half **is** extractable and should be. The encoder must refuse to *emit* one, and that half is an obligation. |
| `t_receipt_fits_the_custody_limit` | conformance | `AB-6` | The worst-case receipt a deployment meets every day — a floor-HIGH quorum plus the operator's confirmation — must have a signed body at or under the custody cap (`RECEIPT_MAX_SIGNED_BYTES`, 4,096 bytes: the KMS `RAW` limit, executed in `tools/kms-compat-2026-08-22.json` and again in the current transcript, `tools/kms-compat-2026-08-24.json` (2026-08-24)) with the attestations bound beside it. A vector can present an oversized body and expect refusal, and `a_AB6_over_declared_cap` does; it cannot ask an implementation's own encoder to stay under the cap. And the number binds to the canonicalisation — the reference measures JSON modelling CBOR. |
| `t_the_refused_webauthn_corpus_replays` | conformance | `HM-3`, `HM-4` | Replays `refused_webauthn.json` in both languages' bytes through `verify_webauthn`: the fixed-shape canonical CBOR decoder refuses a non-canonical map and a fourth key, and the accepted vectors verify. The corpus is the shared data; its home is the crypto layer, not §9.3. |

**3 cases.** Small, and listed because dropping either would silently halve a check
written to run in both directions: the float is refused on decode *and* on encode, and
the cap is enforced on receipt *and* met on issue.

---

## Obligation 7 — the mutation suites

**79 mutants: 62 executor, 7 acknowledgement, 10 audit.**

The executor total moved 40 → 43 in v1.3.25 and the arithmetic is worth stating: four
were added (three for DR-14, one for PB-11) and one was REMOVED. The removed mutant
deleted the comparison between the notifier's self-declared render path and the approval
summary's. It died every time and was still not evidence of a control, because the attack
it caught was one that declined to lie about itself — finding T-32, and the reason a
killed mutant is only a claim about the attacks you enumerated.

These work by reading the implementation's own source, deleting a named check, rebuilding
it in a temp directory and asserting that the matching attack now **succeeds**. They are
the repository's evidence that its checks are load-bearing rather than decorative — the
answer to "how do you know that `if` does anything?"

**No data file can ask another implementation to delete a line of its own source.** A
second implementation must build its own mutation harness against its own source, or state
that it has not.

This is the largest single body of evidence that does not transfer, and it is the one most
likely to be quietly skipped, because a corpus-green implementation looks finished. Three
cautions carry over with it:

- **A check that kills no mutant is not a control** — but redundancy claims are claims
  about the attacks you enumerated.
- **Deletion mutants cannot catch a check that is present and means the wrong thing.**
- **Nothing at all catches a check that was never written.** Only an adversary who is not
  you does that.

---

## Obligation 8 — a lexeme the format does not carry

One case fails test (1) for a reason that is neither state nor structure: the
discriminating input is the *spelling* of a number, and JSON has one number type.

| Case | Suite | Rule | The input |
| --- | --- | --- | --- |
| `a_EL1_float_param_lowers_the_grade` | conformance | `8.3.1` | A Proposal parameter written `22.0` where the policy compares an integer. A conformant reader may hand it back as `22`, and the case evaporates into its own control. |

**1 case.** It had no row in this file at all — the 38-against-39 disagreement between
this file's Summary and `CLASSIFICATION.md`'s Totals (ACP-125) was this row, sitting in no
section. It is listed as an obligation on the classification's own reading, and the
classification's *binary, with notes* rule pulls the other way: a declared "re-spell as
non-integral" mutation in the VEC-3 vocabulary would make it expressible, and the row there
names exactly that. Which way it goes is a VEC-3 decision; until it is taken the case is a
duty on the implementation, not on the corpus.

---

## Rust evidence, named per obligation

ACP-46's acceptance line: *whatever is claimed here is added to this file as a
per-implementation obligation, with the Rust evidence named — an obligation with no named
evidence is a gap wearing a checkmark.* The Rust implementation lives in the product
repository (`ziffer`, private: `services/ledger`, `services/anchor`), and this table is the
engine-side record of what it has shown, **as of 2026-08-25**. *Offline* tests run with
nothing but cargo; *live* tests run against a real PostgreSQL (`tests/live.rs`, DSN from the
environment; an unset DSN skips loudly, and CI sets `ZIFFER_LIVE_REQUIRED=1` so a skip is
red there). `tools/mutate-store.py` in that repository deletes eight store-side checks in
turn and requires each one's live test red — 8/8 KILL, run by its CI.

| Obligation | Rule | Python case | Rust evidence (ziffer) |
| --- | --- | --- | --- |
| 1 | `CL-2` | `a_nonce_replay` | ledger offline `a_receipt_nonce_claims_exactly_once`; live `cl1_concurrent_claims_admit_exactly_one` (8 clients, one identifier, one winner), `claims_and_marks_survive_a_restart` |
| 1 | `CL-3` | `a_T14_attestation_replay` | ledger offline `t14_classes_are_distinct_namespaces`; the store's CHECK constraint refuses an unenumerated class |
| 1 | `DS-6f` | `a_Z3_origin_substitution` | ledger offline `z3_origin_binding_adopts_and_refuses`; live `z3_concurrent_binds_converge_on_one_nonce`, and the substitution after reopen inside the restart test |
| 1 | `RAD-3`, `DP-40` | `a_epoch_rollback` | ledger offline `t15_epoch_mark_is_ledger_state_not_client_state`, `dp40_the_two_marks_are_distinct`; live `dp40_the_mark_is_shared_across_instances_and_distinct_per_holder` — two instances alive at once over one mark, the case the plan names as the live mutant |
| 1 | `DP-37` | — (the reference ledger is in-process; no case) | ledger offline `dp37_an_unreachable_store_is_unavailable_at_connect`; live `dp37_a_lock_timeout_is_unavailable_not_a_miss` — a held row lock, a 300 ms statement timeout, `Unavailable` and never `AlreadyClaimed`, the identifier still claimable afterwards |
| 1 | `AU-2` | — (gaplessness is a store property; no case) | live `au2_concurrent_appends_are_gapless` — 8 appenders, dense 1..=8, every head recomputes |
| 4 | `AU-7` | `t_T29_no_anchor_no_release` | anchor offline `au7_high_release_fails_closed_without_anchor` |
| 4 | `AU-7` | `t_T29_anchor_drops_mid_release` | **not shown as such**: the Rust recorder has one terminal publish and no pre-check, so there is one point to drop at, and the case above is that point |
| 4 | `AU-8` | `t_AU8_genesis_anchor_down_fails_closed` | anchor offline `au8_genesis_refuses_when_anchor_is_down`; live `au8_a_refused_genesis_anchor_leaves_no_tenant` — the refused genesis leaves no row, the retry anchors once |
| 5 | `AU-7`, `AC-5` | `t_honest_release_counts_once` | anchor offline `au7_a_swapped_implementation_is_caught_by_reconciliation` (the swap test: fails when release precedes anchor), `au7_the_correct_ordering_reconciles_clean`, `ac5_counts_executions_once_and_locks`; live `au7_swap_is_caught_on_the_real_store` |
| 5 | `DS-3` | `t_redrive_increments_once` | the re-drive line of `ac5_counts_executions_once_and_locks` |
| 5 | `AC-5` | `t_T28_repudiated_does_not_increment`, `t_T28_timeout_does_not_increment` | refusal-does-not-increment is inside `ac5_counts_executions_once_and_locks`; **repudiation is not modelled in Rust** (DR-5 is ACP-47's) |
| 5 | `AU-4` | `t_T29_post_anchor_rewrite_detected` | anchor offline `a_rewritten_chain_disagrees_with_its_anchors`; live `res8_a_rewritten_record_is_caught_on_read`, `au2_a_renumbered_row_is_caught_on_read`, `au1_a_relinked_previous_hash_is_caught_on_read` (verify-on-read, each naming its row), and `a_truncated_head_is_caught_by_its_anchor` — the one edit verify-on-read cannot see, convicted by the anchor |
| 5 | `AU-6` | `t_T30_outage_suspends_sampling` | anchor offline `au6_sampling_suspends_during_outage` — the suspension only; the "irreversible ones still demand theirs" half waits on the DR gate (ACP-47) |
| 5 | `AU-8` | `t_AU8_genesis_survives_chain_destruction` | **partial**: the truncation test is the one-row form. Whole-chain destruction followed by re-genesis is a one-test addition, not yet written |
| 5 | — | `t_reconciliation_clean_on_honest_run` | anchor offline `au7_the_correct_ordering_reconciles_clean`; live `au8_genesis_is_anchored_once_and_the_chain_reopens` (reconciles clean after a restart) |
| 7 | — | 79 mutants | `tools/mutate-kms.py` 6/6 and `tools/mutate-store.py` 8/8 — the product repository's own harness against its own source, as this obligation requires |

**What the table does not claim.** The `DR-*` rows of Obligation 1 (release window,
repudiation, hold length) are ACP-47's and have no Rust evidence. Partition behaviour under a
real partition (CL-5, CL-6 across replicas) is shown only as concurrency over one store, not
as a partitioned quorum — `partition_suite.py` remains the only evidence of that shape. And
the live layer proves the client code against one PostgreSQL: DP-13's separate instances and
credential domains are a deployment property, not a test result.

---

## Summary

| Obligation | Cases |
| --- | ---: |
| 1 — sequences | 44 |
| 2 — assertions about state | 8 |
| 3 — structural properties of the deployment | 5 |
| 4 — environment and executor-local state | 6 |
| 5 — the audit layer (remainder) | 12 |
| 6 — duties on the encoder | 3 |
| 7 — mutation suites | *(79 mutants, no case rows)* |
| 8 — a lexeme the format does not carry | 1 |
| **Total cases** | **79** |

Vector-expressible: **106**. Obligations: **79**. Mutants, additionally: **79**.

The total is the number of rows classified `obligation` in `CLASSIFICATION.md`, and
`tools/selftest.sh` asserts that every such row has exactly one row here and that every
row here is such a row. The mutants are counted apart because they have no rows anywhere:
a mutant is a deletion in this implementation's source, not a case. Where a section counts
something narrower than the whole — Obligation 5 counts the audit cases that are not
already in Obligation 4 — it says so beside the number rather than being forced to agree.

---

## What an implementation should publish

Until VEC-6 (ACP-3) settles the format, the honest minimum is that a second
implementation claiming conformance states, separately:

1. Which vectors in the corpus it passes, and which it does not.
2. Which of the obligations above it has discharged, with what test, and where that test
   can be read.
3. Which it has **not** discharged. An unclaimed obligation is a disclosed gap. An
   undisclosed one is the defect this whole document exists to prevent.

A conformance claim that reports only (1) is reporting the smaller half.
