# `@ziffer-io/types`

The ACP wire format as TypeScript types, generated from `spec/schemas/` in the engine repository
and published at the commit this workspace pins.

```bash
npm install @ziffer-io/types
```

You do not usually install this directly. `@ziffer-io/client` depends on it, so a client install
brings the wire types with it.

## What it is

`spec/schemas/wire/` and `spec/schemas/bundle/` are the only normative definition of every ACP
message. The engine's `tools/codegen.sh` turns them into Rust and TypeScript; this package is that
TypeScript output, compiled, with the engine commit it came from recorded in its own
`package.json` under `ziffer.enginePin`.

So the types are not a transcription of the schemas. They are the schemas' output, and a field this
package does not have is a field the specification does not state.

## What is in the tarball

`dist/` only — compiled JavaScript and `.d.ts`. There is no build step on your machine and no
dependency to fetch: the previous arrangement had `@ziffer-io/client` naming the engine repository
as a `git+` dependency, which a consumer could not resolve at all, and which would have compiled
our wire types on their machine if they could.

## What it does not do

- **It carries no behaviour.** These are types and the fail-safe accessors the generator emits for
  signed-policy tables. Nothing here verifies a receipt, canonicalises bytes or talks to an API —
  `@ziffer-io/verify` and `@ziffer-io/client` do those, each in one place.
- **It is not a validator.** A value typed as a `Proposal` has satisfied `tsc`, not the schema.
  Nothing in this repository validates a document against `spec/schemas/` yet; that gap is
  ACP-52, and it is disclosed rather than closed.
- **A version of this package does not pin the specification.** It pins an engine *commit*. Read
  `ziffer.enginePin` for which one.

## Development

```sh
pnpm --filter @ziffer-io/types test   # vendor from the pin, tsc -b, assert the entry resolves
```

`src/` is gitignored: it is a build-time copy of the engine's `packages/acp-types/src`, taken from
the pinned commit and regenerated on every build, so there is no committed second copy of the wire
format to drift. `scripts/vendor-engine-types.mjs` refuses — by name — a pin it cannot read, a
lockfile that resolved a different commit, an absent checkout, and two checkouts at once.

## Licence

Proprietary. Copyright (c) 2026 code75 SASU, Paris, France. ZIFFER(TM) is a brand of code75
SASU. This package is **not open source**: it is licensed for use with the ZIFFER service under
your agreement with code75, on the terms in `LICENSE` beside this file. The third-party
open-source components it redistributes are listed in `THIRD-PARTY-NOTICES` and are governed by
their own licences.
