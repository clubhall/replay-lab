# Contributing

Thanks for helping improve ClubHall Replay.

## Getting started

1. Fork the repository and create a branch from `main`.
2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run the dev stack (see the root [README](README.md) for the Python worker if you touch that area).

## Before you open a pull request

From the repo root:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

If you change the RF-DETR worker:

```bash
PYTHONPATH=apps/replay-rfdetr-service python3 -m pytest -s apps/replay-rfdetr-service/tests -q
```

Keep changes focused: one logical change per PR makes review faster.

## Security

If you find a security issue, do **not** file a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the same terms as the project ([LICENSE](LICENSE)).
