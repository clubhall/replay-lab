# Evidence-grounded tennis coach

`evaluateCoach(input: CoachInput): CoachResult` is a deterministic, local rubric.
It returns one observation or an explicit abstention. It does not call an LLM,
upload video, infer medical conditions, or equate detector confidence with
technical accuracy. Exact types are in `src/types.ts`.

The initial supported observation is deliberately narrow: human-confirmed
preparation precedes human-confirmed contact in a forehand/backhand window with
usable body pose. It acknowledges that observable sequence without claiming
the preparation was early enough or the execution was correct. Contact is never
inferred from an elbow or interpolated landmark. Serve and return need additional
evidence and currently abstain.

Every input binds session, asset/fingerprint, athlete, track and revision. Frames
use original-media milliseconds and source-normalized coordinates. The caller
must preserve that provenance during trimming, seek and display transforms.
Do not mark identity verified solely because `numPoses` equals one. Producers
are responsible for truthful `kind`, model/version/run and quality metadata;
the rubric cannot authenticate external model output. Known synthetic/bbox
providers are denied even when mislabeled as models.

Quality gates (visibility 0.8, person height 180 source pixels, 80% valid samples,
five samples and maximum 250 ms gap) are conservative engineering hypotheses,
not scientifically established tennis thresholds. Critical joints must be in
frame and the camera must be stable. Five fixtures passing these checks is not
validation on real video. Human marks are separately attributed and versioned.

The collection in `src/knowledge.ts` contains brief paraphrases with source IDs,
URLs, authors/organization, publication year when verified, access date,
population/task, evidence type/strength and restrictions. The USTA school manual
supports the preparation/contact vocabulary and cooperative progression; it
does not validate this rubric or an adult athlete's technique. The drill is
explicitly a ClubHall-authored adaptation. Serve material is retained for future
review, not automatically attached to unsupported observations.

Cues and drills additionally require athlete-provided experience and goal.
Reported pain suppresses physical instructions while retaining descriptive
review. No source is used to turn a correction into treatment. Reassessment
compares the same athlete under comparable camera conditions with new human
marks and feedback; improvement is never awarded automatically.

Run `pnpm --filter @clubhall/coach-knowledge test`, `typecheck`, and `lint`.
Tests use fabricated contract fixtures only. Actual coaching utility and pose
accuracy still require an authorized video dataset and qualified human review.
