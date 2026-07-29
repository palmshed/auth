# Contributing

## Development Setup

```bash
git clone https://github.com/palmshed/auth
cd auth
npm install
```

## Testing

```bash
# Full suite
npm test

# Single package
npm run test -w packages/core -- --run

# Watch mode
npm run test -w packages/core -- --watch
```

## Package Structure

- `packages/core` — No production dependencies beyond `@noble/hashes`. Should remain minimal.
- `packages/hono` — Depends only on `hono` and `@palmshed/auth-core`.
- `packages/express` — Depends only on `express` (peer) and `@palmshed/auth-core`.
- `packages/client` — Zero dependencies. Works in any ES2022 environment.
- `packages/storage-*` — Each has one database driver dependency.

## Adding a Storage Adapter

1. Create `packages/storage-<name>` with `package.json` and `tsconfig.json`.
2. Implement the `AuthStorage` interface.
3. Add a `migrate()` method that creates the schema.
4. Use `crypto.randomUUID()` for primary keys.
5. Run the contract tests against your adapter.

## API Stability

The public API is frozen for v1.x. Additions must be backward-compatible. Breaking changes require a major version bump.

## Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] No new dependencies unless necessary
- [ ] Public API changes documented in API.md
- [ ] Migration guide updated if behavior changed
