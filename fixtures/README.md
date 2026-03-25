# ClubHall Replay Benchmark Fixtures

`fixtures/manifest.json` is the authoritative benchmark set for Milestones 0-2.

Rules:
- Keep clip ids stable.
- Store large source videos outside git under `fixtures/local/` or point the manifest at absolute local paths.
- Keep normalized outputs in `fixtures/output/`.
- Use exclusion zones in the manifest when the benchmark should measure false-positive suppression.

Expected loop:
1. Put local clips in the paths referenced by `fixtures/manifest.json`.
2. Run `pnpm benchmark:rfdetr`.
3. Run `pnpm benchmark:rfdetr:compare`.
4. Review `fixtures/output/benchmark-report.md` and replay the outputs in the workspace.
