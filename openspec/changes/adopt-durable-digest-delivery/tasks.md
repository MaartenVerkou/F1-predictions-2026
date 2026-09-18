## 1. Repository contract

- [x] 1.1 Inventory live source, image, database backend and state ownership.
- [x] 1.2 Add the durable manifest and concise Codex instructions.
- [x] 1.3 Pin the runtime image and separate image-owned from server-owned configuration.

## 2. Delivery

- [x] 2.1 Build, probe, scan and publish immutable GHCR images in CI.
- [x] 2.2 Make deployment accept only an exact digest and preserve one rollback image.
- [x] 2.3 Remove the competing automatic source/SSH deployment path.

## 3. Verification and promotion

- [x] 3.1 Run repository tests, image health and PostgreSQL-parity checks.
- [ ] 3.2 Refresh the preview and obtain explicit approval.
- [ ] 3.3 Enable Apps Hub delivery, deploy the approved digest and verify production.
