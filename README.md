# ZIFFER Specification

ZIFFER is a decision service for AI agents. An agent proposes an action, ZIFFER grades it against signed policy, and the executor on the customer's side runs it only on a verified decision receipt. This repository is the specification of that contract: the rules, the wire formats and the test vectors. It exists so that a party who does not trust ZIFFER can check a receipt without asking ZIFFER anything.

Published from engine commit `05e23676aa6f49bc232c9a20f186132f2494648e`. `PROVENANCE.json` lists every file with its hash. This repository is generated; it takes no pull requests. Findings go to hello@ziffer.io.

## Contents

- `spec/ZIFFER-SPEC-001.md`: the decision rules, encodings and the executor's verification checklist.
- `spec/ZIFFER-DEPLOY-001.md`: trust domains, key custody, deployment profiles.
- `spec/schemas/`: the policy bundle schemas and the wire message schemas. Every type in the product is generated from these.
- `spec/vectors/`: the conformance vector classification and the per-implementation obligations.

## What is not here

The engine that makes decisions, the reference implementation, the mutation-test evidence and the simulation are not published. The receipt verifiers ship as packages, `@ziffer-io/verify` on npm and `ziffer` on PyPI, under their own licence; their source is not in this repository. Passing the published vectors is a partial claim: they express input to verdict, not ordering, partition behaviour or the deletion tests, which are per-implementation obligations named in `spec/vectors/OBLIGATIONS.md`.

## Licence

The ZIFFER Specification Licence, in `LICENSE`: read it, copy it verbatim, implement it in software that interoperates with ZIFFER. Versions through v1.3.19 were published under the name ACP under Apache-2.0; that grant is unchanged for those versions and extends to nothing later.

ZIFFER is a registered trademark of code75 SASU.
