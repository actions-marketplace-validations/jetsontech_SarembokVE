# About SarembokVE

SarembokVE is a tool for catching breaking API contract changes. It loads a live site in headless Chromium, records the requests the page makes, and generates an OpenAPI 3.1 description and TypeScript types. Its `audit` command compares the current contract with a baseline you commit and fails CI on breaking differences.

**Maintainer:** Jetson Technologies
**Source:** https://github.com/jetsontech/SarembokVE · **License:** Apache-2.0

## Status

Early-stage, single-maintainer software. It runs in production at https://sarembok.com; live checks are on the [status page](https://sarembok.com/status). The command-line package is not yet published to npm. Releases are listed in the [changelog](https://sarembok.com/changelog), including corrections to earlier claims.

## What it is not

- Not a certified or audited security product.
- Not a replacement for contract tests written against your own API.
- Not an autonomous agent platform. The hosted console contains experimental assistant, voice and avatar features; they are side projects around the core tool and carry no guarantees.

## Contact

Open an issue on GitHub. For vulnerabilities, use a private [security advisory](https://github.com/jetsontech/SarembokVE/security/advisories/new).
