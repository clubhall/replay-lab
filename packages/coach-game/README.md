# Coach game domain

Deterministic singles scorer for best-of-three, advantage games, six-game sets and seven-point tie-breaks at 6–6. Rules follow [ITF Rules of Tennis 2026, rules 5–7](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf). Alternative formats, including no-ad and deciding match tie-breaks, are intentionally rejected until implemented and tested.

`deriveTennisSession({ sessionId, events, firstServer, assetDurationMs })` rebuilds score, statistics and performance rewards from immutable point revisions. `id` identifies the point across revisions; `ordinal` is its position in the complete point/event stream, including lets. Confirmation requires an identified reviewer. A double fault requires explicit evidence of a second-service fault. Demo history cannot be promoted to real evidence.

The first server defaults to `athlete`; callers should obtain the actual first server from the user. `complete` means the observed sequence has no gaps or invalid records. It does not establish that an uploaded video captures the complete match. At the first unknown, conflicting or missing point, cumulative scoring stops. Later confirmed clips can still contribute to explicitly partial statistics. A manual `checkpoint` permits a known starting score with session, reviewer and evidence provenance.

`statistics` carries numerator, denominator and nullable value for ratios. Unobserved outcomes and contact counts remain null. The UI should render null as `—` and show sample sizes and coverage. `formatPointScore(score)` supplies tennis point labels.

`reconcileRewardLedger(previous, desired)` rebuilds active rewards while preserving grants and revocations. Pass the complete desired reward set for the ledger's scope. Repeated inputs, loops and seeks cannot increase the balance; revised evidence revokes the previous grant before replacing it. A session ledger must not be passed as if it contained an athlete's complete multi-session history.

`firstReplayReward(savedReview, athleteLedger)` requires an explicitly reviewed and saved own moment; it does not require that the moment contain a confirmed tennis point. Persist the ledger at athlete scope to enforce the once-per-athlete rule across sessions. The evidence ID can refer to the saved review moment itself. Current performance rewards cover a confirmed eight-contact rally, the first confirmed athlete ace in a session and a saved break point against the athlete. These are product XP, not a competitive rating or a validated physical measure.

The functions do not verify the identity of a signed-in reviewer, media ownership, or authenticity of imported JSON; the application must enforce those boundaries before accepting history. The module validates sports-domain consistency and preserves review state.
