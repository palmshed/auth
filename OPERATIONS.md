# Continuous Integration and Deployment

## CI Pipeline

- **Lint**: TypeScript type checking across all packages.
- **Test**: `vitest` with full test suite.
- **Build**: TypeScript compilation for all packages.
- **Security**: `npm audit` for dependency vulnerabilities.

## Release Process

Releases follow [semantic versioning](https://semver.org/):

- **Major**: Breaking changes to the public API or storage interface.
- **Minor**: New features that don't break existing APIs.
- **Patch**: Bug fixes and security updates.

### Manual Release

1. Update version in root `package.json` and all affected packages.
2. Update `CHANGELOG.md`.
3. Create a GitHub release with tag `v<version>`.
4. The CI pipeline publishes to npm on tag push.

### Automated Release

The CI pipeline can automatically publish when a Git tag matching `v*` is pushed.
