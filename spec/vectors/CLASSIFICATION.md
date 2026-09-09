# Vector classification — which suite cases can become shared data, and which cannot

**Against ZIFFER-SPEC-001 v1.3.31 · 140 cases across four suites · ACP-1 (VEC-1)**

This file classifies every case in the four suites that a shared vector corpus could
plausibly cover. It is the derivation behind [`OBLIGATIONS.md`](OBLIGATIONS.md); read that
one first if you only want to know what the corpus does **not** prove.

Nothing here is extracted yet. `spec/vectors/` contains this analysis and nothing else.
The count of vector-expressible cases is what sizes extraction (VEC-3/VEC-5); the
obligation list is what sizes VEC-6.

---

## The criterion

A case is **vector-expressible** when all three hold:

1. **Its discriminating input is serialisable.** The thing that decides the outcome lives
   in the bundle tree, the proposal, or the receipt and its attestations — as canonical
   bytes plus at most one declared mutation. Executor-local state, injected objects and
   environment availability do not qualify.
2. **It reaches the decision in one call.** One `execute`, or one `confirm`/`release`
   against a declared starting state. A case that must run twice is testing a
   *transition*, and a transition is not an input.
3. **Its expected outcome is a verdict.** Executes, or fails closed on a named rule.
   Not a ledger record, not a counter, not the identity of a code path.

Otherwise it is an **obligation**: something a conformant implementation must still
prove, on its own, with its own test.

The three tests are separable and it is worth saying which one fires, because they cost
different things to relax. Failing (2) or (3) is structural — no vector schema fixes it.
Failing (1) is sometimes a schema decision that has not been taken yet, and where that
is so the row says which decision.

**Binary, with notes.** There is no third bucket. Where a case is expressible only if the
vector schema grows a feature, it is classified vector-expressible and the note names the
feature — that is a VEC-2 input, not a hedge.

---

## What the corpus cannot carry, and what replaces it

**Signatures are not transportable, so no vector carries one.** This is not new — CLAUDE.md
has said so since v1.3.14 — but it is load-bearing here, because 119 of the 140 cases involve a signed artifact.
If it had no answer, the extractable count would be near zero rather than 92.

That 119 is the whole set minus the two suites that build no signed artifact at all:
the 8 canonical-CBOR cases, which are literal bytes with no keys anywhere, and
the 13 audit cases, which construct held actions directly. Every case in the conformance
and acknowledgement suites signs something.

The answer the repository already uses: **`HybridKey` derives both halves from its seed**,
so declared seed material reproduces the same keypair in any process, in any
implementation. A vector names seeds, not keys, and the consumer signs locally and
verifies locally. `HybridPub.fingerprint` gives the cross-implementation anchor that says
two implementations really did derive the same key:

```
HybridKey(b"k1").public().fingerprint
  == "sha256:38a223bddb2ee525211f7353bc4f578bf025996eeee3a550dc7ead5d0fdce7eb"
```

Verified across two processes while writing this — which is weaker than the sentence
above it claimed. Two Python processes are the same two libraries run twice, and cannot
detect a disagreement *between* libraries; "in any implementation" was an extrapolation.
It has since been carried across. `crates/acp-crypto/tests/python_interop.rs` derives from
the same seeds with `fips204` and `ed25519-dalek`, and gets Python's public key bytes back
on both halves, `k1`'s fingerprint `38a223bd…` included. So the claim holds — but it holds
because two crate stacks implement FIPS 204 Algorithm 6 and RFC 8032 faithfully, not
because a seed is self-describing.

That distinction is the corpus's problem, not the crypto's. **A vector that names a seed
and not the derivation names nothing.** `sha256(seed || "ed")` and `sha256(seed ||
"mldsa")` are wire format: an implementation that hashes the bare seed, or chooses its own
domain separators, derives a different identity and refuses every signature in the vector
— which at the verifier is indistinguishable from a forgery, and in a corpus report is
indistinguishable from a conformance failure it did not commit. VEC-2 must publish the
derivation beside the seed, and the seed alone is not a portable input.

That property is required by `sim.supervise` for an unrelated reason and CLAUDE.md forbids
removing it; the corpus now depends on it too.

This leaves a real limit. ML-DSA signing is hedged, so a vector can say *"sign this object
with the key from seed `k1`"* but never *"the signature is these bytes"*. Cases whose
discriminator is a signature therefore need a **declared mutation vocabulary** — `strip
primitive pq`, `replace primitive pq with zeros`, `add undeclared primitive`, `collapse to
scalar`, `re-sign with an unregistered seed`, `mutate field after signing`, and — for the
AB-4 pair — `withhold a presented entry` and `inject a presented entry`.
17 cases depend on that vocabulary existing; they are marked `sig-mutation` below, and the
count is derived from the marker.

---

## Suite 1 — conformance (102 cases: 20 positive, 82 attacks)

Where a case fails closed, the rule and the raising function were taken from a run, not
from the docstring.

### Positive path (20)

| Case | Class | Why |
| --- | --- | --- |
| `t_honest_high` | **vector** | One `execute`; verdict is executes + risk `HIGH`. Needs declared seeds for the quorum. |
| `t_honest_low` | **vector** | One `execute`, no attestations, verdict is executes + risk `LOW`. |
| `t_honest_redrive` | obligation | Two `execute` calls, and the assertion is that both return the **same** idempotency key. Equality across calls, not a verdict. |
| `t_deferred_holds_then_releases` | obligation | `execute` then `release`, and it asserts the gate's `unverified_releases` counter. Fails (2) and (3). |
| `t_deferred_low_risk_unaffected` | **vector** | One `execute`; verdict is executes with no hold. The gate is present but decides nothing. |
| `t_receipt_fits_the_custody_limit` | obligation | One `execute` and it executes — but that verdict is `t_honest_high`'s. What the case asserts is two byte lengths of the Executor's own canonical encoding: the signed body at or under `RECEIPT_MAX_SIGNED_BYTES` (4,096 — the KMS `RAW` cap, executed in `tools/kms-compat-2026-08-22.json` and again in the current transcript, `tools/kms-compat-2026-08-24.json` (2026-08-24)) with the full quorum bound beside it. A measurement, not a verdict — fails (3). And the number binds to `canon()`, which is JSON modelling the canonical CBOR AT-8a requires, so a vector carrying an expected length would encode the model: the Suite 7 note again. |
| `t_lying_screen_is_caught_by_notification` | obligation | Compares two rendered texts, then repudiates, then releases. The claim is about two code paths disagreeing — no artifact carries it. |
| `t_irreversible_requires_confirmation` | obligation | `execute` → `confirm` → `release`. |
| `t_sampling_forces_confirmation` | obligation | Injects a sampler (`lambda: 0.0`) to force a probabilistic branch, then runs a sequence. |
| `t_AT10_assured_quorum_executes` | **vector** | One `execute`; verdict is executes + risk `HIGH`, with the assurance map and floor as bundle data. Needs declared seeds for the quorum, like `t_honest_high`. |
| `t_dr13_irreversible_below_high_is_noticed` | obligation | One `execute`, but the assertion is that a notice record exists in the Executor's own ledger with the right recipients. State, not a verdict — fails (3). |
| `t_PB10_alert_carries_its_signed_audience` | obligation | Two `execute` calls — the second replays the first's receipt — and the assertion is that the resulting alert was recorded with its PB-10 class and with the recipients the signed bundle names for it. Fails (2) and (3) together, and for the reason DR-13's row above gives: the verdict is "refused at CL-2", which is what the pre-PB-10 code also did. The whole content of the check is in the record. |
| `t_the_gate_takes_its_hold_and_sampling_from_the_signed_bundle` | obligation | Asserts the gate's effective hold window and sampling percent equal the bundle's `limits.json` (PB-13). A configuration read, not a verdict over a proposal. |
| `t_a_gate_with_no_bundle_gets_the_documents_numbers` | obligation | The gate constructed with no bundle carries 3600 / 60 / 10. The absent-⇒-default rule of PB-13 at construction; no proposal, no verdict. |
| `t_a_person_approves_a_floor_high_action` | **vector** | One `execute`; verdict is executes + risk `HIGH`, the quorum satisfied by a `webauthn` entry (HM-1..HM-4). Needs the declared ES256 credential beside the machine seeds, and the assertion bytes are data: an authenticator's output is a fixed byte string once the key is declared. |
| `t_a_person_approves_with_an_ed25519_credential` | **vector** | The same with `webauthn-ed25519`; strict verification (ACP-106) under the human leg. |
| `t_a_human_leg_is_not_compared_against_the_suite_floor` | **vector** | One `execute` with the suite floor above what any human leg could carry; verdict is executes (CR-8). The floor is bundle data. |
| `t_the_signature_counter_advances_in_the_ledger` | obligation | Two `execute` calls with the same credential and increasing counters; asserts the ledger's stored counter after each (HM-4 (f)). Ledger state across calls, fails (2). |
| `t_the_refused_webauthn_corpus_replays` | obligation | Replays `refused_webauthn.json` in both languages' bytes through `verify_webauthn`. A crypto-layer corpus of its own, not a §9.3 vector; the corpus IS the shared data, and its home is `crates/acp-crypto/tests/vectors/`. |

| `t_DR2_shared_render_library_is_not_caught_at_run_time` | obligation | Was an ATTACK until v1.3.25, refused under `DR-2` because the notifier's self-declared render path matched the approval summary's. DR-14 accepts it and the specification says it must: a signature proves who rendered a summary and for which action, never that the prose is faithful, and independence of the two render paths is DR-2's STRUCTURAL requirement. The case now asserts the acceptance and compares the notification's text against the approval door's renderer — which is the identity of a code path, exactly what (3) excludes. Kept rather than deleted so the narrowing is visible. |

**Positive path: 7 vector · 13 obligation.**

### Attacks (82)

| Case | Class | Rule | Why |
| --- | --- | --- | --- |
| `a_Y1_misbinding` | **vector** | `9.3-7b-ii` | Receipt for P2 carrying P1's genuine quorum. Both artifacts. |
| `a_Y1b_garbage_id` | **vector** | `Y1b` | `attestation_id` field value. |
| `a_Y2_long_window` | **vector** | `L-14` | `expires_at` in the receipt; `_now` is already a declared receipt input. |
| `a_Y4_operator_swap` | **vector** | `AT-2` | Attestation `operator` vs receipt `operator`. Verified to fail closed under the *default* capability context, so the fixture's context change is scene-setting, not the discriminator. |
| `a_Z3_origin_substitution` | obligation | `DS-6f` | Two `execute` calls; the second is a re-drive whose claimed origin is compared against the ledger. |
| `a_Z4_optional_field` | **vector** | `AT-8b` | `sig-mutation`: add a null-valued field and re-sign. |
| `a_WE4_unprefixed_nonce` | **vector** | `WE-4` | `att_nonce` spelled without its `b64:` prefix, in an object signed correctly over that spelling. A string field value; the vector carries the object as signed. |
| `a_WE4_padding_stripped_nonce` | **vector** | `WE-4` | Prefix present, base64 padding gone. The same shape. |
| `a_WE4_urlsafe_alphabet_nonce` | **vector** | `WE-4` | The same 16 bytes in the RFC 4648 §5 alphabet: same length, different string. The vector must carry the string verbatim — a consumer that decoded and re-encoded the nonce would rebuild the honest object and test nothing. |
| `a_AT1_nonce_too_short` | **vector** | `AT-1` | A well-formed `b64:` value carrying 64 bits where AT-1 requires 128. A string field value. |
| `a_WE4_receipt_nonce_urlsafe_alphabet` | **vector** | `WE-4` | The RECEIPT nonce in the RFC 4648 §5 alphabet — the `att_nonce` case one field over (ACP-89), in a receipt signed over that spelling. A string field value that the vector must carry verbatim, for the reason the `att_nonce` row gives: a consumer that decoded and re-encoded it would rebuild the honest receipt and test nothing. Paired with the URL-safe spelling rather than the unprefixed one on purpose — a stripped prefix or stripped padding also changes the LENGTH, so `L-17` below refuses those, and pairing this case with them would report the WE-4 check redundant when it is not. |
| `a_L17_receipt_nonce_too_short` | **vector** | `L-17` | A well-formed `b64:` receipt nonce carrying 64 bits where 128 are required. `a_AT1_nonce_too_short`'s shape under the receipt nonce's OWN size clause: `L-17`, not `AT-1`, which sizes the attestation nonce — the receipt schema already cited `L-17` here while the reference enforced neither, so the schema refused receipts the reference accepted. A string field value. |
| `a_X1_risk_downgrade` | **vector** | `TR-8` | Receipt claims `risk_level_floor_only: LOW`. |
| `a_no_attestation` | **vector** | `INV-1-HIGH` | Empty attestation list. |
| `a_epoch_rollback` | obligation | `RAD-3` | Two `execute` calls with the Executor's bundle epoch rolled back between them. The control is a durable high-water mark — a property of the ledger across time. |
| `a_nonce_replay` | obligation | `CL-2` | Same receipt executed twice. |
| `a_T14_attestation_replay` | obligation | `CL-3` | Same attestations under two receipts, executed in sequence. |
| `a_AT2_self_approval` | **vector** | `AT-2` | Operator appears among approvers. |
| `a_AT3_partial_quorum` | **vector** | `AT-3` | One approval where the bundle requires two. |
| `a_ACP28_single_key_asserts_its_own_quorum` | **vector** | `AT-9` | Object states `required_count: 1`. |
| `a_AT9_attesters_signed_for_a_larger_quorum` | **vector** | `AT-9` | Object states `required_count: 3`; two presented. |
| `a_AT10_software_key_below_assurance_floor` | **vector** | `AT-10` | The discriminating input is signed registry data — `attester_assurance` and `min_attester_assurance` in the bundle. One `execute`, fails closed on a named rule. |
| `a_PBDISTINCT_one_key_two_identities` | **vector** | `PB-DISTINCT` | Refuses at bundle construction — zero Executor calls. Needs a **bundle-load verdict class** (`bundle-load`): the input is a bundle tree alone and the outcome is "refused at load". |
| `a_capability_revoked` | obligation | `9.3-9` | The discriminator is the Executor's live capability context. Nothing in any artifact distinguishes it. Fails (1) structurally — capability state is exactly what must *not* come from the party being verified. |
| `a_tampered_proposal` | **vector** | `9.3-3` | Proposal bytes differ from the receipt's `proposal_hash`. |
| `a_tampered_proposal_low` | **vector** | `9.3-3` | Same, at floor-LOW, where no quorum masks the missing rehash. |
| `a_DR_release_before_window` | obligation | `DR-1` | `execute` → `confirm` → `release`. |
| `a_DR_notification_from_approval_chain` | **vector** | `DR-14` | RE-CLASSED in v1.3.25, and the change of class is the finding. The discriminator was the notifier object's render path — a label the notifier chose, so deployment structure and not data. It is now the Notification's own signed bytes: the object proxied from the approval chain carries `role: presentation` and verifies under the presentation key. Needs `notification-as-data` (below). |
| `a_DR_notification_undeliverable` | obligation | `DR-8` | Discriminator is a notifier double whose `deliver()` returns fewer recipients than `recipients()`. |
| `a_DR_no_recipients` | obligation | `DR-8` | Notifier double returning an empty recipient list. |
| `a_DR_repudiation_by_outsider` | obligation | `DR-5` | `execute` then `repudiate`. |
| `a_DR_hold_outlives_receipt` | obligation | `DR-6` | Three calls under a legal 60 s hold, with a receipt that expires mid-hold — the expiry branch. |
| `a_DR_hold_exceeds_l14_ceiling` | obligation | `DR-6` | Gate construction alone: a 130 s hold is refused before any call — the configuration branch (ACP-146). |
| `a_DR9_irreversible_silent_release` | obligation | `DR-9` | `execute` then `release`. |
| `a_DR9_operator_confirms_own_action` | obligation | `DR-9` | `execute` then `confirm`. |
| `a_DR10_sampled_silent_release` | obligation | `DR-9` | Sampler injection plus a sequence. |
| `a_RV3_receipt_claims_reversible` | **vector** | `RV-3` | Receipt claims `REVERSIBLE`. Verified to refuse inside `execute` with **no gate present**, so despite its deferred-gate fixture this is a single-call artifact case. |
| `a_RV1_unclassified_action_defaults_irreversible` | obligation | `DR-9` | Bundle mutation, but the refusal only arrives at `release` — `execute` then `release`. |
| `a_DR13_no_notice_recipients` | **vector** | `DR-13` | Bundle omits `notice_targets` for an irreversible action graded below HIGH. One `execute`. Verified to fail closed under the default capability context too. |
| `a_RAD5_receipt_tenant_not_bundles` | **vector** | `9.3-8` | The bundle's `tenant_id` differs from the receipt's, while the receipt and the Proposal agree with each other. One `execute`, and every input is signed bundle or receipt data — the discriminator is a bundle field, like `a_CR4_incomparable_floor`. Needs declared seeds for the quorum. |
| `a_RAD5_bundle_names_no_tenant` | **vector** | `RAD-5` | Refuses at bundle construction — zero Executor calls, like `a_PBDISTINCT_one_key_two_identities`. Needs the same `bundle-load` verdict class: the input is a bundle tree alone and the outcome is "refused at load". |
| `a_PB10_alert_class_unaddressed` | **vector** | `PB-10` | `bundle-load`: the bundle's `alert_targets` omits one of PB-10's eleven classes. A bundle tree in, refused at load out. |
| `a_PB10_alert_audience_empty` | **vector** | `PB-10` | `bundle-load`: the class is present and its recipient list is empty. A separate vector from the row above, not a duplicate of it — a loader testing membership rather than emptiness passes one and fails the other, and only two inputs can tell those apart. |
| `a_DR14_notification_signed_by_wrong_door` | **vector** | `DR-14` | `notification-as-data`: the Notification is signed under the `presentation` key the bundle names, not the `notification` one. Every input is signed bytes — the bundle's `door_identities`, the receipt, the two Rendered Summary objects — and the outcome is a refusal on a named rule. |
| `a_DR14_notification_signed_by_unnamed_key` | **vector** | `DR-14` | `notification-as-data`: the Notification is signed under a well-formed key the bundle names nowhere. A separate vector from the row above, not a duplicate — one key belongs to the OTHER role, this one to no role, and an implementation resolving the key from the object rather than from the bundle passes this and fails nothing. |
| `a_DR14_notification_carrier_smuggles_a_field` | **vector** | `DR-14` | `notification-as-data`: a genuine Notification — right door, right action, valid signature — with one unsigned member (`source_path`, the field DR-14 withdrew) added to its carrier. The carrier is the schema's closed set, `{obj, sig}`; the reference had checked only `obj`'s. Found by the Rust door, which refused the shape first (ACP-47 run (a)). |
| `a_DR14_notification_for_another_proposal` | **vector** | `DR-14` | `notification-as-data`: both signatures are genuine and both doors are the real ones; the Notification's `proposal_hash` names a different Proposal. The discriminator is a field inside signed bytes, compared against the Executor's own hash of the held Proposal. |
| `a_DR14_approval_summary_signed_by_wrong_door` | **vector** | `DR-14` | `notification-as-data`: the approval summary — already an argument to `execute` — is signed under the `notification` key. The feature is still needed, because the case only reaches DR-14 with a Notification present. |
| `a_PB11_doors_share_a_key` | **vector** | `PB-11` | `bundle-load`: `door_identities.json` names one key under both roles. Refuses at bundle construction — zero Executor calls, like `a_PBDISTINCT_one_key_two_identities`, and for that row's reason one component over. |
| `a_PB11_door_absent` | **vector** | `PB-11` | `bundle-load`: the bundle names a presentation door and no notification door. Separate from the row above because a loader testing presence and a loader testing distinctness are two different loaders, and each passes the other's case. |
| `a_CR4_receipt_suite_downgrade` | **vector** | `CR-4` | Receipt `alg` is classical-only. |
| `a_CR4_attestation_suite_downgrade` | **vector** | `CR-4` | Attestation objects' `alg` is classical-only. |
| `a_CR4_incomparable_floor` | **vector** | `CR-4` | Bundle field `min_suite: slhdsa128s`; an ordinary hybrid receipt must not satisfy it. |
| `a_CR3_pq_signature_stripped` | **vector** | `9.3-1` | `sig-mutation`: strip the `pq` primitive. |
| `a_CR3_classical_signature_stripped` | **vector** | `9.3-1` | `sig-mutation`: strip the `classical` primitive. |
| `a_CR3_pq_forged_classical_genuine` | **vector** | `9.3-1` | `sig-mutation`: replace the `pq` primitive with zeros. |
| `a_CR3_extra_primitive` | **vector** | `9.3-1` | `sig-mutation`: add an undeclared third primitive. |
| `a_CR2_legacy_scalar_signature` | **vector** | `9.3-1` | `sig-mutation`: collapse the signature map to a bare string. |
| `a_ACP106_small_order_attester_key` | **vector** | `9.3-7b-i` | The registry entry is a small-order classical public key, the forged classical signature is fixed bytes (`R` the basepoint, `s = 1`), and the bundle sets `min_suite: ed25519`. Expressible, but not from a seed: no seed derives a small-order point, and the forgery is never produced by signing. `literal-bytes`: the vector must carry the public key and the signature verbatim — the shape `crates/acp-crypto/tests/vectors/refused_ed25519.json` already has. |
| `a_CR1_unknown_suite` | **vector** | `CR-4` | Receipt `alg: rot13`. |
| `a_EL1_float_param_lowers_the_grade` | obligation | `8.3.1` | A Proposal parameter written `22.0` rather than `22`. **Not vector-expressible, and the reason is the defect itself.** JSON has one number type, so a data file cannot pin the *lexeme*: a conformant reader may hand `22.0` back as an integer and the case evaporates into its own control. Carrying it needs either a format that preserves number spelling or a declared mutation — "re-spell this parameter as a non-integral number" — in the VEC-3 vocabulary. |
| `a_PR1_payload_smuggles_a_field` | **vector** | `PR-1` | The payload carries a sixth member (`sudo`) beside PR-1's five, and the receipt is signed over those bytes, so every step upstream of the payload check agrees. A field ADDED to the Proposal before signing — no mutation vocabulary needed, and the seed declaration already covers the signature. The verdict is the refusal *name*: `PR-1` in both implementations, and a vector checking only "refused" would pass against an Executor that refused it for having no risk function. |
| `a_PR1_root_smuggles_a_field` | **vector** | `PR-1` | The root carries a seventh member (`sudo`) beside PR-1's six, receipt signed over those bytes. The same shape as the row above one level up; classified the same way, and for the same reason — a field ADDED before signing, no mutation vocabulary needed. |
| `a_PBKEY_swapped_attester_registry` | **vector** | `9.3-4` | `sig-mutation`: the receipt is issued under a bundle whose attester registry differs, so its `policy_bundle_hash` no longer matches the Executor's. Needs the vector to carry two bundle trees, or one plus a declared registry mutation. |
| `a_AB1_kind_flipped` | **vector** | `AB-1` | `sig-mutation`: the receipt is issued over a confirmation entry, then that entry's `kind` is flipped to `approval` in the presented list — mutate field after signing. |
| `a_AB1_attester_rewritten` | **vector** | `AB-1` | `sig-mutation`: a presented entry's `attester` rewritten after the receipt is signed. |
| `a_AB4_attestation_withheld` | **vector** | `AB-4` | `sig-mutation`: one committed entry withheld from the presented list. Needs `withhold a presented entry` in the vocabulary. |
| `a_AB4_attestation_injected` | **vector** | `AB-4` | `sig-mutation`: an entry the receipt never committed to, appended to the presented list. Needs `inject a presented entry`. |
| `a_AB2_digests_unsorted` | **vector** | `AB-2` | `attestation_digests` issued in reverse order and signed as such. A field value in the receipt. |
| `a_AB3_duplicate_digests` | **vector** | `AB-3` | One entry presented twice and its digest listed twice, signed as such. The verdict is the refusal *name*: with AB-3 deleted this input is still refused — at CL-3 in this Executor, at AT-3 in `acp-decision` — so a vector that checked "refused" and not the clause would pass the deleted check. |
| `a_AB6_over_declared_cap` | **vector** | `AB-6` | `operator` padded to 4,000 bytes and signed as such; the body is over the declared cap. The discriminator is a byte length of the canonical encoding, so the vector must declare the canonicalisation — the Suite 7 note. |
| `a_AB0_v1_receipt_presented` | **vector** | `AB-0` | `receipt_version` absent. The suite deletes it after signing, but AB-0 refuses before the signature is examined — verified by corrupting the signature as well and getting the same rule — so the vector may carry the field-less body signed as such. |
| `a_DR1_hold_below_l28_floor` | obligation | `DR-1` | A gate constructed with a 29 s hold window is refused as `HoldWindowBelowFloor`. A construction-time refusal of the deferred door, not a verdict over a proposal. |
| `a_HM3_object_claims_an_alg_the_registry_does_not_hold` | **vector** | `WebauthnAlgMismatch` | `obj.alg` names a WebAuthn alg while the registry entry is `hybrid` (or the reverse): `WebauthnAlgMismatch` before any byte is parsed. Both artifacts. |
| `a_HM3_entry_carries_a_second_signature_primitive` | **vector** | `Malformed` | A `webauthn` entry's `sig` map carries a second primitive: `Malformed`. Entry bytes. |
| `a_HM4a_client_data_is_a_registration_ceremony` | **vector** | `WebauthnType` | `clientDataJSON.type` is `webauthn.create`: `WebauthnType`. Assertion bytes. |
| `a_HM4b_assertion_answers_another_challenge` | **vector** | `WebauthnChallenge` | The challenge is another id: `WebauthnChallenge`. Assertion bytes against the recomputed id. |
| `a_HM4c_assertion_was_made_on_another_site` | **vector** | `WebauthnOrigin` | `origin` is a lookalike host: `WebauthnOrigin`. The phishing case; assertion bytes. |
| `a_HM4d_authenticator_answered_for_another_relying_party` | **vector** | `WebauthnAuthenticatorData` | `rpIdHash` is another relying party's: `WebauthnAuthenticatorData`. |
| `a_HM4d_user_was_present_but_not_verified` | **vector** | `WebauthnAuthenticatorData` | UV flag clear: `WebauthnAuthenticatorData`. |
| `a_HM4e_assertion_signature_covers_another_action` | **vector** | `WebauthnSignature` | A genuine signature over another `authenticator_data`: `WebauthnSignature`. `sig-mutation` over the human leg. |
| `a_HM4f_signature_counter_regresses` | obligation | `WebauthnCounter` | The second assertion's counter is below the first's: `WebauthnCounter`. The stored counter is ledger state the corpus cannot carry; fails (2). |

**Attacks: 64 vector · 18 obligation.**

---

## Suite 5 — canonical CBOR (8 cases)

The most extractable suite in the repository: literal bytes in, accept or refuse out, no
keys and no state.

| Case | Class | Why |
| --- | --- | --- |
| `t1_canonical_roundtrip_accepted` | **vector** | Canonical bytes accepted and decoding to a stated value. |
| `t2_key_order` | **vector** | Map keys out of canonical order. |
| `t3_non_shortest_argument` | **vector** | Integer with a non-shortest argument. |
| `t4_indefinite_length` | **vector** | Indefinite-length array. |
| `t5_trailing_bytes` | **vector** | Valid item plus trailing garbage. |
| `t6_duplicate_keys` | **vector** | Two identical keys in one map. |
| `t7_floats_refused_both_ways` | obligation | Half of it is a vector — the decoder must refuse a `0xFB` double. The other half is that the **encoder must refuse to produce** a float, which no input-bytes vector can express. The case is listed as an obligation so the encoder duty is not lost; its decoder half should also be extracted. |
| `t8_two_encodings_one_value` | **vector** | Two vectors that must be read as a pair: the canonical encoding accepted, its non-canonical twin refused. Expressible, but the corpus must record the pairing or the point is lost. |

**Suite 5: 7 vector · 1 obligation.**

---

## Suite 9 — signed acknowledgement (17 cases)

Every case here starts from an action already held at the gate, and drives one
`confirm` or `release`. **All 17 therefore need the vector schema to admit a declared
`pending_release` precondition** — its fields are plain data, so this is a schema
decision for VEC-2, not a barrier. Cases below are classified on the assumption that the
decision goes that way; if it does not, all 17 become obligations.

| Case | Class | Why |
| --- | --- | --- |
| `t_honest_signed_ack_releases` | obligation | `confirm` then `release`. |
| `t_honest_repudiation_blocks` | obligation | `repudiate` then `release`. |
| `t_T31_bare_string_refused` | **vector** | The acknowledgement is a bare string rather than a signed object. |
| `t_T31_unregistered_identity_refused` | **vector** | `sig-mutation`: signed by a seed the bundle does not register. |
| `t_T31_forged_signature_refused` | **vector** | `sig-mutation`: right identity, unregistered seed. |
| `t_T31_identity_swap_refused` | **vector** | `sig-mutation`: rewrite `acknowledger` after signing. |
| `t_T31_operator_cannot_self_confirm` | **vector** | The acknowledger is the operator named in the held action. |
| `t_ACK3_wrong_proposal_refused` | **vector** | Acknowledgement bound to a different proposal hash. |
| `t_ACK5_replay_refused` | obligation | The same acknowledgement presented twice. Single-use is a transition. |
| `t_ACK6_expired_refused` | **vector** | Declared `now` past the acknowledgement's expiry. |
| `t_ACK6_long_window_refused` | **vector** | `sig-mutation`: over-long `expires_at`, re-signed. |
| `t_ACK1_open_schema_refused` | **vector** | `sig-mutation`: extra field added and re-signed. |
| `t_ACK1_decision_confusion_refused` | **vector** | A `REPUDIATE` object presented to `confirm`. |
| `t_timeout_still_fails_closed` | **vector** | One `release` with no acknowledgement present; verdict `DR-9`. |
| `t_HM2_a_person_confirms_a_release` | obligation | `confirm` with a WebAuthn assertion over `h(obj)` (HM-2's acknowledgement rule), then `release`. |
| `t_HM4_a_persons_confirmation_from_another_site_is_refused` | **vector** | The confirmation's assertion carries another origin: refused under `HM-4 (c)`. A signed object, refused by name. |
| `t_a_persons_confirmation_faces_no_assurance_floor` | obligation | Asserts, as a passing test, that §8.6c applies no AT-10 floor at the acknowledgement: the gap is held open on purpose so closing it is a visible change. A property of the reference, not a verdict. |

**Suite 9: 12 vector · 5 obligation.**

---

## Suite 7 — audit, anchor, accumulator (13 cases)

**11 of the 13 are not vector-expressible, and that was the clearest result in the file
until a twelfth case was added for a reason worth recording — and a thirteenth, for the same reason.**
The audit layer's claims are all of the form *"after this sequence, the count is N"*,
*"the anchor was published before the release"*, or *"the chain reconciles against the
anchor"*. Every one fails test (2) or (3), and several also fail (1) because the
discriminator is whether an external anchor service is reachable.

| Case | Class | Why |
| --- | --- | --- |
| `t_honest_release_counts_once` | obligation | Asserts an accumulator count **and** that the anchor covers the record before release. Ordering. |
| `t_redrive_increments_once` | obligation | Two hold/release cycles sharing one action id; asserts the count is 1. |
| `t_T28_repudiated_does_not_increment` | obligation | Five cycles with repudiations, then a sixth to prove the victim is not locked out. |
| `t_T28_timeout_does_not_increment` | obligation | Asserts a counter stayed at zero after a refusal. |
| `t_T29_no_anchor_no_release` | obligation | Discriminator is anchor reachability — environment, not data. |
| `t_T29_anchor_drops_mid_release` | obligation | Monkeypatches the anchor to fail between the pre-check and the terminal publish. Timing. |
| `t_T29_post_anchor_rewrite_detected` | obligation | Rewrites committed chain records, then reconciles. |
| `t_T30_outage_suspends_sampling` | obligation | Eleven holds during an outage; counts acknowledgement demands. |
| `t_AU8_genesis_survives_chain_destruction` | obligation | Destroys a chain and checks the anchor still holds evidence. |
| `t_AU8_genesis_anchor_down_fails_closed` | obligation | Tenant construction with the anchor down. |
| `t_reconciliation_clean_on_honest_run` | obligation | Full cycle, then reconciliation returns no findings. |
| `t_AU1_clause_derives_the_implementation_head` | **vector** | The exception, and the only case here that is a pure function: records in, chain heads out. No anchor service, no ordering, no counter — it derives AU-1 and AU-8 from the clause text and compares. Needs the schema to carry an **expected digest** (Suite 5's `t1` already expects a stated value, so this is not a new kind) **and a declared canonicalisation**, which is the load-bearing one: see the note below. |
| `t_AU9_off_class_record_refused` | **vector** | The same shape as the row above: a record in, a refusal out. AU-9's four off-class shapes — a class outside the seven, a `hold` without its `receipt_nonce`, a member outside the class's set, a writer-placed `seq` — each refused BEFORE the record is hashed, so the head does not move. A pure function of the record and the clause; no anchor, no ordering, no counter. Needs only what a conformance vector already carries: the input and the expected refusal name. |

**Suite 7: 2 vector · 11 obligation.**

*The note.* This case is expressible but **not yet extractable**, and the obstacle is
not the schema. A shared vector would carry a literal digest, and a digest binds to
whatever produced it — while `reference/src/acp_executor.py:canon()` is sorted-key JSON
*modelling* the canonical CBOR AT-8a actually requires, as its own docstring says. So a
vector extracted today would encode the model rather than the clause, and a conformant
implementation hashing real RFC 8949 bytes would fail it while being right. That is the
same shape as the defect this case exists to catch, one level up, so it is recorded here
rather than discovered during extraction. **VEC-2 input: extract this case only after the
audit chain hashes canonical CBOR, or declare the canonicalisation in the vector.**

---

## Totals

| Suite | Cases | Vector-expressible | Obligation |
| --- | ---: | ---: | ---: |
| Conformance (Suite 1) | 102 | 71 | 31 |
| Canonical CBOR (Suite 5) | 8 | 7 | 1 |
| Signed acknowledgement (Suite 9) | 17 | 12 | 5 |
| Audit / anchor / accumulator (Suite 7) | 13 | 2 | 11 |
| **Total** | **140** | **92** | **48** |

Plus **61 mutation cases** — 48 executor, 6 ack, 7 audit — which are obligations by
definition and get no per-case rows: a mutant deletes a line of the implementation's own
source, and no data file can ask another implementation to do that. They are the
repository's evidence that its checks are load-bearing, and that evidence does not
transfer. VEC-6 must ask each implementation to produce its own.

**92 of 140 cases, or 66%, could become shared data.** What they depend on, none of it
built:

- the seed-declaration mechanism above: 83 vectors, every vector-expressible case in the
  two suites that sign. The other 9 carry no key material: the 7 canonical-CBOR vectors are
  literal bytes, and AU-1's chain derivation is blocked on the canonicalisation note in
  Suite 7 instead;
- a declared signature-mutation vocabulary: 17 vectors, marked `sig-mutation`;
- a `pending_release` precondition block: 12 vectors, every vector-expressible case in
  Suite 9;
- a bundle-load verdict class: 6 vectors, marked `bundle-load` — one from ACP-53's registry case, three from v1.3.23's, and two from v1.3.25's PB-11 pair, which is what turned a one-off into a class the schema has to name;
- a **notification-as-data** class, marked `notification-as-data`: the Notification
  (`spec/schemas/wire/notification.schema.json`) supplied as an artifact rather than produced
  by an injected notifier, plus a `held` outcome beside `executes` and `refused`. Deliberately
  carries no count here: nothing derives this marker yet, and a number typed by hand beside
  five that are derived is the defect the correction below records. The rows are the list.
- literal key and signature bytes in place of a seed: 1 vector, marked `literal-bytes`.

A correction worth recording: this paragraph said forty-nine of the fifty vectors depended
on the seed mechanism. The canonical-CBOR vectors never did — Suite 5 says so two screens
up — and the sentence was written by hand against a table it did not re-read. Every count
in this file is now derived from its rows and asserted by `tools/selftest.sh`, which also
insists that every case in the four suites has a row — fourteen conformance cases had
none when that assertion was first run, under a suite header that had been synced to the
suite's true size (ACP-125). `tools/sync-counts.sh` rewrites the numbers. The split
itself stays a judgement made per case.

---

## Out of scope, deliberately

Four suites were classified because those four are what ACP-1 names. The gate runs more,
and their absence here is a scope boundary, not a judgement that they are covered:

- **`attack_registry.py` (124)** — the consolidated registry, which re-runs cases from the
  suites above. Classifying it would double-count.
- **`partition_suite.py` (13)** and **`partition_integration.py` (9)** — ledger partition
  behaviour. Sequences and failure injection throughout; expect close to 0 vectors.
- **`llm_agent_suite.py` (44)** — the live-agent client, not the Executor's decision path.
- **`research_bundle.py --attacks` (4)** and **`art_harness.py`** — domain and external
  corpus. The harness reports findings rather than asserting verdicts.
- **`cbor_suite.py` mutation counterparts** — there are none; Suite 5 has no mutants.

If the corpus is meant to cover the partition suites, that is a separate classification
and should be its own ticket.
