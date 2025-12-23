# LocaleLens — CONTEST_SPEC (Community Dev Challenge: Image Gen API)

> Repo: `localelens`  
> Purpose: Win 1st prize by shipping a **reproducible, locally-runnable**, visually impressive tool that demonstrates **high-fidelity image editing + accurate text-in-image rendering** using the **OpenAI Image Gen 1.5 API**.

---

## 1) Contest Context and Interpretation

### 1.1 Contest requirement recap (from thread)

Submissions must provide:

- A **public GitHub repo**
- A short **README** explaining:
  - What was built
  - How Image Gen API is used
  - How to run locally
- **Screenshots/sample outputs** encouraged
- **Do not commit API keys**
- Focus should be on the **new 1.5 image model**, but additional options are allowed so long as the project remains reproducible with an OpenAI API key.

### 1.2 Our win strategy

We will win by being:

- **Immediately understandable**: "localize screenshots visually (not just translate text)"
- **Visually undeniable**: crisp before/after gallery across locales including **RTL**
- **Engineering-polished**: clean UI, predictable outputs, drift detection, fast local setup
- **Secure and responsible**: keys never leave server env; no credential storage
- **Technically sophisticated**: Two-model pipeline (GPT-4o Vision + gpt-image-1.5)
- **Universal**: Works with ANY image, not just demo screenshots

---

## 2) Problem Statement

### 2.1 The real problem

Teams frequently need to localize marketing visuals (App Store screenshots, hero images, flyers, in-product banners). Traditional workflows require:

- Design rework per language (Photoshop/Figma manual edits)
- QA for layout overflow, alignment, and typographic consistency
- Iteration loops that are time-consuming and expensive

### 2.2 Why image generation is uniquely suited

Localization is not just translation:

- Text must be re-rendered in the correct style
- Layout and alignment must be preserved
- Only certain regions should change (the rest must remain pixel-stable)

---

## 3) Solution Overview

### 3.1 Product definition (one sentence)

**LocaleLens** is a local-first tool that takes a base marketing visual, lets the user mark (mask) text regions, then generates **layout-safe localized variants** using high-fidelity image editing—while automatically measuring and flagging unintended visual drift.

### 3.2 Core user workflow

1. Upload a base image (PNG/JPG/WebP)
2. Create a mask over areas to replace (text regions)
3. Choose target locales and tone constraints
4. Generate variants (one per locale)
5. Review side-by-side + drift overlay
6. Export results (ZIP + README-ready montage)

### 3.3 Why this is contest-strong

Most submissions will be:

- prompt-to-image demos
- simple wrappers around the API

LocaleLens is:

- a complete workflow tool
- demonstrates editing precision + typography
- produces an immediate, judge-friendly gallery
- **Two-model pipeline** showcasing both GPT-4o and gpt-image-1.5
- **Universal image support** - works with any image, not just demos
- **Quality verification** - proves translations rendered correctly

### 3.4 Technical Architecture (Contest Differentiator)

LocaleLens uses a sophisticated two-model pipeline:

```text
┌─────────────────────────────────────────────────────────────────┐
│                    TWO-MODEL PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: INSPECTOR (GPT-4o Vision)                              │
│  ├─ Analyze uploaded image                                      │
│  ├─ Detect all text regions with bounding boxes                 │
│  ├─ Identify layout type (poster, screenshot, banner)           │
│  └─ Extract style information (font, colors)                    │
│                                                                  │
│  Step 2: TRANSLATOR (GPT-4o)                                    │
│  ├─ Translate detected text to target locale                    │
│  ├─ Respect length constraints                                  │
│  └─ Handle RTL languages (Arabic)                               │
│                                                                  │
│  Step 3: ARTIST (gpt-image-1.5)                                 │
│  ├─ Generate localized variant with dynamic prompt              │
│  ├─ Streaming preview during generation                         │
│  └─ Pixel-perfect composite for 0% drift                        │
│                                                                  │
│  Step 4: VERIFIER (GPT-4o Vision)                               │
│  ├─ Re-read generated image                                     │
│  ├─ Compare to expected translations                            │
│  └─ Report "Translation Accuracy" percentage                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**

- **gpt-image-1.5 cannot "read"** - It's a generation model, not vision
- **GPT-4o Vision provides the understanding** - Detects text, layout, style
- **Together they solve the problem** - Understand first, then generate
- **Verification proves quality** - Not just drift, but translation accuracy

---

## 4) Goals, Non-Goals, and Success Metrics

### 4.1 Goals (measurable)

G1 — Reproducibility

- Fresh clone → install → configure `.env` → run in **≤ 5 minutes**
- Works on Windows/macOS with no external services

G2 — Demonstrate Image Gen 1.5 strengths

- Show at least **3 locales** including **1 RTL locale** (Arabic)
- Replace text within masked regions while preserving the rest of the image

G3 — Low drift

- Provide a **Drift Score** that measures change outside masked regions
- Default target: **≤ 2% pixel-drift** outside the masked area for our demo images
  - If exceeded, UI flags output as “DRIFT DETECTED”

G4 — Great outputs

- Produce a README gallery of:
  - Original
  - Spanish variant
  - French variant
  - Arabic (RTL) variant
- Include at least one “tight layout” case to prove constraint handling

### 4.2 Non-goals (explicitly excluded for v1)

- No hosted deployment requirement (no Vercel dependency)
- No user accounts / login / OAuth
- No BYOK key storage in browser (keys remain server-side env)
- No automatic OCR dependency (we will optionally add “suggest regions,” but masking is primary)

### 4.3 Stretch goals (only after MVP)

- Auto “suggest mask boxes” using a vision model (optional)
- Batch mode: multiple images, same locale set
- Font-style mimic presets (e.g., “bold sans, centered, all caps”)
- Deterministic “layout compaction” mode for long languages (German)

---

## 5) System Architecture (Local-First)

### 5.1 Stack

- **create-t3-app** base
- Next.js (App Router), TypeScript, Tailwind
- tRPC for typed server calls
- Prisma + SQLite for local metadata storage

### 5.2 Local-only persistence model

We persist:

- Input images
- Masks
- Output variants
- Project metadata (SQLite)

We do **not** require:

- cloud storage
- external database
- remote queues

### 5.3 High-level components

A) Web UI

- Upload panel
- Mask editor (canvas)
- Locale selection + constraints
- Output viewer (before/after)
- Drift Inspector overlay
- Export tools

B) API Layer (tRPC)

- `project.create`
- `project.uploadBase`
- `mask.save`
- `variant.generate`
- `variant.list`
- `export.zip`

C) Services

- `OpenAIImageService` — calls Image Gen API
- `LocalePlanService` — generates locale-specific text specs/constraints
- `DiffService` — computes drift heatmap & drift score
- `FileStore` — reads/writes binary assets on disk

---

## 6) Data Model (Prisma + SQLite)

### 6.1 Entities

Project

- id, name
- baseImagePath
- createdAt, updatedAt

Mask

- projectId
- maskImagePath
- createdAt

**Variant

- projectId
- locale (e.g., `es-MX`, `fr-CA`, `ar`)
- prompt (final prompt used)
- outputImagePath
- driftScore (float)
- driftStatus (`PASS` | `WARN` | `FAIL`)
- createdAt

### 6.2 Why SQLite is ideal for the contest

- no installation or external DB provisioning
- fast, reliable local persistence
- easy for judges to run

---

## 7) API Usage (Image Gen 1.5)

### 7.1 Calls we will make

Primary

- Image editing: base image + mask + prompt → localized variant

Optional

- If we need a synthetic base image for demo, we may generate it once, then commit the generated sample outputs (but not keys) so the README shows the results immediately.

### 7.2 Prompting approach (winning-quality outputs)

We use a strict “Layout-Safe Locale Plan” for each locale:

- Translate the intended message
- Enforce brevity constraints (max characters)
- Provide typographic constraints:
  - alignment (center/left)
  - font feel (e.g., “bold modern sans”)
  - case rules (Title Case vs ALL CAPS)
- For RTL locales:
  - enforce right-to-left direction
  - preserve the visual hierarchy

We treat the mask as the contract:

- Everything outside masked regions should remain visually stable
- If not, Drift Inspector flags it

---

## 8) Security Stance (Contest-Grade)

### 8.1 Key handling

- API keys are **never committed**
- API keys are stored only in local `.env` (server-side)
- Client never receives the OpenAI key
- All OpenAI requests are executed server-side only

### 8.2 Data handling

- Demo assets must avoid real trademarks, real user data, or personal photos
- If we generate demo images, we use fictional branding

### 8.3 Licensing

- Code: MIT (recommended for judge friendliness)
- Demo images: include a clear note that images are synthetic/fictitious
- No proprietary assets committed

---

## 9) Quality Bar and Acceptance Gates

### 9.1 “Ready to submit” gate

A submission is ready when:

- README is complete and accurate
- Local run steps succeed on a clean machine
- Demo script produces the gallery outputs reliably
- Drift Inspector works and demonstrates engineering rigor
- No secrets in repo (CI check: `gitleaks` optional)

### 9.2 Definition of done (v1)

- A user can localize at least one screenshot into 3 locales
- Results are viewable and exportable
- Drift Score computed and displayed for each variant

---

## 10) Submission Package Deliverables

### 10.1 Repo must contain

- `/docs/CONTEST_SPEC.md` (this file)
- `/docs/SPRINTS.md` (execution plan)
- `/docs/DEMO_SCRIPT.md` (exact steps/prompts/assets)
- README with:
  - quick pitch
  - architecture summary
  - local setup steps
  - gallery images
  - troubleshooting

### 10.2 Demo media (critical for winning)

- A “hero” comparison image grid (original + 3 locales)
- Short GIF (optional): mask → generate → drift overlay

---

## 11) Roles and Operating Model

### 11.1 Roles

- **Sr. PM (this document owner):** scope control, sprint gates, acceptance criteria, submission polish
- **Sr. Software Engineer (another AI):** implementation, code quality, unit tests where meaningful
- **You (human owner):** direction, review, demo asset curation, final submission

### 11.2 Sprint governance

- No sprint starts without PM acceptance criteria written
- No sprint closes without:
  - demo run verified
  - screenshots updated (when applicable)
  - README updated incrementally

---

## 12) Risks and Mitigations

### R1 — Output drift outside mask

Mitigation:

- Drift Inspector + prompt tightening
- Smaller masks around only text areas
- “Regenerate with stricter constraints” button

### R2 — Long translations overflow

Mitigation:

- Locale Plan enforces character caps
- Provide alternate short copy options
- “Compact mode” constraint in prompt

### R3 — Setup friction for judges

Mitigation:

- SQLite + local assets only
- Minimal `.env` requirements
- One-command demo run script

---

## 13) Roadmap Summary (from Sprint 0 to submission)

- Sprint 0: foundation + one working image edit call
- Sprint 1: mask editor + end-to-end variant generation
- Sprint 2: drift inspector + locale constraints + RTL wow factor
- Sprint 3: README polish + demo script + gallery assets

---

## 14) PM Decision Log (initial)

- **No logins** for v1: reduces judge friction, increases speed-to-wow
- **Local-first**: meets contest requirement and avoids hosting complexity
- **RTL included**: adds a high-signal “this is real localization” wow moment
- **Drift Inspector included**: distinguishes us from basic wrappers

---
