/**
 * @ziffer-io/verify -- the third receipt-verifier implementation (ACP-197 §5).
 *
 * `verifyReceipt` is the API; everything else is exported so the pieces are
 * individually testable and so `@ziffer-io/client` can re-export ONE verify (the
 * client adds no verification logic of its own -- one home per rule).
 */

export { canon, compareCodePoints, type Json } from './canon.js';
export {
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
export {
  ED25519_PK_LEN,
  ED25519_SIG_LEN,
  ed25519IsSmallOrder,
  verifyEd25519Strict,
} from './ed25519.js';
export { parseInstant } from './instant.js';
export { Refusal } from './refusal.js';
export {
  parseSuite,
  satisfiesFloor,
  suitePrimitives,
  verifyHybrid,
  type HybridError,
  type Primitive,
  type PrimitiveVerdict,
  type Suite,
} from './suite.js';
export {
  CLOCK_SKEW_SECS,
  MAX_VALIDITY_WINDOW_SECS,
  MLDSA65_PK_LEN,
  MLDSA65_SIG_LEN,
  NONCE128_BYTES,
  NONCE128_LEN,
  RECEIPT_MAX_SIGNED_BYTES,
  RECEIPT_VERSION,
  SIGNED_EXCLUDE,
  isWe4B64,
  verifyReceipt,
  type TrustAnchor,
  type Verified,
  type VerifyOptions,
} from './verify.js';
