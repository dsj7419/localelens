# LocaleLens — SPRINTS (Sprint-by-Sprint Execution Plan)

> Repo: `localelens`
> Objective: Deliver a contest-winning, locally-runnable tool that demonstrates **high-fidelity image editing + accurate text-in-image** using Image Gen 1.5, with a **judge-friendly demo path** and **professional repo polish**.

---

## Current Status

| Sprint | Status | Date |
| Sprint 0 | **COMPLETE** | 2025-12-17 |
| Sprint 1 | **COMPLETE** | 2025-12-17 |
| Sprint 2 | **COMPLETE** | 2025-12-17 |
| Sprint 3 | **COMPLETE** | 2025-12-17 |
| Sprint 4 | **COMPLETE** | 2025-12-18 |
| Sprint 5 | **COMPLETE** | 2025-12-18 |
| Sprint 6 | **CRITICAL - IN PROGRESS** | 2025-12-18 |

**Current State:**

- Core functionality complete and working
- SOLID/SRP architecture refactoring complete
- OpenAI Image Edit API integration verified working (gpt-image-1.5)
- Demo Mode allows full UX testing without API access
- Visual polish complete (Sprint 5)
- **CRITICAL ISSUE:** Drift detection failing at 14.5% - API optimization needed (Sprint 6)

---

## 0) Operating Rules (Non-Negotiable)

### 0.1 Sprint cadence and gates

- Each sprint ends with a **demoable artifact**.
- No sprint starts without:
  - clear scope
  - measurable acceptance criteria
  - explicit “out-of-scope” list
- No sprint closes without:
  - acceptance criteria met
  - README updated with new capability (minimal, incremental)
  - demo script updated if it impacts output

### 0.2 Primary success factors for winning

- Reproducibility: fresh clone → demo output in ≤ 5 minutes
- Visual impact: gallery clearly demonstrates text replacement + RTL support
- Engineering rigor: Drift Inspector signals “serious tool,” not a wrapper
- Security: no secrets, server-side API usage only

---

## 1) Milestones Overview

### Milestone A — MVP Pipeline (Sprints 0–1)

**Outcome:** Upload → Mask → Generate localized variant → View output

### Milestone B — Contest Differentiators (Sprint 2)

**Outcome:** Drift Inspector + RTL + constraint-driven translations that stay in bounds

### Milestone C — Submission Polish (Sprint 3)

**Outcome:** README + demo script + screenshots are “judge-ready”

---

## 2) Sprint 0 — Foundation + First Successful Image Edit Call

> **STATUS: COMPLETE** (2025-12-17)

### 2.1 Sprint goal

Establish a clean, local-first foundation and prove a single server-side image call pipeline works end-to-end.

### 2.2 Scope (must ship)

1) **Repo hygiene**
   - Ensure generated artifacts (e.g., `generated/`) are not committed
   - Confirm `db.sqlite` is gitignored
2) **Env schema**
   - Add `OPENAI_API_KEY` to env validation (server-only)
3) **OpenAI client service (server-only)**
   - Create a minimal service module that can:
     - call Image Gen 1.5 to produce an output image (generate or edit)
     - return image bytes/base64 to server
4) **Local file store**
   - Write an output file to `.local-data/` with deterministic naming
5) **tRPC mutation**
   - Add `image.testGenerate` (or similar) that:
     - calls the OpenAI service
     - writes output to disk
     - returns a `fileId` or route URL
6) **Minimal UI hook**
   - Temporary button on the homepage: “Generate Test Image”
   - Renders returned image below

### 2.3 Out of scope (explicit)

- Mask editor
- Locale selection
- Drift Inspector
- Multi-variant generation

### 2.4 Acceptance criteria (measurable)

- A clean clone can run:
  - `pnpm install`
  - `pnpm db:push`
  - `pnpm dev`
  - Set `OPENAI_API_KEY` in `.env`
- Clicking “Generate Test Image” produces a new image file under `.local-data/outputs/`
- UI displays the generated image
- OpenAI key never appears in client bundle (verified by design: server-only usage)

### 2.5 Deliverables

- `src/server/services/openaiImage.ts` (or equivalent)
- `src/server/services/fileStore.ts`
- `src/server/api/routers/image.ts`
- Minimal UI button + image display
- Update README “Local Setup” section with env instructions

### 2.6 PM verification checklist

- Output exists on disk
- App renders output with a stable URL
- No secrets committed
- Windows path handling validated

---

## 3) Sprint 1 — Mask Editor + End-to-End Localization Variants

> **STATUS: COMPLETE** (2025-12-17)
> Code complete, tested to API boundary. Full E2E pending OpenAI org verification.

### 3.1 Sprint goal

Enable the primary workflow: upload base image → create mask → generate localized variants.

### 3.2 Scope (must ship)

1) **Project model + routes**
   - Create “Project” page: `/project/[id]`
   - Basic project creation and listing (minimal UI is fine)
2) **Base image upload**
   - Upload base image to `.local-data/projects/{projectId}/base.png`
   - Persist metadata in SQLite via Prisma
3) **Mask creation UI**
   - Canvas-based mask editor:
     - show base image
     - allow painting or rectangle tool
     - export PNG mask with alpha
   - Save mask to `.local-data/projects/{projectId}/mask.png`
4) **Locale selection UI**
   - Fixed dropdown list (no freeform yet):
     - `es-MX`, `fr-CA`, `ar`
   - “Tone” selector (simple):
     - `neutral`, `playful`, `formal`
5) **Variant generation pipeline**
   - For each locale, create a final prompt using a simple template
   - Call OpenAI image edit with base image + mask
   - Save outputs as:
     - `.local-data/projects/{projectId}/variants/{locale}.png`
   - Store variant records in DB with prompt and status
6) **Variant viewer**
   - Side-by-side:
     - base image
     - selected locale output
   - Basic download button per image

### 3.3 Out of scope (explicit)

- Drift Inspector (Sprint 2)
- Auto “suggest mask boxes”
- Batch processing across multiple base images

### 3.4 Acceptance criteria (measurable)

- A user can:
  - Create a project
  - Upload a base image
  - Create and save a mask
  - Select locales `es-MX`, `fr-CA`, `ar`
  - Generate three outputs successfully
- Outputs are persisted to disk and can be reloaded after page refresh
- Project is reproducible from scratch using the demo script image assets
- Each variant record stores:
  - locale
  - prompt used
  - file path (or served URL)

### 3.5 Deliverables

- `Project`, `Mask`, `Variant` Prisma models (or expanded from base)
- `project` router + `variant.generate` mutation
- `MaskCanvas` component
- Project page UI with upload/mask/generate/view

### 3.6 PM verification checklist

- Mask saves correctly and is used by edit call
- Arabic variant demonstrates RTL text placement (even if imperfect—improve in Sprint 2)
- No external services required

---

## 4) Sprint 2 — Differentiators: Drift Inspector + RTL Wow + Constraint Plan

> **STATUS: COMPLETE** (2025-12-17)

### 4.1 Sprint goal

Turn LocaleLens from “it works” to “it wins” by adding professional-grade QA signals and robust text constraints.

### 4.2 Scope (must ship)

1) **Locale Plan Generator (text constraints)**
   - Create a deterministic locale plan per locale:
     - target text lines (headline, bullets, CTA)
     - character caps per region
     - layout constraints (alignment, font feel)
   - For Arabic:
     - explicit RTL direction
     - right alignment guidance
2) **Prompt hardening**
   - Prompts must include:
     - “Only modify masked regions”
     - “Preserve the rest of the image exactly”
     - “Maintain original typography style and alignment”
3) **Drift Inspector**
   - Compute pixel-level diff between base and output
   - Compute “outside-mask drift score”
   - Generate a heatmap overlay image
   - Display:
     - drift score
     - PASS/WARN/FAIL status
     - overlay toggle
4) **Regeneration controls**
   - If drift FAIL:
     - “Regenerate with stricter constraints” button
     - optionally reduce creativity/variation terms in prompt template
5) **Export improvements**
   - “Export ZIP” for all variants in a project
   - Create a README-ready montage (2x2 grid: original + 3 locales)

### 4.3 Out of scope (explicit)

- Auto OCR
- Font extraction / typography cloning beyond prompt constraints
- Hosted demo

### 4.4 Acceptance criteria (measurable)

- For the official demo image:
  - `es-MX`, `fr-CA`, `ar` generate reliably
  - Drift score outside mask is computed for each
  - At least 2 of 3 locales achieve PASS (≤ target threshold) in a typical run
- Drift heatmap overlay visually highlights changes and proves the tool’s rigor
- Export ZIP contains all generated images and a montage
- A judge can follow the demo script and reproduce the gallery

### 4.5 Deliverables

- `src/server/services/localePlan.ts`
- `src/server/services/diffService.ts` (+ heatmap generator)
- UI: Drift Inspector panel with overlay toggle
- Export ZIP route/mutation + montage generator

### 4.6 PM verification checklist

- Drift score is meaningful (changes outside mask are detected)
- Arabic output is visibly RTL and not just “Arabic text somewhere”
- Montage looks good enough to paste into README

---

## 5) Sprint 3 — Submission Polish: README, Demo Script, and Gallery

> **STATUS: COMPLETE** (2025-12-17)

### 5.1 Sprint goal

Make the repo “judge-optimized”: fast setup, clear docs, impressive screenshots, zero ambiguity.

### 5.2 Scope (must ship)

1) **README overhaul (contest format)**
   - 30-second pitch
   - “How it uses Image Gen 1.5” (edits + text rendering + fidelity)
   - Quickstart steps
   - Screenshots gallery (original + 3 locales + drift overlay)
   - Troubleshooting section
2) **docs/DEMO_SCRIPT.md finalized**
   - exact demo image(s)
   - exact locales
   - exact prompts (or fixed templates and inputs)
   - expected outputs
3) **docs/CONTEST_SPEC.md review**
   - ensure accurate, concise enough, and aligned with actual implementation
4) **Repo hygiene**
   - confirm `.env.example` complete
   - ensure `.local-data/` ignored
   - ensure no generated binaries committed
5) **“One-command demo” helper**
   - add a small script: `pnpm demo` that:
     - checks env
     - prints a guided sequence
     - optionally seeds the demo project assets

### 5.3 Acceptance criteria (measurable)

- A judge can:
  - clone the repo
  - create `.env` from `.env.example`
  - run `pnpm install`, `pnpm db:push`, `pnpm dev`
  - follow DEMO_SCRIPT to produce the 3-locale gallery
- README gallery matches what DEMO_SCRIPT produces
- No secrets, no broken links, no missing steps

### 5.4 Deliverables

- Final README.md
- Final DEMO_SCRIPT.md
- Optional `scripts/demo.ts` (or similar) wired to `pnpm demo`

### 5.5 PM verification checklist

- README is “clean and confident,” not verbose
- Screenshots are compelling and consistent
- Setup is truly frictionless on Windows

---

## 6) Sprint 4 — SOLID/SRP Architecture Refactoring

> **STATUS: COMPLETE** (2025-12-18)

### 6.1 Sprint goal

Refactor the codebase to achieve full SOLID/SRP compliance, making it maintainable, testable, and professional-grade.

### 6.2 Scope (completed)

1) **Custom Hooks Layer** (`src/hooks/`)
   - `useProjectQueries` — Centralized data fetching orchestration
   - `useProjectMutations` — Mutation orchestration with callbacks
   - `useMaskEditor` — Mask editor state and canvas operations
   - `useWorkflow` — Step navigation and progression logic
   - `useResultsState` — Results display state management
   - `useVariantImage` — Single variant image fetching (replaces broken useVariantImages)

2) **Step Components** (`src/components/project/steps/`)
   - `UploadStep` — Upload sidebar + canvas
   - `MaskStep` — Mask sidebar + canvas
   - `GenerateStep` — Generate sidebar + canvas
   - `ResultsStep` — Results sidebar + canvas

3) **Sidebar Components** (`src/components/project/sidebar/`)
   - `UploadSidebar` — File upload and demo loader controls
   - `MaskSidebar` — Tool palette with brushes, shapes, history
   - `GenerateSidebar` — Locale selection with progress tracking
   - `ResultsSidebar` — Variant list with drift badges and export

4) **Backend Orchestrators** (`src/server/services/`)
   - `ImageUploadOrchestrator` — Base64 decode → file save → DB update pipeline
   - `ExportOrchestrator` — Montage/ZIP generation pipeline

5) **Router Simplification**
   - `project.ts`: Reduced from 430 → 267 lines (-38%)
   - Thin delegation layer to orchestrators and repositories

6) **UI Components**
   - `MaskCanvasCore` — Imperative canvas API for mask editing
   - `StepProgress` — Workflow progress indicator
   - `ToolButton/ToolGroup` — Reusable tool palette primitives
   - New shadcn/ui components: resizable, scroll-area, slider, toggle, tooltip

### 6.3 Acceptance criteria (met)

- ✅ All TypeScript strict mode compliant
- ✅ Page component under 400 lines
- ✅ Router handlers under 10 lines each (delegation only)
- ✅ Each hook has single responsibility
- ✅ Each step component renders one workflow step
- ✅ No React hooks rule violations

### 6.4 Metrics achieved

- `page.tsx`: 600 → 360 lines (-40%)
- `project.ts`: 430 → 267 lines (-38%)
- 30 new files with clear single responsibilities

---

## 7) Sprint 5 — Visual Polish (Contest-Winning Presentation)

> **STATUS: COMPLETE** (2025-12-18)

### 7.1 Sprint goal

Transform the functional UI into a visually impressive, contest-winning presentation that creates immediate "wow factor" for judges.

### 7.2 Scope (completed)

1) **Glass Morphism Styling** ✅
   - Frosted glass effect on sidebar (`backdrop-blur-xl bg-background/80`)
   - Subtle gradient background on canvas area
   - Glass utility classes added to globals.css

2) **Animations & Transitions** ✅
   - Step transitions with fade-in animations
   - Enhanced StepProgress component with animated connectors
   - Active step glow effect with ring indicator
   - Smooth tool button transitions

3) **Loading States** ✅
   - `GenerationProgress` component with per-locale status tracking
   - Progress bar with estimated time remaining
   - Status icons per locale (pending → generating → complete → failed)
   - Canvas overlay showing current locale being generated
   - RTL badge for Arabic locale

4) **Error Handling** ✅
   - `ErrorBoundary` component with graceful fallback UI
   - Collapsible technical details
   - Retry and Go Home buttons
   - Project layout wrapper with error boundary

5) **Keyboard Shortcuts** ✅
   - `useKeyboardShortcuts` hook for mask editing
   - Ctrl+Z/Cmd+Z for undo
   - Ctrl+Y/Cmd+Shift+Z for redo
   - B for Edit Brush, R for Rectangle, E for Ellipse, X for Keep Brush
   - Ctrl+S to save mask
   - Shortcut badges displayed on tool buttons
   - Shortcuts shown in tooltips

### 7.3 Deliverables

- `src/components/project/GenerationProgress.tsx` — Per-locale progress component
- `src/components/ErrorBoundary.tsx` — Error boundary with recovery UI
- `src/hooks/useKeyboardShortcuts.ts` — Keyboard event handling
- `src/app/project/[id]/layout.tsx` — Error boundary wrapper
- Updated `src/styles/globals.css` — Glass morphism utilities
- Updated `src/components/project/StepProgress.tsx` — Enhanced animations
- Updated `src/components/project/ToolButton.tsx` — Shortcut display
- Updated `src/components/project/sidebar/MaskSidebar.tsx` — Shortcut hints
- Updated `src/components/project/sidebar/GenerateSidebar.tsx` — Progress integration
- Updated `src/components/project/steps/GenerateStep.tsx` — Generation overlay

### 7.4 Acceptance criteria (met)

- ✅ First impression is visually impressive (not just functional)
- ✅ Animations are smooth and purposeful
- ✅ Loading states provide meaningful feedback
- ✅ No jarring transitions or layout shifts
- ✅ Keyboard shortcuts functional with visual indicators

---

## 8) Sprint 6 — CRITICAL: OpenAI API Optimization & Drift Fix

> **STATUS: IN PROGRESS** (2025-12-18)
> **PRIORITY: HIGHEST - BLOCKING CONTEST SUBMISSION**

### 8.1 Sprint goal

Fix the critical drift issue (currently 14.5% - FAILING) by optimizing OpenAI Image Edit API usage. The entire point of this contest is to showcase expert use of the gpt-image-1.5 API.

### 8.2 Current Problems

1) **Drift Score Failing** — 14.5% drift outside mask (threshold is likely 5-10%)
   - Generated images are not preserving areas outside the mask
   - Images appear vertically compressed (top-to-bottom distortion)
   - UI elements like buttons are being modified when they shouldn't be
   - The AI is making changes beyond just the text in the masked region

2) **API Parameters Not Optimized** — Current implementation uses minimal parameters:
   - No `input_fidelity` parameter (critical for preserving original image features)
   - No explicit `quality` setting
   - May not be using optimal `size` for the input images

3) **Prompts May Need Hardening** — Current prompts may not be strict enough about:
   - Preserving exact pixel fidelity outside masked regions
   - Preventing any modifications to non-text elements
   - Maintaining original image dimensions and proportions

### 8.3 Scope (must ship)

1) **API Parameter Optimization**
   - Add `input_fidelity: "high"` to gpt-image-1 calls (preserves style/features)
   - Set explicit `quality: "high"` for maximum fidelity
   - Verify `size` matches input image dimensions exactly
   - Consider `background: "opaque"` to prevent transparency issues

2) **Prompt Engineering Hardening**
   - Review and strengthen prompts in `localePlan.service.ts`
   - Add explicit constraints: "DO NOT modify ANY pixels outside the masked region"
   - Add constraints about maintaining exact image dimensions
   - Add constraints about preserving UI elements (buttons, icons, etc.)

3) **Image Processing Review**
   - Verify mask format is correct for OpenAI API (transparent = edit, opaque = preserve)
   - Check if image resizing is causing distortion
   - Ensure aspect ratio is preserved throughout pipeline

4) **Drift Threshold Tuning**
   - Review drift calculation in `diffService.ts`
   - Ensure threshold is appropriate for the use case
   - Consider if pixel comparison methodology is correct

### 8.4 Key Files to Review/Modify

- `src/server/services/openaiImage.ts` — API call parameters
- `src/server/domain/services/localePlan.service.ts` — Prompt templates
- `src/server/domain/services/variantGeneration.service.ts` — Generation pipeline
- `src/server/services/diffService.ts` — Drift calculation
- `src/server/services/fileStore.ts` — Image handling

### 8.5 Acceptance criteria

- [ ] Drift score ≤ 5% for all three locales (es-MX, fr-CA, ar)
- [ ] Generated images maintain exact dimensions of original
- [ ] Non-masked areas are pixel-perfect or near-perfect
- [ ] UI elements (buttons, icons) are unchanged
- [ ] Only text within masked regions is modified

### 8.6 OpenAI API Reference (Critical Parameters)

From the official API documentation:

**For `images.edit` endpoint:**

- `input_fidelity`: "high" | "low" — Controls style/feature matching (USE HIGH!)
- `quality`: "high" | "medium" | "low" — Image quality level
- `size`: "1024x1024" | "1536x1024" | "1024x1536" | "auto"
- `background`: "transparent" | "opaque" | "auto"

**Mask format:**

- Transparent areas (alpha=0) = regions to edit
- Opaque areas (alpha=255) = regions to preserve

---

## 9) Sprint 7 (Optional) — Bonus Features

### 9.1 Candidate features

- Mask region "suggestions" (semi-automatic bounding boxes)
- Batch mode: multiple images, same locales
- Preset templates (App Store, Poster, Banner)
- "Compact copy" auto-variants for German/long text languages

### 9.2 Rule

Only execute Sprint 7 if Sprints 0–6 are fully complete and stable.

---

## 10) Engineering Quality Standards (applies to all sprints)

### 10.1 Code standards

- Strict TypeScript, no `any` in core services
- Deterministic file naming
- Clear separation:
  - UI components
  - server routers
  - services
  - storage layer

### 10.2 Testing

- Unit tests where high-value:
  - drift scoring correctness
  - file store path handling
  - locale plan formatting
- Manual tests:
  - end-to-end demo script

### 10.3 Logging

- Server logs must include:
  - projectId
  - locale
  - generation duration
  - drift score
- Never log API keys

---

## 11) Definition of "1st Prize" Readiness

LocaleLens is “1st prize ready” when:

- It is fully reproducible locally with minimal steps
- Outputs are visually impressive and consistent
- Drift Inspector demonstrates professional QA mindset
- Docs + demo script are airtight
- README gallery makes judges want to run it immediately

---
