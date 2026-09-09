/**
 * The refusal names, spelled EXACTLY as the engine's Rust clause constants
 * spell them (crates/acp-decision/src/{receipt,decide,quorum}.rs at the pin).
 *
 * This is the third implementation of receipt verification, and the clause a
 * refusal carries is what the three are compared ON: two verifiers that both
 * refuse a forged, expired receipt -- one saying 9.3-1, the other 9.3-5 --
 * have not been shown to agree on anything an operator could act on
 * (decide.rs module doc). So every name here is a wire contract, not a label,
 * and a constant may change only when the engine's does.
 *
 * The Rust constant NAME is kept beside each value so a reader diffing the two
 * files sees one table, not two vocabularies.
 */

/** Rust `receipt::CLAUSE_VERSION` -- AB-0, the receipt does not declare version 3. */
export const CLAUSE_VERSION = 'AB-0';
/** Rust `receipt::CLAUSE_BODY_SIZE` -- AB-6, the signed body exceeds the custody byte cap. */
export const CLAUSE_BODY_SIZE = 'AB-6';
/** Rust `receipt::CLAUSE_UNKNOWN_SUITE` -- CR-1, the suite name is not one this build knows. */
export const CLAUSE_UNKNOWN_SUITE = 'CR-1';
/** Rust `receipt::CLAUSE_SUITE_FLOOR` -- CR-4, the suite does not contain every floor primitive. */
export const CLAUSE_SUITE_FLOOR = 'CR-4';
/** Rust `receipt::CLAUSE_CANONICAL` -- AT-8a, the structure is not canonically encodable. */
export const CLAUSE_CANONICAL = 'AT-8a';
/** Rust `receipt::CLAUSE_SIGNATURE` -- 9.3-1, the signature did not verify under the bundle key. */
export const CLAUSE_SIGNATURE = '9.3-1';
/** Rust `receipt::CLAUSE_DECISION` -- 9.3-2, the decision was not ALLOW. */
export const CLAUSE_DECISION = '9.3-2';
/**
 * Rust `decide.rs` spells 9.3-3 as a literal at the refusal site, not a
 * constant; the value is the contract either way. Receipt not bound to this
 * proposal (B-1a).
 */
export const CLAUSE_PROPOSAL_BINDING = '9.3-3';
/** Rust literal in `decide.rs` step 5 -- temporal position (missing, malformed, expired, future). */
export const CLAUSE_TEMPORAL = '9.3-5';
/**
 * Rust literal in `decide.rs` step 5 -- L-14, the validity-window ceiling.
 * A SEPARATE clause from 9.3-5: a receipt whose window is 10x too long is an
 * attacker widening the interval a stolen receipt is usable in (Y2), and
 * calling that "expired" would tell an operator the wrong thing.
 */
export const CLAUSE_VALIDITY_WINDOW = 'L-14';
/** Rust `quorum::CLAUSE_WIRE_TYPE` -- WE-4, the nonce is not `b64:` + RFC 4648 s4 base64. */
export const CLAUSE_WIRE_TYPE = 'WE-4';
/**
 * Rust `decide::CLAUSE_RECEIPT_NONCE_SIZE` -- L-17, the receipt nonce is
 * well-formed but not 128-bit. The receipt nonce's OWN size clause, never
 * AT-1 (which sizes the attestation nonce): one number, two clauses, and the
 * refusal carries the field's (ACP-88/ACP-89).
 */
export const CLAUSE_RECEIPT_NONCE_SIZE = 'L-17';
