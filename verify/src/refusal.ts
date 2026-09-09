/**
 * A named refusal, mirroring the engine's `acp_decision::Refusal` and the
 * reference's `FailClosed(clause, msg)`.
 *
 * Thrown, not returned: the Python SDK's `verify()` raises `RefusedError(name)`
 * and this package's `verifyReceipt` is its TS sibling -- a caller that wants a
 * verdict catches and reads `clause`. The CLAUSE is the machine-readable half
 * (the value the cross-implementation comparison is on); `message` is for the
 * operator and is never part of the contract.
 */
export class Refusal extends Error {
  /** The clause id, spelled exactly as the engine's Rust constants spell it. */
  readonly clause: string;

  constructor(clause: string, message: string) {
    super(`${clause}: ${message}`);
    this.name = 'Refusal';
    this.clause = clause;
  }
}
