# LocaleLens — Engineering Decisions Log

> This document records key engineering decisions and assumptions made during implementation that were not explicitly defined in the spec.

---

## Sprint 0 Decisions

### ED-001: Image Model Default

**Decision:** Default to `gpt-image-1.5` with `gpt-image-1` as fallback

**Rationale:**

- The contest focuses on Image Gen 1.5, so we default to `gpt-image-1.5` as primary
- Fallback to `gpt-image-1` if primary model fails (API availability varies by region/account)
- Both models are configurable via environment variables (`IMAGE_MODEL`, `IMAGE_MODEL_FALLBACK`)
- Pinned edit size of `1024x1536` for portrait demo consistency

**Impact:** Demo showcases 1.5 capabilities while ensuring reliability across all accounts.

---

### ED-002: Tailwind CSS v4 + shadcn/ui

**Decision:** Use Tailwind CSS v4 with the new PostCSS plugin approach

**Rationale:**

- T3 app initialized with Tailwind v4 (latest)
- shadcn/ui has official support for Tailwind v4 as of late 2024
- Modern CSS variables approach with OKLCH color space
- Better dark mode support with `@custom-variant`

**Impact:** Modern, future-proof styling system with excellent dark mode support.

---

### ED-003: Local File Storage Structure

**Decision:** Store all project files under `.local-data/projects/{projectId}/`

**Rationale:**

- Deterministic file naming for reproducibility
- Easy to locate and verify outputs
- Single gitignore entry covers all generated content
- Structure mirrors the conceptual data model

**File Layout:**

```text
.local-data/
├── outputs/          # Test generation outputs
└── projects/
    └── {projectId}/
        ├── base.png
        ├── mask.png
        ├── variants/
        │   ├── es-MX.png
        │   ├── fr-CA.png
        │   └── ar.png
        └── exports/
            ├── montage_2x2.png
            └── localelens_{projectId}_variants.zip
```

**Impact:** Clear separation of concerns, easy debugging, consistent paths across OS.

---

### ED-004: No Authentication for v1

**Decision:** Skip authentication entirely for the contest submission

**Rationale:**

- Explicitly stated in CONTEST_SPEC as a non-goal
- Reduces judge friction (no signup/login required)
- Local-first approach means data never leaves the machine
- Security focus is on API key handling, not user auth

**Impact:** Faster setup, cleaner UX, focused scope.

---

### ED-005: Server-Side Only OpenAI Calls

**Decision:** All OpenAI API calls execute server-side via tRPC mutations

**Rationale:**

- API key never exposed to client bundle
- Follows security best practices
- tRPC provides type safety end-to-end
- Easy to add rate limiting or logging if needed

**Impact:** Secure by design, no client-side key exposure risk.

---

### ED-006: Base64 Image Transfer for UI Display

**Decision:** Return generated images as base64 data URIs to the client

**Rationale:**

- Avoids need for a separate static file serving route
- Immediate display without additional requests
- Works well for moderate-sized images (1024x1024)
- Files are also saved to disk for persistence

**Trade-offs:**

- Larger response payload
- Not suitable for very large images (would need streaming)

**Impact:** Simple, self-contained image display; files persisted for export.

---

### ED-007: Demo Asset Folder Name

**Decision:** Renamed `demo-assetrs` to `demo-assets` (typo fix)

**Rationale:** Original folder had a typo; corrected for clarity and consistency.

**Impact:** Demo script paths now match documentation.

---

## Sprint 1 Decisions

### ED-008: Mask Format and Alpha Channel

**Decision:** Use PNG with alpha channel where transparent = editable regions

**Rationale:**

- OpenAI image edit API expects mask where transparent pixels indicate areas to modify
- PNG preserves alpha channel without compression artifacts
- Canvas `destination-out` composite operation creates clean transparency
- White pixels (opaque) = preserve, Transparent pixels = edit

**Impact:** Clean mask generation that works directly with OpenAI API.

---

### ED-009: Domain Layer Architecture (SOLID/SRP)

**Decision:** Implement clean architecture with distinct layers

**Structure:**

```text
src/server/
├── domain/           # Pure business logic, no dependencies
│   ├── entities/     # Type definitions
│   ├── repositories/ # Interfaces only (ISP)
│   ├── services/     # Domain services
│   └── value-objects/# Immutable value types
├── infrastructure/   # Implementations (DIP)
│   └── repositories/ # Prisma implementations
└── services/         # Application services
```

**Rationale:**

- **S**ingle Responsibility: Each module has one job
- **O**pen/Closed: Interfaces allow extension without modification
- **L**iskov Substitution: Repository implementations interchangeable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: High-level modules depend on abstractions

**Impact:** Testable, maintainable, professional-grade architecture.

---

### ED-010: LocalePlanService with Verbatim Prompts

**Decision:** Use exact DEMO_SCRIPT prompts without modification

**Rationale:**

- Contest reproducibility requires deterministic outputs
- DEMO_SCRIPT Section 7 contains exact localized copy
- DEMO_SCRIPT Section 9 contains exact prompt template
- Any deviation could affect output quality assessment

**Implementation:**

```typescript
const BASE_PROMPT_TEMPLATE = `You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
...`
```

**Impact:** Guaranteed prompt consistency with documented demo script.

---

### ED-011: One-Click Demo Project Loader

**Decision:** Implement `loadDemoProject` mutation for instant setup

**Rationale:**

- Judges need fast path to "wow moment"
- Eliminates manual upload/mask creation steps
- Uses canonical assets from `docs/demo-assets/`
- Creates project with base image + mask pre-loaded

**Impact:** Sub-5-minute demo experience for judges.

---

### ED-012: Sequential Variant Generation

**Decision:** Generate variants sequentially, not in parallel

**Rationale:**

- Avoids OpenAI rate limiting issues
- Provides clear progress feedback
- Easier error handling per-locale
- Console logs show progress: `(1/3)`, `(2/3)`, `(3/3)`

**Trade-off:** Slower total time, but more reliable.

**Impact:** Robust generation even on rate-limited accounts.

---

## Sprint 2 Decisions

### ED-013: Drift Calculation Algorithm

**Decision:** Pixel-by-pixel RGB comparison with Euclidean distance

**Implementation:**

- Compare each pixel outside mask between original and variant
- Use Euclidean distance in RGB space: `sqrt((r1-r2)² + (g1-g2)² + (b1-b2)²)`
- Threshold: distance > 30 = "changed pixel"
- Score = (changed pixels outside mask) / (total pixels outside mask) * 100

**Thresholds:**

- PASS: ≤ 2.0%
- WARN: 2.0% – 5.0%
- FAIL: > 5.0%

**Impact:** Provides meaningful QA signal that distinguishes LocaleLens from basic wrappers.

---

### ED-014: Montage Layout

**Decision:** 2×2 grid with labels, dark theme

**Layout:**

```text
┌──────────────┬──────────────┐
│   Original   │   Spanish    │
│   (English)  │   (es-MX)    │
├──────────────┼──────────────┤
│   French     │   Arabic     │
│   (fr-CA)    │   (ar)       │
└──────────────┴──────────────┘
```

**Rationale:** Fits README display, shows all 4 images at comparable size.

---

### ED-015: Export ZIP Structure

**Decision:** Flat structure with clear naming

**Structure:**

```text
localelens_{projectId}_variants.zip
├── base.png
├── mask.png
├── variants/
│   ├── es-MX.png
│   ├── fr-CA.png
│   └── ar.png
├── drift/
│   ├── es-MX_heatmap.png
│   ├── fr-CA_heatmap.png
│   └── ar_heatmap.png
├── montage_2x2.png
└── README.txt
```

---

## Sprint 4 Decisions (UI/UX Refactoring)

### ED-016: SOLID/SRP Frontend Architecture Refactoring

**Decision:** Complete architectural refactoring to achieve full SOLID compliance

**Date:** 2025-12-17

**Rationale:**

- Original `page.tsx` was 600+ lines doing everything (state, queries, mutations, rendering)
- Router `project.ts` was 430+ lines with orchestration logic mixed into handlers
- Violated Single Responsibility Principle throughout

**New Architecture:**

```text
src/
├── hooks/                          # Custom React hooks (SRP)
│   ├── useProjectQueries.ts        # Data fetching orchestration
│   ├── useProjectMutations.ts      # Mutation orchestration
│   ├── useMaskEditor.ts            # Mask editor state
│   ├── useWorkflow.ts              # Step navigation logic
│   ├── useResultsState.ts          # Results display state
│   └── index.ts                    # Re-exports
├── components/project/
│   ├── steps/                      # Step-based components (SRP)
│   │   ├── UploadStep.tsx          # Upload sidebar + canvas
│   │   ├── MaskStep.tsx            # Mask sidebar + canvas
│   │   ├── GenerateStep.tsx        # Generate sidebar + canvas
│   │   └── ResultsStep.tsx         # Results sidebar + canvas
│   ├── sidebar/                    # Sidebar-only components
│   │   ├── UploadSidebar.tsx
│   │   ├── MaskSidebar.tsx
│   │   ├── GenerateSidebar.tsx
│   │   └── ResultsSidebar.tsx
│   ├── MaskCanvasCore.tsx          # Imperative canvas API
│   ├── StepProgress.tsx            # Workflow indicator
│   └── ToolButton.tsx              # Reusable tool components
└── server/services/
    ├── imageUploadOrchestrator.ts  # Upload pipeline coordination
    └── exportOrchestrator.ts       # Export pipeline coordination
```

**Metrics:**

- `page.tsx`: 600 → 360 lines (-40%)
- `project.ts` router: 430 → 267 lines (-38%)
- 30 new files created with clear single responsibilities

**Impact:** Professional, maintainable, testable codebase suitable for contest submission.

---

### ED-017: Sidebar + Canvas Layout

**Decision:** Fixed-width sidebar (288px) with flexible canvas area

**Previous Approach:** Attempted resizable panels, but caused UX issues (toolbar overlap)

**Final Approach:**

```text
┌────────────────────────────────────────────────────────┐
│  Header: Logo | Project Name | Step Progress | Badge  │
├──────────┬─────────────────────────────────────────────┤
│          │                                             │
│  Sidebar │              Canvas Area                    │
│  (w-72)  │            (flex-1, centered)               │
│          │                                             │
│  Tools   │                                             │
│  Actions │                                             │
│          │                                             │
└──────────┴─────────────────────────────────────────────┘
```

**Rationale:** Fixed width ensures consistent tool visibility; simpler than resizable panels.

---

### ED-018: Step-Based Workflow UI

**Decision:** Four-step workflow with progress indicator

**Steps:**

1. **Upload** — Upload base image or load demo
2. **Mask** — Paint editable regions with tools
3. **Generate** — Select locales and generate variants
4. **Results** — Compare variants, view drift, export

**Navigation Rules:**

- Can only advance when current step requirements are met
- Can always go back to completed steps
- Progress indicator shows completed/active/disabled states

---

### ED-019: Conditional Demo Features

**Decision:** Demo-specific buttons only show for demo projects

**Implementation:**

```typescript
const isDemoProject = project?.name?.toLowerCase().includes("demo") ?? false;

// Only show "Load Demo Mask" for demo projects
onLoadDemo={isDemoProject ? handleLoadDemoMask : undefined}

// Only show "Demo Mode" generation for demo projects
onDemoMode={isDemoProject ? handleDemoMode : undefined}
```

**Rationale:** Non-demo projects shouldn't have demo buttons cluttering the UI.

---

## Sprint 6 Decisions (gpt-image-1.5 Mastery)

### ED-020: gpt-image-1.5 as Primary Model (Contest Requirement)

**Decision:** Use gpt-image-1.5 exclusively for the contest submission

**Date:** 2025-12-18

**Rationale:**

- Contest explicitly requires showcasing gpt-image-1.5
- `input_fidelity` parameter is ONLY available for gpt-image-1, NOT gpt-image-1.5
- Must rely on other strategies for image preservation:
  - Prompt engineering (surgical precision)
  - API parameters (`quality: "high"`, `background: "opaque"`)
  - Post-processing (pixel-perfect composite mode)

**Impact:** Strategy pivots from API parameter reliance to multi-pronged approach.

---

### ED-021: API Parameter Maximization

**Decision:** Use ALL available gpt-image-1.5 parameters for maximum quality

**Configuration:**

```typescript
{
  model: "gpt-image-1.5",
  size: "auto",           // Let API optimize for input
  quality: "high",        // Maximum quality output
  background: "opaque",   // Prevent transparency issues
  output_format: "png",   // Lossless format
}
```

**Rationale:**

- `quality: "high"` — Reduces compression artifacts
- `background: "opaque"` — Prevents unwanted transparency
- `output_format: "png"` — Ensures lossless output
- `size: "auto"` — Lets API choose optimal dimensions

**Impact:** Better baseline quality before any post-processing.

---

### ED-022: Pixel-Perfect Composite Mode

**Decision:** Implement mask-based compositing for guaranteed 0% drift

**Algorithm:**

1. Generate variant using gpt-image-1.5
2. Resize generated output to match original dimensions
3. For each pixel:
   - If mask is opaque (alpha > 127): use ORIGINAL pixel
   - If mask is transparent (alpha <= 127): use GENERATED pixel
4. Result: 0% drift outside mask guaranteed

**Implementation:** New `CompositeService` class

**Rationale:**

- Without `input_fidelity`, API cannot guarantee preservation
- Compositing provides deterministic pixel-perfect results
- Shows professional production workflow thinking
- Differentiates us from other contest entries

**Trade-offs:**

- Additional processing time (~50-100ms)
- Must ensure dimension matching before composite

**Impact:** Guaranteed 0% drift — contest differentiator.

---

### ED-023: Surgical Prompt Engineering

**Decision:** Use extremely precise prompts since `input_fidelity` unavailable

**Template Structure:**

```text
CRITICAL CONSTRAINTS (VIOLATION = FAILURE):
1. ONLY modify pixels inside the transparent/masked regions
2. Every pixel outside the mask MUST remain BYTE-FOR-BYTE IDENTICAL
3. Do NOT reinterpret, enhance, or "improve" ANY part of the image
4. MATCH the original text EXACTLY: font style, weight, size, color
...
```

**Rationale:**

- Prompts are our PRIMARY lever for preservation with gpt-image-1.5
- Explicit negative constraints help prevent unwanted modifications
- Medical/surgical terminology emphasizes precision requirement

**Impact:** Improved raw API output quality before compositing.

---

### ED-024: Multi-Generation with Auto-Selection

**Decision:** Generate n > 1 variants and auto-select best by drift score

**Configuration:**

- Default: n = 1 (single generation)
- With selection: n = 2-3 (generate multiple, return lowest drift)

**Algorithm:**

1. Generate N variants in single API call
2. Compute quick drift score for each
3. Return variant with lowest drift
4. Log selection for transparency

**Rationale:**

- API variability means some generations are better than others
- Selection increases probability of good result
- Single API call for multiple variants is cost-efficient

**Trade-offs:**

- 2-3x API cost when using selection
- Slightly longer total time

**Impact:** Higher quality raw output before compositing.

---

### ED-025: Image Dimension Handling

**Decision:** Use `size: "auto"` and post-resize to original dimensions

**Problem:**

- Source image: 1080×1920 (ratio 0.5625)
- API option 1024×1536 (ratio 0.667)
- Different aspect ratios cause distortion!

**Solution:**

1. Store original dimensions before API call
2. Use `size: "auto"` to let API optimize
3. Post-resize output to exact original dimensions
4. Use Sharp with `fit: "fill"` for precise match

**Implementation:** New `ImageProcessingService` class

**Rationale:**

- `size: "auto"` may produce better quality than forced size
- Post-resize ensures pixel-perfect dimension match
- Eliminates vertical compression issue

**Impact:** No more distorted outputs.

---

### ED-026: Streaming with Partial Images (Advanced)

**Decision:** Implement streaming for progressive generation preview

**Parameters:**

```typescript
{
  stream: true,
  partial_images: 2,  // Show 2 progressive previews
}
```

**Rationale:**

- Showcases advanced gpt-image-1.5 capability
- Better UX during ~10-15 second generation
- Differentiates from basic API wrappers

**Implementation:**

- AsyncGenerator for streaming results
- UI updates with partial previews
- Smooth transition to final result

**Impact:** Better UX and API showcase.

---

### ED-027: Drift Threshold Adjustment

**Decision:** Maintain current thresholds, composite mode handles edge cases

**Thresholds (unchanged):**

- PASS: ≤ 2.0%
- WARN: 2.0% – 5.0%
- FAIL: > 5.0%

**Rationale:**

- With pixel-perfect composite mode, 0% drift is achievable
- Raw API output threshold of 5% is reasonable with optimizations
- Thresholds reflect professional quality standards

**Impact:** Clear quality gates for variant acceptance.

---

### ED-028: Streaming SSE Implementation

**Decision:** Implement streaming via Server-Sent Events (SSE) instead of WebSocket

**Rationale:**

- SSE is simpler for unidirectional streaming (server → client)
- Better compatibility with Next.js App Router
- No additional dependencies required
- Browser support is excellent
- Easier to implement proper error handling and reconnection

**Implementation:**

- `/api/variant/stream` SSE endpoint using ReadableStream
- `useStreamingGeneration` React hook for consumption
- Event types: `start`, `partial`, `processing`, `complete`, `error`

**Impact:** Clean, maintainable streaming implementation that showcases gpt-image-1.5's streaming capability.

---

### ED-029: Icon Preservation via Prompt Engineering

**Decision:** Add explicit icon preservation instructions to prompts rather than creating separate icon masks

**Rationale:**

- Creating separate masks for icons adds complexity
- The mask already covers text regions that may include adjacent icons
- Explicit instructions to preserve specific icon counts (e.g., "exactly 3 checkmarks")
- More robust than trying to detect and mask individual icons

**Implementation:**

- Added "ICON PRESERVATION (CRITICAL)" section to prompts
- Explicit count constraints ("EXACTLY 3 checkmark icons")
- Negative constraints ("Do NOT add, remove, duplicate, or modify ANY icons")
- Both SURGICAL_PROMPT_TEMPLATE and ULTRA_STRICT_PROMPT_TEMPLATE updated

**Trade-off:** Relies on model following instructions rather than technical enforcement. Pixel-perfect composite mode provides fallback guarantee for areas outside mask.

**Impact:** Addresses visual quality issues where icons were being regenerated or duplicated.

---

### ED-030: Streaming Partial Images Count

**Decision:** Default to 2 partial images during streaming

**Rationale:**

- 0 partial images = no progressive preview
- 1 partial image = one intermediate step
- 2 partial images = good balance of feedback vs cost (each partial incurs cost)
- 3 partial images = maximum, but diminishing returns

**Impact:** Good UX balance between real-time feedback and API costs.

---

### ED-031: Streaming UI Integration Pattern

**Decision:** Wire streaming toggle to SSE endpoint via React hook, with conditional canvas rendering

**Date:** 2025-12-18

**Implementation:**

1. Added `useStreamingGeneration` hook to project page
2. Modified `handleGenerate` to branch based on `streamingEnabled` state:
   - Single locale: Direct streaming for best UX
   - Multiple locales: Sequential streaming with progress updates
   - Disabled: Use existing tRPC mutation
3. Updated `GenerateStepCanvas` to render `StreamingPreview` when streaming is active
4. Combined `isGenerating` state: `mutations.isGenerating || streaming.isStreaming`

**Rationale:**

- Hook-based pattern keeps streaming logic encapsulated
- Conditional branching allows graceful fallback to tRPC
- Sequential multi-locale streaming provides progress visibility
- Canvas swaps seamlessly between modes for consistent UX

**Key Files Modified:**

- `src/app/project/[id]/page.tsx` — Hook integration, branching logic
- `src/components/project/steps/GenerateStep.tsx` — Canvas streaming support
- `src/hooks/index.ts` — Already exported streaming types

**Impact:** Streaming toggle now produces the "wow factor" progressive image reveal that showcases gpt-image-1.5's streaming capability to contest judges.

---

### ED-032: SSE Parsing Cross-Chunk State Preservation

**Decision:** Move SSE event type tracking variables outside the while loop to preserve state across network chunks

**Date:** 2025-12-18

**Problem:**
The OpenAI streaming API returns SSE events split across network chunks. If `event: image_edit.partial_image` arrives in one chunk and `data: {...}` arrives in the next, the event type was being lost because variables were reset on each iteration.

**Solution:**

```typescript
// BEFORE (broken): Variables reset each iteration
while (true) {
  let currentEventType = "";  // Reset!
  // ...
}

// AFTER (fixed): Variables persist across chunks
let currentEventType = "";
while (true) {
  // currentEventType preserves value from previous chunk
  // ...
}
```

**Key Files:**

- `src/server/services/openaiImage.ts` — Server-side SSE parsing
- `src/hooks/useStreamingGeneration.ts` — Client-side SSE parsing

**Impact:** Streaming now correctly parses SSE events regardless of how they're chunked by the network, achieving reliable partial image delivery.

---

### ED-033: Mask Auto-Resize to Match Base Image Dimensions

**Decision:** Automatically resize user-drawn masks to match base image dimensions before saving

**Date:** 2025-12-18

**Problem:**
The canvas displays images at a scaled resolution (540×960 for 1080×1920 base images) for performance and UX. When users draw masks on the canvas and save, the mask was being saved at canvas resolution. OpenAI's image edit API requires the mask to exactly match the base image dimensions, causing "400 Invalid mask image format - mask size does not match image size" errors.

**Solution:**
In `ImageUploadOrchestrator.uploadMask()`:

1. Get base image from file store
2. Compare base image dimensions to incoming mask dimensions
3. If they differ, use sharp to resize mask with `kernel: "nearest"` to preserve hard edges
4. Save the resized mask

```typescript
const baseMetadata = await sharp(baseImageBuffer).metadata();
const maskMetadata = await sharp(maskBuffer).metadata();

if (maskMetadata.width !== baseMetadata.width ||
    maskMetadata.height !== baseMetadata.height) {
  maskBuffer = await sharp(maskBuffer)
    .resize(baseMetadata.width, baseMetadata.height, {
      fit: "fill",
      kernel: "nearest", // Preserve hard mask edges
    })
    .png()
    .toBuffer();
}
```

**Key Files:**

- `src/server/services/imageUploadOrchestrator.ts` — Mask upload with auto-resize

**Impact:** Users can draw masks at any canvas scale and they will automatically match the base image, ensuring OpenAI API compatibility.

---

### ED-034: Localization Context in Prompts

**Decision:** Frame prompts as localization/translation tasks rather than generic text replacement

**Date:** 2025-12-18

**Problem:**
The model was producing misaligned text: headlines cut off, bullet text not starting at checkmark positions, button text not centered. The original prompt said "SURGICAL text replacement" but didn't explain WHY we were replacing text.

**Solution:**
Updated prompts to explicitly state:

1. This is a LOCALIZATION/TRANSLATION task
2. Text should occupy the EXACT same positions as the original
3. Checkmarks are anchor points - text starts right after them
4. Button text should be centered in the button
5. Headlines stay centered in their container

```typescript
const SURGICAL_PROMPT_TEMPLATE = `You are a LOCALIZATION TOOL performing text translation on an app store screenshot.

TASK: Replace English text with {LOCALE} translations. This is a SURGICAL text substitution - the translated text must occupy the EXACT same visual positions as the original English text.

LOCALIZATION RULES (CRITICAL):
1. This is TRANSLATION - you are replacing English words with their {LOCALE} equivalents
2. The NEW text must START at the SAME position as the original text
3. If text is next to a checkmark icon, the text starts RIGHT AFTER the checkmark
4. If text is inside a button, it must be CENTERED in that button
...`
```

**Key Files:**

- `src/server/domain/services/localePlan.service.ts` — Updated prompt templates

**Impact:** The model better understands the task context, producing better-aligned text that respects visual anchor points (checkmarks, button bounds).

---

## How to Add Decisions

When making a decision not covered by the spec:

1. Add an entry with a unique ID (ED-XXX)
2. State the decision clearly
3. Explain the rationale
4. Note any trade-offs or impacts
5. Update this document in the same commit as the implementation
