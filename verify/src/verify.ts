/**
 * The §9.3 stateless receipt gate -- the THIRD implementation, after the
 * Python reference (`acp_executor.py`) and Rust (`crates/acp-decision`), both
 * at the engine pin. Composed in the order `decide.rs` states, because on an
 * input carrying more than one defect the ORDER decides which clause fires,
 * and the clause is what a refusal tells an operator.
 *
 * # What is here, and what is NOT -- read this before trusting a green run
 *
 * This function covers exactly the checklist portion runnable with only
 * receipt + proposal + identity (the ACP-197 runbook's stateless set):
 *
 * | step | rule | here |
 * | --- | --- | --- |
 * | -- | AB-0 receipt version, AB-5 signed-body exclusion, AB-6 byte cap | yes |
 * | 1-2 | CR-1 / CR-4 / CR-3 conjunctive, then `decision` | yes |
 * | 3 | `proposal_hash` recomputed from the caller's own bytes (B-1a) | yes |
 * | 4 | policy basis (bundle hash, epoch) | NO -- needs the verifier's bundle |
 * | 5 | temporal position (9.3-5) and the L-14 window ceiling | yes |
 * | 6 | nonce WE-4 type and L-17 size | yes; the CL-2 single-use CLAIM is ledger state |
 * | 7 | TR-8 / RV-3 recomputation | NO -- needs the signed policy |
 * | 7b | the AT-* quorum, AB-1..AB-4 | NO -- needs the attester registry |
 * | 8 | tenant scoping | NO -- needs the bundle's tenant |
 * | 9-10 | capability recheck, delivery identity | NO -- absent in the engine too |
 *
 * An absent step is a DIVERGENCE, not an agreement: a receipt this function
 * passes may still be refused by a full Executor at any absent step. A pass
 * here means "the stateless set found nothing", never "the receipt may be
 * consumed".
 *
 * # R / B / T classification (suite 12) for the inputs this module reads
 *
 * | input | class | why |
 * | --- | :---: | --- |
 * | `identity` (keys, floor) | R | the verifier's own configuration, never the message's |
 * | signed bytes | R | canonicalised HERE from the receipt body (RES-9) |
 * | `proposal_hash` | R | recomputed from `proposalBytes`, the caller's own copy; the receipt's field is compared, never used |
 * | `alg`, `sig`, `decision`, temporal fields, `nonce`, `receipt_version` | B | inside (or selecting) the signed body; each is read only in a position where reading it can at most cause a refusal |
 * | `nowUnixSeconds` | T | the caller's clock. Nothing here can check it; a stale or forward value silently voids the expiry and skew checks (the engine's residual 3, verbatim). Only L-14 survives such a caller, because it compares the receipt's two instants against each other |
 */

import { createHash } from 'node:crypto';

import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

import { canon } from './canon.js';
import {
  CLAUSE_BODY_SIZE,
  CLAUSE_CANONICAL,
  CLAUSE_DECISION,
  CLAUSE_PROPOSAL_BINDING,
  CLAUSE_RECEIPT_NONCE_SIZE,
  CLAUSE_SIGNATURE,
  CLAUSE_SUITE_FLOOR,
  CLAUSE_TEMPORAL,
  CLAUSE_UNKNOWN_SUITE,
  CLAUSE_VALIDITY_WINDOW,
  CLAUSE_VERSION,
  CLAUSE_WIRE_TYPE,
} from './clauses.js';
import { verifyEd25519Strict } from './ed25519.js';
import { parseInstant } from './instant.js';
import { Refusal } from './refusal.js';
import {
  parseSuite,
  satisfiesFloor,
  suitePrimitives,
  verifyHybrid,
  type Primitive,
  type PrimitiveVerdict,
  type Suite,
} from './suite.js';

/** AB-0 (§8.6b): version 3, the digest-bound form, and NO other. A verifier
 * accepting both 2 and 3 lets an attacker present the weaker one -- the CR-4
 * downgrade shape with the format negotiated by the party under verification. */
export const RECEIPT_VERSION = 3;

/** AB-5: the signed body is the transport object MINUS these keys. ONE list --
 * a second exclusion site would be a second definition of "the signed body". */
export const SIGNED_EXCLUDE: readonly string[] = ['sig', 'attestations'];

/** AB-6: the KMS RAW cap; a bigger body could only come from a software key,
 * so accepting one admits a custody downgrade silently. Counted in BYTES. */
export const RECEIPT_MAX_SIGNED_BYTES = 4096;

/** Step 5's tolerated clock skew, seconds -- the reference's `iat > now + 5`. */
export const CLOCK_SKEW_SECS = 5;

/** L-14's ceiling on a receipt's validity window, seconds. */
export const MAX_VALIDITY_WINDOW_SECS = 120;

/** FIPS 204 ML-DSA-65 public key length. */
export const MLDSA65_PK_LEN = 1952;
/** FIPS 204 ML-DSA-65 signature length. */
export const MLDSA65_SIG_LEN = 3309;

/** The one wire nonce size, 128-bit (`Nonce128`, cited by AT-1 and L-17). */
export const NONCE128_BYTES = 16;
/** `"b64:"` plus base64 of 16 bytes: 4 + 24. Counted, never decoded -- a rule
 * whose behaviour on bad input is "throw" is not a refusal. */
export const NONCE128_LEN = 4 + Math.ceil(NONCE128_BYTES / 3) * 4;

/**
 * The verifier's own trust anchor: the receipt signing keys from the SIGNED
 * bundle (`receipt_identity`, PB-12) and the bundle's suite floor
 * (`manifest.min_suite`, CR-4).
 *
 * Both key halves, because hybrid composition is conjunctive (CR-3): a
 * verifier holding only the classical key could not tell a stripped
 * post-quantum leg from a suite that never had one. Every field is the
 * VERIFIER's configuration -- reading any of it from the receipt would be
 * RES-8, the five-times-recurred defect class this protocol exists to close.
 */
export interface TrustAnchor {
  /** Ed25519 verification key, 32 raw bytes. */
  readonly classical: Uint8Array;
  /** ML-DSA-65 verification key, 1,952 raw bytes. */
  readonly pq: Uint8Array;
  /** CR-4 floor, by wire suite name, from the signed manifest. */
  readonly minSuite: string;
}

/** What the stateless set concluded, when it concluded anything. */
export interface Verified {
  /** This verifier's OWN canonical hash of the proposal -- the value the
   * receipt's claim was compared against, never the claim itself (R). */
  readonly proposalHash: string;
  /** The receipt's `expires_at` as step 5 validated it, epoch seconds (B). */
  readonly receiptExpiresAt: number;
}

/** Options for {@link verifyReceipt}. */
export interface VerifyOptions {
  /**
   * The verifier's clock, epoch seconds. Defaults to this process's
   * `Date.now()`. A parameter for the reason `decide()` makes it one --
   * a verifier taking its notion of the present from the party it verifies
   * would be RES-8 with a clock -- and classified T either way (residual 3).
   */
  readonly nowUnixSeconds?: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function strField(v: Record<string, unknown>, key: string): string | null {
  const raw = v[key];
  return typeof raw === 'string' ? raw : null;
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Decode a hex signature leg, refusing exactly as decide.rs's `unhex`. */
function unhex(s: string): Uint8Array {
  if (s.length % 2 !== 0) {
    throw new Refusal(CLAUSE_SIGNATURE, 'signature hex has odd length');
  }
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) {
    const byte = Number.parseInt(s.slice(i, i + 2), 16);
    // parseInt would tolerate "0x", whitespace and a lone valid first digit;
    // requiring both chars to be hex keeps this as strict as Rust's
    // from_str_radix over a 2-char slice.
    if (Number.isNaN(byte) || !/^[0-9a-fA-F]{2}$/.test(s.slice(i, i + 2))) {
      throw new Refusal(CLAUSE_SIGNATURE, 'signature is not hex');
    }
    out[i / 2] = byte;
  }
  return out;
}

/**
 * WE-4: is this the ASCII string `b64:` followed by RFC 4648 §4 base64, WITH
 * padding? Ported from `quorum.rs::is_we4_b64` -- the body is whole
 * four-character groups, the alphabet is §4's (`+` and `/`, never §5's `-` and
 * `_`), and `=` appears only as one or two characters at the very end.
 * Rejected, never normalised: normalising would make this verifier accept two
 * spellings of one nonce, which is how one nonce comes to hold two ledger
 * slots (ACP-87).
 */
export function isWe4B64(s: string): boolean {
  if (!s.startsWith('b64:')) return false;
  const body = s.slice(4);
  if (body.length % 4 !== 0) return false;
  let pad = 0;
  for (let i = body.length - 1; i >= 0 && body[i] === '='; i -= 1) pad += 1;
  if (pad > 2) return false;
  for (let i = 0; i < body.length - pad; i += 1) {
    const c = body.charCodeAt(i);
    const alnum =
      (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a);
    if (!alnum && c !== 0x2b /* + */ && c !== 0x2f /* / */) return false;
  }
  return true;
}

/** One primitive's signature as presented on the wire. */
interface SignaturePart {
  readonly primitive: Primitive;
  readonly bytes: Uint8Array;
}

/**
 * Parse a wire `sig` object into the parts the CR-3 combiner verifies --
 * `decide.rs::parse_sig`, including its rule that the key set must be EXACTLY
 * the suite's. Three attacks live in the difference: a scalar `sig` (format
 * confusion is a downgrade in disguise), a missing primitive (the stripped
 * leg), and an extra undeclared primitive (an accepted code path the attacker
 * chose). An unknown primitive name is refused rather than dropped -- a
 * dropped part would let a suite be satisfied by the parts that remain.
 */
function parseSig(sig: unknown, alg: string): SignaturePart[] {
  // CR-1 first: an unparseable suite has no primitive set at all, so asking
  // which primitives it requires would be a category error.
  const suite = parseSuite(alg);
  if (suite === null) {
    throw new Refusal(CLAUSE_UNKNOWN_SUITE, 'unknown signature suite');
  }
  if (!isRecord(sig)) {
    throw new Refusal(CLAUSE_SIGNATURE, 'receipt signature is not a per-primitive object');
  }
  const required = suitePrimitives(suite);
  const keys = Object.keys(sig);
  if (keys.length !== required.length || !required.every((p) => keys.includes(p))) {
    throw new Refusal(
      CLAUSE_SIGNATURE,
      'signature primitives are not exactly those the declared suite requires',
    );
  }
  const parts: SignaturePart[] = [];
  for (const primitive of required) {
    const value = sig[primitive];
    if (typeof value !== 'string') {
      throw new Refusal(CLAUSE_SIGNATURE, 'signature value is not a hex string');
    }
    parts.push({ primitive, bytes: unhex(value) });
  }
  return parts;
}

/**
 * Verify one ML-DSA-65 signature. Never throws; length checks first, exactly
 * as `primitives.rs` -- a malformed input is `invalid`, never `unsupported`:
 * one is a statement about the signature, the other about this build, and
 * reporting one as the other sends the investigation to the wrong place.
 */
function verifyMlDsa65(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): PrimitiveVerdict {
  if (publicKey.length !== MLDSA65_PK_LEN || signature.length !== MLDSA65_SIG_LEN) {
    return 'invalid';
  }
  try {
    // Empty FIPS 204 context, matching both engine sides (MLDSA_CTX = &[]):
    // a context the signer did not use is a different message.
    return ml_dsa65.verify(signature, message, publicKey) ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

/**
 * The §9.3 gate steps 1-2 with CR-1/CR-4/CR-3 -- `receipt.rs::verify_receipt`.
 *
 * CR-4 runs BEFORE the signature: the floor exists to rule out PRIMITIVES,
 * not forgeries, and `CR-4` says the deployment's policy was not met, which is
 * a different fact from "this signature is bad". Step 2 (`decision`) is LAST
 * among the cryptographic checks: a receipt whose signature does not verify is
 * not evidence of anything, including of its own decision field.
 */
function verifyReceiptGate(
  alg: string,
  floor: Suite,
  identity: TrustAnchor,
  signedBytes: Uint8Array,
  parts: readonly SignaturePart[],
  decision: string,
): void {
  const suite = parseSuite(alg);
  if (suite === null) {
    throw new Refusal(CLAUSE_UNKNOWN_SUITE, 'unknown signature suite');
  }
  if (!satisfiesFloor(suite, floor)) {
    throw new Refusal(
      CLAUSE_SUITE_FLOOR,
      'signature suite does not contain every primitive of the bundle floor',
    );
  }
  const verdicts: (readonly [Primitive, PrimitiveVerdict])[] = parts.map((part) => {
    switch (part.primitive) {
      case 'classical':
        return [
          part.primitive,
          verifyEd25519Strict(identity.classical, signedBytes, part.bytes) ? 'valid' : 'invalid',
        ];
      case 'pq':
        return [part.primitive, verifyMlDsa65(identity.pq, signedBytes, part.bytes)];
      case 'pq-slh':
        // Declared, not implemented. Never a pass, and never silently dropped
        // from the set either -- dropping it would let a suite naming it be
        // satisfied by the primitives that remain.
        return [part.primitive, 'unsupported'];
    }
  });
  const err = verifyHybrid(suite, verdicts);
  if (err !== null) {
    throw new Refusal(CLAUSE_SIGNATURE, err);
  }
  if (decision !== 'ALLOW') {
    throw new Refusal(CLAUSE_DECISION, 'decision is not ALLOW');
  }
}

/**
 * Run the stateless half of §9.3 in specification order over one receipt.
 *
 * @param receiptJson  the receipt as parsed JSON (`unknown`: this module does
 *                     its own narrowing and refuses by name, never casts).
 * @param proposalBytes the Proposal THE CALLER received, as bytes. The hash is
 *                     recomputed from these -- a transmitted identifier is a
 *                     name for a binding, not evidence of one (RES-9/TR-10).
 * @param identity     the verifier's trust anchor (keys + floor), out-of-band.
 * @throws Refusal     with `clause` spelled exactly as the engine's constants.
 */
export function verifyReceipt(
  receiptJson: unknown,
  proposalBytes: Uint8Array,
  identity: TrustAnchor,
  opts?: VerifyOptions,
): Verified {
  const floor = parseSuite(identity.minSuite);
  if (floor === null) {
    // The anchor is the verifier's own configuration; an unknown floor is a
    // misconfiguration, refused under CR-1's name rather than defaulted --
    // there is no default suite for the reason there is no default tenant.
    throw new Refusal(CLAUSE_UNKNOWN_SUITE, 'trust anchor names an unknown suite floor');
  }
  const now = opts?.nowUnixSeconds ?? Date.now() / 1000;

  // ------------------------------------------------------------- AB-0
  // Version 3 ONLY, checked before the signature so a version-2 receipt is
  // named as a version failure rather than a confusing signature mismatch.
  // On a non-object input the version read yields undefined and AB-0 fires
  // first, matching Rust's `.get()` on a non-object Value.
  const version = isRecord(receiptJson) ? receiptJson['receipt_version'] : undefined;
  if (version !== RECEIPT_VERSION) {
    throw new Refusal(
      CLAUSE_VERSION,
      `receipt_version ${JSON.stringify(version)} is not ${RECEIPT_VERSION}`,
    );
  }
  if (!isRecord(receiptJson)) {
    // Unreachable after AB-0 (a non-object has no version), kept for shape
    // parity with decide.rs, whose body build carries the same guard.
    throw new Refusal(CLAUSE_SIGNATURE, 'receipt is not an object');
  }

  // ---------------------------------------------------------- steps 1-2
  // AB-5: the body is the transport object minus SIGNED_EXCLUDE -- `sig`, and
  // `attestations`, the beside-channel the receipt commits to by digest.
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(receiptJson)) {
    if (!SIGNED_EXCLUDE.includes(k)) body[k] = v;
  }
  const signedBytes = canon(body);

  // AB-6 on the canonical bytes, before suite and signature: an oversized
  // body is refused on its face.
  if (signedBytes.length > RECEIPT_MAX_SIGNED_BYTES) {
    throw new Refusal(
      CLAUSE_BODY_SIZE,
      `signed body is ${signedBytes.length} bytes, over the ${RECEIPT_MAX_SIGNED_BYTES}-byte custody limit`,
    );
  }

  const alg = strField(receiptJson, 'alg');
  if (alg === null) {
    throw new Refusal(CLAUSE_UNKNOWN_SUITE, 'receipt declares no suite');
  }
  const parts = parseSig(receiptJson['sig'], alg);
  verifyReceiptGate(alg, floor, identity, signedBytes, parts, strField(receiptJson, 'decision') ?? '');

  // ------------------------------------------------------------ step 3
  // B-1a: hash the Proposal WE received. The receipt's field is compared,
  // never used. The bytes are parsed and re-canonicalised because the hash is
  // defined over the canonical encoding (`h(canon(proposal))`), not over
  // whatever spacing the transport used.
  let proposalValue: unknown;
  try {
    proposalValue = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(proposalBytes));
  } catch {
    throw new Refusal(CLAUSE_CANONICAL, 'proposal bytes are not UTF-8 JSON');
  }
  const proposalHash = `sha256:${hex(createHash('sha256').update(canon(proposalValue)).digest())}`;
  if (strField(receiptJson, 'proposal_hash') !== proposalHash) {
    throw new Refusal(CLAUSE_PROPOSAL_BINDING, 'receipt not bound to this proposal');
  }

  // Step 4 (policy basis: bundle hash + epoch) is NOT here -- it needs the
  // verifier's own bundle, which this stateless API deliberately does not
  // take. See the module doc's table; absence is disclosed, never approximated.

  // ------------------------------------------------------------ step 5
  // RFC 3339, PARSED, not a POSIX number (ACP-167): the one WE-5 parser in
  // instant.ts, never a second grammar.
  const iatRaw = strField(receiptJson, 'issued_at');
  const expRaw = strField(receiptJson, 'expires_at');
  if (iatRaw === null || expRaw === null) {
    throw new Refusal(CLAUSE_TEMPORAL, 'missing temporal fields');
  }
  const iat = parseInstant(iatRaw);
  const exp = parseInstant(expRaw);
  if (iat === null || exp === null) {
    throw new Refusal(CLAUSE_TEMPORAL, 'temporal field is not an RFC 3339 UTC instant');
  }
  if (now > exp) {
    throw new Refusal(CLAUSE_TEMPORAL, 'receipt expired');
  }
  if (iat > now + CLOCK_SKEW_SECS) {
    throw new Refusal(CLAUSE_TEMPORAL, 'issued in the future beyond skew');
  }
  // L-14 is a SEPARATE clause: a legal-today window 10x too long is Y2 (the
  // widened theft interval), not "expired", and the clause must say so.
  if (exp - iat > MAX_VALIDITY_WINDOW_SECS) {
    throw new Refusal(
      CLAUSE_VALIDITY_WINDOW,
      `validity window ${exp - iat}s exceeds ${MAX_VALIDITY_WINDOW_SECS}s`,
    );
  }

  // ------------------------------------------------------------ step 6
  // The nonce's TYPE and SIZE, in the reference's order -- WE-4 then L-17 --
  // so a value wrong in both ways stops at the same name in all three
  // implementations. The CL-2 single-use CLAIM is ledger state and is not
  // here; what is refused here is a value the ledger must never be handed.
  const nonce = strField(receiptJson, 'nonce') ?? '';
  if (!isWe4B64(nonce)) {
    throw new Refusal(
      CLAUSE_WIRE_TYPE,
      `receipt nonce ${JSON.stringify(receiptJson['nonce'])} is not b64: + RFC 4648 sec 4 base64 with padding`,
    );
  }
  if (nonce.length !== NONCE128_LEN) {
    throw new Refusal(
      CLAUSE_RECEIPT_NONCE_SIZE,
      `receipt nonce is not ${NONCE128_BYTES * 8}-bit`,
    );
  }

  // Steps 7/7b/8 (grading, quorum, tenant) need the signed policy, registry
  // and bundle tenant -- outside the stateless set; see the module doc.

  return { proposalHash, receiptExpiresAt: exp };
}
