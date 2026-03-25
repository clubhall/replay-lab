# PLAN.md

# ClubHall Replay — Authoritative Plan

## 0. Purpose

This document is the authoritative execution plan for `clubhall-replay`.

The goal is **not** to design the perfect platform in abstraction.
The goal is to ship a **browser-first replay workspace for tennis video** that becomes useful immediately, then progressively adds structured visual intelligence and semantic assistance.

This plan supersedes ad hoc architectural drift.

---

## 1. Product Thesis

ClubHall Replay should win by being:

1. a **better replay workspace**
2. a **better visual debugging environment**
3. a **better structured CV product**
4. only then, a **better semantic AI product**

The product is **not**:
- a generic AI video demo
- a pure VLM experiment
- a dashboard-first analytics toy
- a giant platform before the replay core works

The product **is**:
- upload a long match
- navigate a modern timeline
- create/edit segments
- inspect overlays
- run structured analysis
- export the session

---

## 2. Core Principle

**Replay workspace first.**
**Structured vision second.**
**Semantic explanation third.**

Whenever there is a tradeoff, choose the path that improves:
- timeline navigation
- segment editing
- overlay inspection
- reliability of detections/tracks
- debuggability of results

before choosing the path that only improves “AI magic”.

---

## 3. What Already Exists

The current repo already contains useful foundation and should **not** be restarted from scratch.

Existing foundation includes:
- monorepo with `apps/replay-web` and `apps/replay-rfdetr-service`
- local-first browser workspace
- upload/import flow
- session routing
- replay player
- replay timeline
- overlay layers
- engine run actions
- local persistence
- session export/import
- fixture-first RF-DETR service
- normalized analysis contracts

This means the repo should be **remixed and corrected**, not discarded.

---

## 4. Non-Negotiable Decisions

### 4.1 One repo, one product
Keep one monorepo.
Do not create parallel permanent codebases for:
- LFM
- RF-DETR
- pose
- timeline experiments

Use one product shell with plug-in analysis lanes.

### 4.2 RF-DETR is the primary visual intelligence lane
RF-DETR is the main lane for:
- player detection
- ball detection
- tracking input
- structured proposals
- smoothing/interpolation/exclusion-zone workflow

### 4.3 LFM is a sidecar lane
LFM2.5-VL WebGPU remains **experimental** and must not drive the roadmap.
It is only for:
- selected segment semantic summary
- label suggestion
- short clip/frame explanation
- debugging ambiguous moments

### 4.4 Local-first before cloud polish
Do not make Mux a blocking dependency for v0.
Keep the product useful locally first.
Design contracts so Mux can slot in later.

### 4.5 Benchmark harness before more abstractions
No large new abstraction layer should be added until a benchmark harness exists.

---

## 5. Resource Adoption Matrix

This project must be developed with an explicit **resource-first** mindset.

For each selected resource, the default question is:

> What are we absorbing literally, what are we adapting, what are we only referencing, and what are we deferring?

### 5.1 Lawn
**Decision:** adapt partially

Use Lawn as a strong reference for:
- video review product taste
- review interaction model
- timeline/editor ergonomics
- workspace composition

Do not blindly inherit its product semantics or backend assumptions.

Expected effect:
- improve replay workspace quality
- simplify UI decisions
- sharpen the review/product mental model

### 5.2 Mux
**Decision:** reference now, adopt later

Mux is not phase 0 foundation.
Mux becomes relevant when we need:
- hover previews
- generated thumbnails/storyboards
- clip generation
- persistent playback/distribution
- chapters

Do not block v0 on Mux.
Do make sure segment contracts are compatible with later Mux integration.

### 5.3 RF-DETR
**Decision:** absorb literally

RF-DETR is the primary visual lane and must become real, not remain fixture-only.

Use it for:
- person detection
- ball detection
- future racket detection if feasible

### 5.4 Roboflow Inference
**Decision:** adapt partially

Investigate whether local serving/runtime can be accelerated by Roboflow Inference.
If it materially shortens time-to-real-analysis, use it.
If not, keep the current worker shell and evolve it pragmatically.

### 5.5 Roboflow Trackers
**Decision:** absorb literally

Use Trackers to avoid reinventing:
- MOT association
- stable trajectories
- follow-through continuity

This is first-class because readable trails matter.

### 5.6 Roboflow Sports
**Decision:** adapt partially

Use Roboflow Sports as a sports-CV reference layer and source of utilities/ideas.
Do not over-integrate early.
Pull in only what clearly improves tennis-specific analysis.

### 5.7 Total TypeScript Monorepo
**Decision:** adapt partially

Use it as:
- monorepo discipline reference
- tooling reference
- FFmpeg/utilities inspiration
- package organization inspiration

Do not imitate every package split prematurely.

---

## 6. Competitive Goal

We are not building in a vacuum.

The referenced competitor/demo already signals a bar around:
- RF-DETR detections
- pose/keypoint usage
- smoothing/interpolation
- exclusion zones
- visually convincing output

We must beat the demo by product quality, not only model novelty.

### Competitive acceptance criteria
ClubHall Replay should become better than the reference demo in at least these areas:

1. **timeline UX**
2. **segment editing**
3. **overlay inspection**
4. **debuggability**
5. **session portability**
6. **manual correction workflow**
7. **clear exclusion-zone tooling**
8. **structured replay workspace feel**

---

## 7. Current Problems To Correct

The current repo foundation is good, but the project is still drifting in these ways:

1. RF-DETR path is still fixture-first rather than a real inference lane
2. selected external resources are underused
3. benchmark harness is missing as a first-class milestone
4. LFM exists too early relative to core replay advantage
5. there is risk of over-abstracting before tennis-specific proof exists

This plan corrects that.

---

## 8. Immediate Working Rules For The Coding Agent

Before writing more product code, the coding agent must follow these rules:

### 8.1 No blind continuation
Do not continue coding as if the repo direction is settled.

### 8.2 Reconcile before expanding
First reconcile the codebase against this plan.

### 8.3 No new big abstractions without milestone pressure
Do not split more packages or create more framework layers unless required by the next active milestone.

### 8.4 Do not optimize LFM before RF-DETR is real
Semantic sidecar work is lower priority than:
- benchmark harness
- real detections
- smoothing
- exclusion zones
- segment proposal quality

### 8.5 Prefer product leverage over technical purity
If one choice gives a better replay product sooner, prefer it over the more elegant architecture.

---

## 9. Required Reconciliation Step

Before new implementation, the agent must produce a repo audit with these sections:

1. **Implemented**
2. **Partially implemented**
3. **Missing**
4. **Conflicts with this plan**
5. **Resource adoption matrix**
6. **Delete / Keep / Defer**

The agent must not skip this step.

---

## 10. Milestone Structure

Only the next **three** milestones should actively drive implementation.

---

## Milestone 0 — Benchmark Harness

### Objective
Create the internal benchmark harness that lets us compare outputs and improve the pipeline without guessing.

### Deliverables
- 5–10 canonical tennis clips
- `fixtures/` layout
- clip metadata manifest
- optional minimal manual annotations / expected outputs
- golden-path replay fixture set
- benchmark checklist
- before/after comparison workflow for:
  - detections
  - trails
  - smoothing
  - exclusion zones

### Requirements
- include at least:
  - side/baseline footage
  - longer match segment
  - ball visibility stress clip
  - motion blur / hard tracking clip
- fixture assets must be documented
- benchmark naming must be consistent
- benchmark must be runnable repeatedly

### Acceptance criteria
- the team can run the same test set every time
- outputs can be compared visually and structurally
- regression can be detected
- “better than demo” starts becoming measurable

---

## Milestone 1 — Replay Workspace Polish

### Objective
Make the replay workspace feel real, reliable, and clearly superior as a product shell.

### Deliverables
- polished upload/open flow
- timeline clarity improvements
- segment editing improvements
- better selected-segment inspector
- portable session workflow
- overlay readability improvements
- keyboard shortcuts preserved and clarified
- empty/loading/error states improved

### Requirements
- keep local-first
- keep session export/import strong
- keep relink flow working
- do not add unrelated platform features

### Acceptance criteria
A user can:
- open a match
- scrub the timeline
- create/edit/delete/select segments
- toggle overlays
- export the session
- import it later
- understand what the app is doing without explanation

---

## Milestone 2 — Real RF-DETR Lane

### Objective
Replace the current fixture-only feel with a real structured visual lane.

### Deliverables
- real RF-DETR analysis path
- real or partially real detector integration
- player + ball detections
- post-processing pipeline
- smoothing/interpolation
- exclusion zone support
- normalized JSON output that plugs into the existing app

### Requirements
- do not redesign the whole worker first
- keep the API pragmatic
- prefer a direct usable lane over a perfect internal job system
- preserve the normalized engine-output contract

### Acceptance criteria
- real detections can be run on benchmark clips
- overlays render from real results
- ball trail readability improves with smoothing
- exclusion zones reduce false positives
- results can be imported/replayed/debugged inside the workspace

---

## 11. LFM Policy

LFM2.5-VL WebGPU stays in the repo but must follow this policy:

### Allowed
- selected segment summary
- label suggestion
- short clip explanation
- insight enrichment

### Not allowed as roadmap driver
- full-match parsing
- main segmentation engine
- primary replay experience dependency
- anything that delays Milestones 0–2

LFM is **v0.2+**, not v0 foundation.

---

## 12. Pose Policy

Pose work must not stay vague forever.

A pose benchmark decision must happen after Milestone 2 begins to stabilize.

### Required comparison
Benchmark:
- MediaPipe-like browser lane
- higher-quality server-side lane (e.g. ViTPose-style lane if adopted)

### Compare on:
- stability
- occlusion tolerance
- keypoint drift
- latency
- ease of integration
- usefulness for tennis-specific interpretation

### Output
The agent must explicitly recommend:
- default pose provider
- fallback provider
- whether pose stays browser-side, server-side, or mixed

---

## 13. Exclusion Zones Policy

Exclusion zones are first-class product features, not hidden post-processing trivia.

### They must become:
- editable
- visible
- persisted in session JSON
- measurable in benchmark comparisons

### Why
Exclusion zones directly improve:
- false positive control
- trust in the system
- usability for different camera setups
- competitiveness vs the reference demo

---

## 14. Data and API Strategy

### For now
Prefer pragmatic APIs.

The worker does **not** need a huge platform-grade orchestration layer before it proves value.

### Good first shape
Simple, testable endpoints are acceptable if they help ship real analysis faster.

### Constraint
Even if the API is simple, outputs must stay normalized and portable.

---

## 15. Package Discipline

Do not create more packages just because the architecture could support them.

### Current bias
Prefer fewer packages under pressure.

### Rule
Only split code when:
- reuse is real
- boundaries are proven
- milestone execution becomes easier

Not before.

---

## 16. Definition of Success

ClubHall Replay is on the right path when all of the following are true:

1. benchmark fixtures exist
2. replay workspace feels good
3. segment editing is reliable
4. overlays are readable
5. real RF-DETR-style analysis is visible in the app
6. exclusion zones matter
7. smoothing/interpolation visibly improve trails
8. session export/import works well
9. LFM is optional, not required
10. the product feels more operational and debuggable than the competitor demo

---

## 17. What To Keep / Defer / Delete

### Keep
- current monorepo
- replay workspace shell
- store/local persistence layer
- normalized contracts
- export/import model
- player/timeline foundations
- overlay substrate
- worker shell

### Defer
- deeper LFM investment
- heavy cloud integrations
- broader platformization
- unnecessary package splitting
- advanced multi-engine orchestration

### Delete or simplify if needed
- abstractions that do not help current milestones
- overly complex worker lifecycle logic if it slows real analysis
- speculative infrastructure not justified by benchmark or replay UX

---

## 18. Mandatory Next Instruction For The Agent

The next task is **not** “continue coding normally”.

The next task is:

### Step A — Reconciliation audit
Produce:
- Implemented
- Partially implemented
- Missing
- Conflicts
- Resource adoption matrix
- Delete / Keep / Defer

### Step B — Milestone execution proposal
Propose the exact work for:
- Milestone 0
- Milestone 1
- Milestone 2

Only.

### Step C — File-level action list
List:
- files to modify next
- files to create next
- files to leave untouched

Only after that may implementation continue.

---

## 19. Final Directive

Build the replay operating layer first.
Use RF-DETR as the primary structured visual lane.
Use LFM as a semantic sidecar.
Exploit the resources we selected deliberately.
Do not drift into platform-first abstraction again.

This project wins by becoming a better replay product in real life.