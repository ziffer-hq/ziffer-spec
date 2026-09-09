/**
 * TEST KEY MATERIAL ONLY -- the reference's `HybridKey` seed derivation
 * (`acp_crypto.py`), mirrored so fixtures signed here are signed under
 * identities the ENGINE derives from the same seeds: ed secret =
 * sha256(seed || "ed"), ML-DSA seed = sha256(seed || "mldsa"), both legs from
 * one seed (an unseeded ML-DSA keygen gave each process a different key for
 * one identity once -- the engine's own recorded defect).
 *
 * A seed derived from a string anyone can read is a key anyone can hold. This
 * module is imported by tests only and is deliberately NOT exported from
 * index.ts; a deployment loads keys from a KMS, never from here.
 */

import { createHash } from 'node:crypto';

import { ed25519 } from '@noble/curves/ed25519.js';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js';

export interface TestHybridKey {
  readonly edSecret: Uint8Array;
  readonly classical: Uint8Array;
  readonly pq: Uint8Array;
  readonly pqSecret: Uint8Array;
}

export function hybridKeyFromSeed(seedText: string): TestHybridKey {
  const seed = new TextEncoder().encode(seedText);
  const edSecret = new Uint8Array(
    createHash('sha256').update(seed).update(new TextEncoder().encode('ed')).digest(),
  );
  const mlSeed = new Uint8Array(
    createHash('sha256').update(seed).update(new TextEncoder().encode('mldsa')).digest(),
  );
  const kp = ml_dsa65.keygen(mlSeed);
  return {
    edSecret,
    classical: Uint8Array.from(ed25519.getPublicKey(edSecret)),
    pq: Uint8Array.from(kp.publicKey),
    pqSecret: Uint8Array.from(kp.secretKey),
  };
}
