# ClubHall Replay Benchmark Fixtures

`fixtures/manifest.json` is the authoritative benchmark set for Milestones 0-2.

Rules:
- Keep clip ids stable.
- Store large source videos outside git under `fixtures/local/` or point the manifest at absolute local paths.
- Keep the committed smoke clip under `fixtures/samples/` self-authored or otherwise safe to redistribute, and strictly minimal in size.
- Keep normalized outputs in `fixtures/output/`.
- Use exclusion zones in the manifest when the benchmark should measure false-positive suppression.

Expected loop:
1. Use the committed smoke clip in `fixtures/samples/` and optionally add local clips in the paths referenced by `fixtures/manifest.json`.
2. Run `pnpm benchmark:rfdetr`.
3. Run `pnpm benchmark:rfdetr:compare`.
4. Review `fixtures/output/benchmark-report.md` and replay the outputs in the workspace.

Interpretation:
- `real-ready` means the official runner dependencies are installed and benchmark runs should produce at least one `actualMode=real`.
- `fixture-only` means the environment is not ready for real inference yet; benchmark output should report `not-ready / fixture-only environment` instead of failing.
- `actualMode` values are `real`, `fixture-forced`, `fixture-fallback`, and `skipped`.
