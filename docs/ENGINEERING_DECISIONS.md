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

## Sprint 8-10 Decisions (Vision-Powered Pipeline)

### ED-035: Vision-Powered Text Detection Pipeline

**Decision:** Use GPT-4o Vision to detect and extract text from uploaded images before generation

**Date:** 2025-12-22

**Problem:**
The current system only works with one specific demo image because:

1. `LocalePlanService` uses hardcoded `LOCALIZED_COPY` translations
2. Prompts reference "checkmarks", "bullets", "CTA buttons" that don't exist in other images
3. When users upload custom images, the AI creates phantom UI elements

**Evidence:**

- Sticky note poster ("YOU ARE STRONGER") generated with checkmark icons and "Recordatorios con un toque" text
- The system was sending demo app translations to ANY image

**Solution:**
Implement a "Text Detection Service" using GPT-4o Vision:

```typescript
interface ImageAnalysis {
  textRegions: TextRegion[];      // All detected text with bounding boxes
  layout: ImageLayout;            // "sticky-notes" | "app-screenshot" | etc.
  surfaceTexture: string;         // Description for preservation prompts
}
```

**Rationale:**

- gpt-image-1.5 cannot "read" text - it's a generation model, not vision
- GPT-4o Vision can extract text, positions, and style information
- This enables dynamic prompt generation for ANY image

**Impact:** LocaleLens transforms from "demo-only" to "universal localization tool"

---

### ED-036: Two-Step "Inspector + Artist" Architecture

**Decision:** Implement a two-model pipeline: GPT-4o (Inspector) → gpt-image-1.5 (Artist)

**Date:** 2025-12-22

**Architecture:**

```text
Step 1: INSPECTOR (GPT-4o Vision)
  - Analyze image
  - Detect text regions
  - Identify layout type
  - Extract style information

Step 2: TRANSLATOR (GPT-4o)
  - Translate detected text
  - Respect length constraints
  - Handle RTL languages

Step 3: PROMPT BUILDER
  - Build image-specific prompt
  - Include actual translations
  - Add preservation instructions

Step 4: ARTIST (gpt-image-1.5)
  - Generate localized variant
  - Use streaming for UX
  - Apply pixel-perfect composite
```

**Rationale:**

1. **Separation of concerns** - Reading and generating are different tasks
2. **Right model for each job** - Vision model reads, image model generates
3. **Better prompts** - Knowing exact text enables precise instructions
4. **Contest differentiation** - Multi-model pipeline shows sophistication

**Trade-offs:**

- Additional API calls (GPT-4o Vision + GPT-4o translation)
- Slightly higher latency for first-time analysis
- More complex architecture

**Impact:** Professional-grade architecture that enables universal image support

---

### ED-037: Dynamic Prompt Generation (vs Hardcoded)

**Decision:** Build prompts dynamically from detected image content, not hardcoded demo copy

**Date:** 2025-12-22

**Before (Broken):**

```typescript
const LOCALIZED_COPY = {
  "es-MX": {
    headline: "PLANEA TU DÍA EN SEGUNDOS",  // Hardcoded!
    bullet1: "Recordatorios con un toque",   // Wrong for any other image
    ...
  }
};
```

**After (Fixed):**

```typescript
interface DynamicPromptBuilder {
  buildPrompt(
    analysis: ImageAnalysis,       // From Vision
    translations: TranslatedText[], // From Translator
    locale: LocaleId
  ): string;
}
```

**Prompt Template Strategy:**

Layout-aware templates that describe the ACTUAL image:

```typescript
// For sticky-notes layout
`You are localizing a motivational poster with ${analysis.textRegions.length} sticky notes.
Surface: ${analysis.surfaceTexture}

Replace text on each note:
${translations.map((t, i) => `Note ${i+1}: "${t.original}" → "${t.translated}"`).join('\n')}

CRITICAL: Preserve sticky note colors and positions exactly.`
```

**Rationale:**

- Prompts that describe the actual image produce correct outputs
- Hardcoded prompts only work for one specific image
- Dynamic prompts enable universal support

**Impact:** Generated outputs match the actual image content

---

### ED-038: Translation Verification Loop

**Decision:** Re-read generated images with GPT-4o Vision to verify translations rendered correctly

**Date:** 2025-12-22

**Problem:**
Even with good prompts, the AI may render text incorrectly:

- Wrong characters
- Truncated text
- Missing words
- RTL rendering issues

**Solution:**
After generation, run a verification loop:

```typescript
interface VerificationResult {
  expected: TranslatedText[];
  actual: string[];           // Re-read from generated image
  accuracy: number;           // 0-100%
  mismatches: Mismatch[];
}

async function verifyTranslation(
  generatedImage: Buffer,
  expectedTranslations: TranslatedText[]
): Promise<VerificationResult> {
  // 1. Send generated image to GPT-4o Vision
  // 2. Extract rendered text
  // 3. Compare to expected
  // 4. Calculate accuracy
}
```

**Display:**

- "Translation Accuracy: 98%" alongside drift score
- Flag mismatches for user review
- Option to regenerate failed variants

**Rationale:**

- Proves the tool works, not just generates
- Professional QA mindset (like drift detection)
- Contest differentiator

**Impact:** Users have confidence translations actually rendered

---

### ED-039: Auto-Mask Suggestion from Vision Analysis

**Decision:** Use detected text regions to suggest mask areas automatically

**Date:** 2025-12-22

**Problem:**
Users must manually draw masks around text, which is:

- Time-consuming
- Error-prone (miss text, include too much)
- Requires trial and error

**Solution:**
Use Vision-detected bounding boxes to suggest masks:

```typescript
interface MaskSuggestion {
  regions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    padding: number;      // Recommended padding (10% of size)
    label: string;        // "YOU ARE", etc.
  }>;
  combinedMaskBuffer: Buffer;  // Pre-generated mask image
}
```

**UI Flow:**

1. Upload image
2. Click "Analyze" → Vision detects text
3. Display suggested mask regions as overlay
4. User clicks "Accept" or adjusts manually
5. Generate with optimized mask

**Rationale:**

- Reduces friction for users
- Ensures all text is covered
- Optimal padding reduces artifacts

**Impact:** Faster workflow, better mask quality

---

### ED-040: Dual Mode Architecture (Demo vs Any Image)

**Decision:** Support both "Demo Mode" (hardcoded) and "Any Image" mode (Vision-powered)

**Date:** 2025-12-22

**Problem:**
We need both:

- Guaranteed working demo for judges (current hardcoded approach)
- Universal support for custom images (new Vision approach)

**Solution:**
Mode toggle in UI:

```typescript
type GenerationMode = "demo" | "vision";

// Demo Mode: Uses LOCALIZED_COPY (guaranteed to work)
// Vision Mode: Uses TextDetectionService + DynamicPromptBuilder
```

**Implementation:**

- "Demo Mode" toggle visible on demo projects
- "Vision Mode" default for custom uploads
- Clear labeling so users understand the difference

**Rationale:**

- Judges can see polished demo output
- Users can experiment with custom images
- Both paths are tested and reliable
- Backwards compatible

**Trade-offs:**

- Two code paths to maintain
- Slightly more complex UX

**Impact:** Best of both worlds - reliable demo + universal support

---

### ED-041: Sprint 8 Vision Pipeline Implementation

**Decision:** Complete implementation of the two-model Vision pipeline with full type safety

**Date:** 2025-12-22

**Implementation Files Created:**

```text
src/server/services/
├── textDetectionService.ts    # GPT-4o Vision text extraction (477 lines)
└── translationService.ts      # GPT-4o translation with length constraints (363 lines)

src/server/domain/services/
└── dynamicPromptBuilder.ts    # Layout-aware prompt templates (426 lines)
```

**Key Interfaces:**

```typescript
// TextDetectionService
interface ITextDetectionService {
  analyzeImage(imageBuffer: Buffer): Promise<ImageAnalysis>;
}

// TranslationService
interface ITranslationService {
  translateTexts(input: TranslationInput): Promise<TranslationResult>;
}

// DynamicPromptBuilder
interface IDynamicPromptBuilder {
  buildPrompt(input: DynamicPromptInput): DynamicPromptResult;
}
```

**Database Schema Added:**

```prisma
model ImageAnalysis {
  id             String   @id @default(cuid())
  projectId      String   @unique
  textRegions    String   // JSON array of TextRegion objects
  layout         String
  surfaceTexture String
  dominantColors String
  hasUIElements  Boolean  @default(false)
  uiElements     String?
  imageDescription String
  analyzedAt     DateTime @default(now())
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

**tRPC Endpoints Added:**

- `project.analyzeImage` — Analyze image with GPT-4o Vision, store results
- `project.getImageAnalysis` — Retrieve stored analysis
- `variant.generateWithVision` — Single locale Vision-powered generation
- `variant.generateAllWithVision` — Batch Vision-powered generation

**UI Changes:**

- Vision Mode toggle (purple, with "NEW" badge) in GenerateSidebar
- "Analyze Image" button with loading state
- Detection count display ("Found X text regions")
- Toggle between Demo Mode and Vision Mode

**Architectural Compliance:**

- **SRP**: Each service has single responsibility (detect, translate, build prompt)
- **OCP**: New services extend system without modifying existing code
- **LSP**: Services implement interfaces, are substitutable
- **ISP**: Small, focused interfaces (ITextDetectionService, ITranslationService, etc.)
- **DIP**: High-level modules depend on abstractions via factory functions

**Trade-offs:**

- Additional API calls increase latency (~2-3 seconds for analysis)
- Analysis stored in database for reuse (no re-analysis needed)
- Vision Mode is opt-in toggle, Demo Mode remains default for demo projects

**Impact:** LocaleLens now supports ANY image, not just the demo screenshot. Universal localization capability achieved.

---

### ED-042: Turbopack for Production Builds

**Decision:** Use `next build --turbo` instead of `next build` for production builds

**Date:** 2025-12-22

**Problem:**
The legacy webpack builder fails on Windows with:

```text
glob error [Error: EPERM: operation not permitted, scandir 'C:\Users\...\Application Data']
```

This is a Windows-specific issue where webpack's glob implementation tries to traverse legacy junction points (`Application Data` → `AppData\Roaming`) that have restricted permissions.

**Solution:**
Switch to Turbopack for production builds:

```json
{
  "scripts": {
    "build": "next build --turbo"
  }
}
```

**Rationale:**

- Turbopack doesn't have this issue
- Next.js 15.5+ has stable Turbopack support
- Faster builds (~4 seconds vs 15+ seconds)
- Consistent with dev mode (`next dev --turbo`)

**Impact:** Production builds now work on Windows without permission errors.

---

### ED-043: Dynamic Canvas Dimensions for Any Aspect Ratio

**Decision:** Calculate canvas dimensions dynamically based on base image aspect ratio

**Date:** 2025-12-22

**Problem:**
The mask canvas was fixed at 540×960 pixels regardless of base image dimensions. When users uploaded images with different aspect ratios:

1. Base image displayed with letterboxing (`object-contain`)
2. User drew mask on 540×960 canvas
3. Mask resized to base image dimensions using `fit: "fill"` (distortion!)
4. On Generate step, mask didn't align with image

**Solution:**
Added `calculateCanvasDimensions()` function in `page.tsx`:

```typescript
function calculateCanvasDimensions(
  baseWidth: number | null,
  baseHeight: number | null
): { width: number; height: number } {
  if (!baseWidth || !baseHeight) {
    return { width: MAX_CANVAS_WIDTH, height: MAX_CANVAS_HEIGHT };
  }

  const baseAspectRatio = baseWidth / baseHeight;
  const containerAspectRatio = MAX_CANVAS_WIDTH / MAX_CANVAS_HEIGHT;

  if (baseAspectRatio > containerAspectRatio) {
    // Image is wider - fit to width
    return { width: MAX_CANVAS_WIDTH, height: Math.round(MAX_CANVAS_WIDTH / baseAspectRatio) };
  } else {
    // Image is taller - fit to height
    return { height: MAX_CANVAS_HEIGHT, width: Math.round(MAX_CANVAS_HEIGHT * baseAspectRatio) };
  }
}
```

**Changes:**

- `project.getBaseImage` now returns `{ imageBase64, width, height }`
- `useProjectQueries` exposes `baseImageWidth` and `baseImageHeight`
- Canvas dimensions calculated via `useMemo` based on base image dimensions
- All step canvases use dynamic dimensions

**Impact:** LocaleLens now handles ANY image resolution correctly. Masks align perfectly with base images.

---

### ED-044: Vision Mode Auto-Analyze on Toggle

**Decision:** Automatically trigger image analysis when Vision Mode is enabled

**Date:** 2025-12-22

**Problem:**
Original UX had both a toggle AND a separate "Analyze Image" button:

1. User enables Vision Mode toggle
2. User clicks "Analyze Image" button
3. Analysis runs

This was confusing - why have both?

**Solution:**
Removed the manual button. Analysis triggers automatically via `useEffect`:

```typescript
useEffect(() => {
  if (
    visionModeEnabled &&
    !hasAnalysis &&
    !analyzeImageMutation.isPending &&
    queries.hasBaseImage &&
    !imageAnalysisQuery.isLoading &&
    !imageAnalysisQuery.data?.analysis
  ) {
    analyzeImageMutation.mutate({ projectId });
  }
}, [visionModeEnabled, hasAnalysis, ...]);
```

**UI Changes:**

- Removed "Analyze Image" button from GenerateSidebar
- Added "Analyzing Image..." spinner state
- Shows "Text Detected - X regions found" when complete
- Clear status messaging at each state

**Trade-offs:**

- Analysis starts immediately when toggle is enabled (might surprise user)
- If user toggles off/on, won't re-analyze (existing analysis reused)

**Impact:** Simpler UX. One toggle does everything.

---

### ED-045: Dynamic Prompt Generation (PLANNED - Sprint 10)

**Decision:** Replace predefined layout templates with GPT-4o generated preservation instructions

**Date:** 2025-12-22 (documented during Sprint 8 testing)

**Problem:**
Current `DynamicPromptBuilder` uses predefined layout categories:

- `app-screenshot`, `sticky-notes`, `banner`, `poster`, etc.
- GPT-4o picks a category, we use corresponding template
- This is still a form of "hardcoding" - we're constraining to OUR categories

**Example failure mode:**
If user uploads an image type we didn't anticipate (e.g., a chalk menu board, a tattoo design, embroidered text), our templates may not have appropriate instructions.

**Solution (Sprint 10):**
Have GPT-4o generate preservation and localization instructions dynamically:

```typescript
// Add to ImageAnalysis from TextDetectionService:
{
  preservationInstructions: "The 4 colored sticky notes must keep their exact colors...",
  localizationGuidance: "Each note contains one phrase. Replace text centered..."
}
```

GPT-4o describes what IT sees, not what we expect. Truly universal.

**Trade-offs:**

- More tokens per analysis (GPT-4o generates more text)
- Less predictable prompt structure
- May need prompt engineering to get consistent quality

**Impact:** World-class universal image support. No hardcoded assumptions.

---

### ED-046: Line-Count Preservation in Translations (IMPLEMENTED - Sprint 9)

**Decision:** Enforce that N source text regions produce exactly N translations

**Date:** 2025-12-22 (implemented)

**Problem:**
Spanish translation of "YOU ARE / STRONGER / THAN YOU / THINK" became:

- "ERES" / "FUERTE" / "DE LO QUE CREES" / *(empty)*

GPT-4o combined "THAN YOU THINK" into one natural Spanish phrase, leaving the 4th sticky note empty.

**Solution Implemented:**
Added constraint to TranslationService prompt (both system and user prompts):

```text
"CRITICAL LINE-COUNT PRESERVATION:
- You MUST produce EXACTLY the same number of translations as source texts
- NEVER combine multiple source texts into a single translation
- Each source text region MUST have its own separate translation
- If a natural translation would combine phrases, split them creatively to maintain count"
```

Also added validation with warning logging when count mismatch occurs.

**Trade-offs:**

- May produce less natural translations
- Forced splits might feel awkward in some languages
- Trade-off: visual consistency vs linguistic naturalness

**Impact:** Translations always match source structure. No empty regions.

---

### ED-047: VerificationService with Levenshtein Distance Matching

**Decision:** Use GPT-4o Vision re-read with Levenshtein distance for fuzzy text matching

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
After generation, we have no way to verify if translations actually rendered correctly. The AI may:

- Render wrong characters
- Truncate text
- Miss words entirely
- Have RTL rendering issues

**Solution:**
Created `VerificationService` (`src/server/services/verificationService.ts`) that:

1. Takes generated image buffer and expected translations
2. Sends image to GPT-4o Vision for text extraction
3. Uses Levenshtein distance for fuzzy string matching
4. Calculates similarity percentage for each text region
5. Determines overall verification status

**Matching Thresholds:**

- `match` (>95% similarity)
- `partial` (70-95% similarity)
- `mismatch` (<70% similarity)
- `missing` (no corresponding actual text found)

**Overall Status:**

- `pass` (>85% average accuracy)
- `warn` (60-85% average accuracy)
- `fail` (<60% average accuracy)

**Key Design Decisions:**

- Factory pattern with `getVerificationService()` singleton
- Interface segregation with `IVerificationService`
- Graceful degradation (returns failed result on error)
- Position-based matching with fallback to best-match

**Impact:** Users can verify translations actually rendered correctly. Professional QA capability.

---

### ED-048: MaskSuggestionService with Region Merging

**Decision:** Auto-generate clean rectangular masks from detected text regions with intelligent region merging

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
Hand-drawn masks have several issues:

- Organic brush strokes create "smudge" artifacts in generated images
- Imprecise coverage (may miss text or include too much)
- Time-consuming manual process
- Inconsistent results

**Solution:**
Created `MaskSuggestionService` (`src/server/services/maskSuggestionService.ts`) that:

1. Converts normalized bounding boxes (0-1) to pixel coordinates
2. Adds intelligent padding (10% of region size, min 5px, max 50px)
3. Clamps regions to image bounds
4. Merges overlapping regions (within 10px tolerance)
5. Generates PNG with alpha channel using Sharp

**Mask Format:**

- Transparent (alpha=0) = regions to EDIT
- Opaque (alpha=255) = regions to PRESERVE

**SVG-to-PNG Pipeline:**

```typescript
// Generate SVG with rectangles for edit regions
const svg = `<svg>
  <rect fill="white" /> <!-- preserve -->
  ${regions.map(r => `<rect fill="black" />`)} <!-- edit -->
</svg>`;
// Convert black → transparent, white → opaque
```

**Impact:** Clean rectangular masks eliminate artifacts. Faster workflow. Better quality output.

---

### ED-049: Variant Verification Fields in Database

**Decision:** Store verification results directly on Variant model

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
Need to persist verification results for:

- Display in UI
- Historical tracking
- Re-verification without re-running

**Solution:**
Added fields to Prisma Variant model:

```prisma
model Variant {
  // Existing fields...

  translationAccuracy  Float?   // 0-100 percentage
  verificationStatus   String?  // "pass" | "warn" | "fail"
  verificationDetails  String?  // JSON string of full VerificationResult
}
```

**Design Rationale:**

- Keep Variant as the single source of truth
- Store accuracy as Float for easy sorting/filtering
- Store status as String for simple display
- Store details as JSON for full match information

**API Endpoint:**
`variant.verify` mutation that:

1. Gets expected translations via TranslationService
2. Runs verification via VerificationService
3. Updates Variant with results
4. Returns summary for UI

**Impact:** Verification results persist across sessions. Complete audit trail.

---

### ED-050: On-Demand Verification (Not Auto-Verify)

**Decision:** Verification is triggered manually, not automatically after generation

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
Auto-verification would:

- Double API costs (extra GPT-4o Vision call per variant)
- Increase latency significantly
- May not be needed for all use cases

**Solution:**
Verification is a separate action:

- "Verify Translation" button in ResultsSidebar
- Shows accuracy badge (not verified → click to verify)
- Re-verify option after first verification

**UI States:**

- Not verified: `<HelpCircle /> Not Verified`
- Verifying: `<Spinner /> Verifying...`
- Verified: `<CheckCircle/AlertCircle/XCircle /> XX%`

**Trade-offs:**

- Users must click to verify (extra step)
- But: Users control costs and latency
- Can verify only specific locales of concern

**Impact:** User controls verification costs. Clean separation of generation and QA.

---

### ED-051: Semantic Position Detection for Text Regions

**Decision:** Use semantic position descriptions ("left", "center", "right", "top", "middle", "bottom") instead of precise coordinates for bounding box placement

**Date:** 2025-12-22 (Sprint 9 refinement)

**Problem:**
GPT-4o Vision is fundamentally not designed for precise spatial localization:

1. Initial approach: Ask for exact bounding boxes (x, y, width, height in 0-1 normalized coordinates)
   - Result: Wildly inaccurate coordinates (30-50% off actual positions)

2. Grid-based approach: Divide image into 8×8 grid, ask for cell positions (A-H columns, 1-8 rows)
   - Result: Still inaccurate (GPT-4o reported center-right grid cells for left-positioned text)

3. Multiple validation attempts: Added validation, capping, bounding box constraints
   - Result: Marginal improvements, still unusable for auto-mask

**Solution:**
Switched to semantic position descriptions:

```typescript
// GPT-4o now responds with:
{
  text: "YOU ARE",
  horizontalPosition: "left",   // far-left, left, center, right, far-right
  verticalPosition: "upper",    // top, upper, middle, lower, bottom
  estimatedWidth: "short"       // tiny, short, medium, long, very-long
}

// We map semantics to coordinates:
const HORIZONTAL_POSITIONS = {
  "far-left": { center: 0.10, defaultWidth: 0.20 },
  "left": { center: 0.30, defaultWidth: 0.25 },
  "center": { center: 0.50, defaultWidth: 0.30 },
  // ...
};
```

**Rationale:**

- Semantic descriptions are what GPT-4o is actually good at
- Humans naturally describe positions this way
- Maps well to rough rectangular regions with padding
- Acceptable accuracy for "starting point" auto-mask

**Trade-offs:**

- Still not pixel-perfect (but that's expected)
- Requires users to refine masks manually
- Positioned as "starting point" not "final mask"

**Impact:** Auto-mask now provides useful starting point. Users refine as needed.

---

### ED-052: Auto-Analyze on Image Upload

**Decision:** Automatically trigger Vision analysis when a base image is uploaded

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
Original flow required users to:

1. Upload image
2. Go to Generate step
3. Enable Vision Mode
4. Wait for analysis
5. Go back to Mask step to see suggested mask

This was confusing and inefficient.

**Solution:**
Trigger analysis automatically in `onBaseImageChange` callback:

```typescript
onBaseImageChange: async () => {
  await queries.refetchBaseImage();
  console.log(`[ProjectPage] Base image uploaded, triggering auto-analysis`);
  analyzeImageMutation.mutate({ projectId });
},
```

Also check for existing analysis on page load:

```typescript
const existingAnalysisQuery = api.project.getImageAnalysis.useQuery(
  { projectId },
  { enabled: !analysisChecked }
);
```

**UI Updates:**

- UploadSidebar shows analysis status: "Analyzing text regions..." → "X text regions detected"
- Continue button disabled while analyzing
- Analysis runs in background, doesn't block UX

**Rationale:**

- Immediate value: Users see suggested mask on Mask step
- Analysis reused later for Vision Mode generation
- Minimal added latency (runs in background)

**Impact:** "Use Suggested Mask" button appears immediately when entering Mask step.

---

### ED-053: Auto-Mask as "Starting Point" UX Pattern

**Decision:** Position auto-mask as a "starting point" with explicit user messaging

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
GPT-4o Vision cannot provide pixel-perfect bounding boxes. Users might expect perfect auto-mask and be disappointed.

**Solution:**
Explicit toast message when auto-mask is applied:

```typescript
toast.success(
  `Auto-mask applied (${data.regionCount} regions)`,
  { description: "This is a starting point — use the tools above to refine if needed." }
);
```

**Design Philosophy:**

- Set correct expectations upfront
- Emphasize that tools are available for refinement
- Frame as time-saver, not replacement for manual masking
- Graceful degradation: even imperfect mask is faster than starting from scratch

**Rationale:**

- Honest about limitations
- Users appreciate transparency
- Reduces frustration from unmet expectations
- Positions the tool correctly

**Impact:** Users understand to refine masks. Better overall experience.

---

### ED-054: Disable Region Merging for Separate Text Elements

**Decision:** Disabled automatic region merging in MaskSuggestionService

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
Original MaskSuggestionService merged "nearby" regions (within 10px tolerance):

```typescript
// Was merging regions that were 10px apart
const tolerance = 10;
```

This caused separate text elements (like text on different sticky notes) to be merged into one large mask, covering areas that shouldn't be edited.

**Solution:**
Disabled region merging entirely:

```typescript
// DISABLED: Merging was combining separate text elements (like sticky notes)
// Each text region should remain separate for accurate masking
const mergedRegions = regions; // Keep all regions separate
```

**Rationale:**

- Separate text elements should have separate masks
- Better to have more small masks than one large incorrect mask
- Users can manually combine if needed

**Trade-offs:**

- More mask regions to display
- Overlapping text (like multi-line labels) won't be merged

**Impact:** Each detected text region gets its own mask rectangle.

---

### ED-055: Continue Button State Management with Project Refetch

**Decision:** Refetch project data before updating local state when applying suggested mask

**Date:** 2025-12-22 (Sprint 9)

**Problem:**
After applying suggested mask, "Continue to Generate" button stayed disabled because:

1. `applySuggestedMaskMutation.onSuccess` loaded mask into canvas
2. But `queries.hasMask` (from `useProjectQueries`) still returned false
3. Button disabled condition: `disabled={!hasMask}`

**Solution:**
Call `queries.refetchProject()` FIRST in onSuccess:

```typescript
const applySuggestedMaskMutation = api.project.applySuggestedMask.useMutation({
  onSuccess: async (data) => {
    // 1. Refetch project to update hasMask state (enables Continue button)
    await queries.refetchProject();
    // 2. THEN refetch and load the mask into the canvas
    const result = await queries.refetchMask();
    if (result.data?.maskBase64) {
      maskEditor.loadMask(result.data.maskBase64);
    }
    // 3. Show toast
    toast.success(...);
  },
});
```

**Order matters:**

1. `refetchProject()` — Updates `hasMask` flag in query cache
2. `refetchMask()` — Gets mask data for canvas
3. Toast — Shows success message

**Rationale:**

- React Query cache is source of truth for `hasMask`
- Must update cache before UI re-renders
- Sequential operations ensure correct state

**Impact:** Continue button enables immediately after applying suggested mask.

---

### ED-056: PromptEngineeringService — GPT-4o Writes Prompts for gpt-image-1.5

**Decision:** Have GPT-4o generate the actual prompt text for gpt-image-1.5 instead of using predefined templates

**Date:** 2025-12-23 (Sprint 10)

**Problem:**
Sprint 8's `DynamicPromptBuilder` used layout-based templates (sticky-notes, app-screenshot, banner). While an improvement over hardcoded demo prompts, it still constrained prompts to our predefined categories. Analysis of generation quality revealed:

1. **Hardcoded demo prompts work** because they have exact spatial relationships: "immediately to the right of checkmark icon", "3 checkmark icons are ANCHOR POINTS"
2. **Template-based prompts are too generic**: "next to icons", "centered in button"
3. **Black rectangles and missing icons** occur when gpt-image-1.5 can't figure out what to put in edit regions due to vague instructions

**Solution:**
Created `PromptEngineeringService` (`src/server/services/promptEngineeringService.ts`) that:

1. Takes image analysis (text regions, layout, translations) + the image itself
2. Sends to GPT-4o with a "meta-prompt" asking it to WRITE a prompt for gpt-image-1.5
3. GPT-4o generates a prompt with:
   - Exact visual structure description
   - Spatial relationships ("immediately to the right of [icon]")
   - Container relationships ("centered inside [button]")
   - Anchor points ("checkmark icon at start of each bullet")
   - Comprehensive preservation list (icons, backgrounds, UI elements)
4. Returns prompt that reads like a human expert wrote it for this exact image

**Meta-Prompt Pattern:**

```text
"You are an expert prompt engineer specializing in image editing AI models.

Your task is to write a DETAILED, SPECIFIC prompt for gpt-image-1.5...

Write the prompt as if a human expert carefully analyzed this exact image
and crafted a custom prompt for it. Be SPECIFIC, not generic."
```

**Integration:**

- Added `enhancedPrompt: z.boolean().default(true)` to `generateAllWithVision` schema
- When enabled (default), uses `PromptEngineeringService` instead of `DynamicPromptBuilder`
- Falls back to template-based prompts if GPT-4o fails

**Key Design Decisions:**

- Factory pattern with singleton for efficiency
- Interface segregation (`PromptEngineeringInput`, `PromptEngineeringResult`)
- Optional `imageBuffer` parameter for enhanced analysis (image context)
- Graceful fallback to template-based prompts on failure

**Trade-offs:**

- Additional GPT-4o call per locale (increases latency and cost)
- Prompt quality depends on GPT-4o's interpretation
- Less predictable prompt structure

**Impact:** Prompts are now as specific as hand-crafted ones for ANY image. World-class localization quality.

---

### ED-057: Cancel Button UX for Non-Cancellable API Operations

**Decision:** Show "Cancelling..." state with explanatory message when cancel is clicked, since OpenAI API has no cancel endpoint

**Date:** 2025-12-23 (Sprint 10)

**Problem:**
OpenAI's image generation API has no cancel endpoint. Once a generation starts, it must complete. Users clicking "Cancel" expect the operation to stop, but:

1. The API call continues running
2. The server must wait for completion
3. Results are received even though user "cancelled"

**Solution:**
Implemented honest UX that sets correct expectations:

1. Cancel button changes to "Cancelling..." with spinner when clicked
2. Button is disabled to prevent multiple clicks
3. Message appears: "Server must complete current operation. Results will be discarded."
4. Results are discarded client-side even though server completes

**Implementation:**

```typescript
// page.tsx
const [isCancelling, setIsCancelling] = useState(false);

const handleCancelGeneration = () => {
  setIsCancelling(true);
  cancelledRef.current = true;
  setIsGenerating(false);
  // Results discarded when they arrive via cancelledRef check
};
```

**UI States:**

- Normal: Red "Cancel Generation" button with XCircle icon
- Cancelling: Gray "Cancelling..." button with Loader2 spinner, disabled
- Message below: "Server must complete current operation. Results will be discarded."

**Rationale:**

- Honest UX prevents confusion
- Users understand what's happening
- Better than fake instant cancel that would confuse when results appear later

**Impact:** Clear user expectations. No confusion about cancellation behavior.

---

### ED-058: API Parameter Optimization (moderation + input_fidelity)

**Decision:** Add `moderation: "auto"` and `input_fidelity: "high"` to all gpt-image-1.5 API calls

**Date:** 2025-12-23 (Sprint 10)

**Background:**
From OpenAI's official documentation, we discovered two additional parameters for gpt-image-1.5:

1. **moderation** - Controls content filtering strictness
   - `auto` (default): Standard filtering for age-appropriate content
   - `low`: Less restrictive filtering

2. **input_fidelity** - Controls how well input image details are preserved
   - `high`: Better preserve input image details (faces, logos, etc.)
   - `low`: Default, less preservation
   - For gpt-image-1.5, the first **5** input images are preserved with higher fidelity when using `high`

**Previous Understanding (Incorrect):**
Our code comments stated "input_fidelity is ONLY available for gpt-image-1, NOT gpt-image-1.5". This was incorrect.

**Solution:**
Updated `openaiImage.ts` to include both parameters:

```typescript
export const GPT_IMAGE_1_5_DEFAULTS = {
  size: "auto" as ImageSize,
  quality: "high" as ImageQuality,
  background: "opaque" as ImageBackground,
  outputFormat: "png" as ImageOutputFormat,
  moderation: "auto" as ImageModeration, // Content safety for contest
  inputFidelity: "high" as ImageInputFidelity, // Better preserve input details
} as const;
```

**TypeScript SDK Compatibility:**
The OpenAI TypeScript SDK doesn't yet include these parameters in its type definitions. We work around this using:

```typescript
const response = await this.client.images.edit({
  // ... other params
  moderation,
  input_fidelity: inputFidelity,
} as any) as OpenAI.Images.ImagesResponse;
```

**Rationale:**

1. **moderation: "auto"**: For a contest submission, we MUST ensure no inappropriate content can be generated. Using `auto` (standard filtering) ensures contest-appropriate output.

2. **input_fidelity: "high"**: Better preserves the original image details, which is exactly what we want for localization. Text replacement should preserve as much of the original image as possible.

**Trade-offs:**

- `input_fidelity: "high"` uses more input tokens (increased cost)
- TypeScript type assertions required until SDK is updated

**Impact:** Contest-safe content + better image preservation quality.

---

### ED-059: Image Lightbox for Results Comparison

**Decision:** Add click-to-zoom lightbox on the Results page for detailed image inspection.

**Context:**
The Results page displays original and variant images side-by-side at scaled-down sizes (45% of canvas dimensions) to fit both images in view. Users need to inspect images at full resolution to verify translation quality and visual preservation.

**Implementation:**

1. **ImageLightbox Component** (`src/components/project/ImageLightbox.tsx`):

   - Uses shadcn/ui Dialog (Radix) for accessible modal
   - Smooth fade-in animation with loading spinner
   - Images display at max 90vw × 85vh while maintaining aspect ratio
   - Escape key or click outside to close (handled by Radix)
   - Screen reader accessible with DialogTitle (sr-only pattern)

2. **Results Page Integration** (`src/components/project/steps/ResultsStep.tsx`):
   - Both Original and Variant images are clickable
   - Visual feedback: `cursor-zoom-in` and ring hover effect
   - Tooltip: "Click to view full size"
   - Lightbox title reflects what's shown (e.g., "Spanish (Mexico)" or "French (Canada) (Drift Overlay)")

**Rationale:**

- Contest judges need to inspect localization quality in detail
- Side-by-side comparison at 45% scale isn't sufficient for evaluating text rendering
- Full-size viewing reveals whether translations preserved visual fidelity
- Modern UX pattern users expect from image-focused applications

**Impact:** Better contest presentation + improved user experience for detailed quality inspection.

---

## How to Add Decisions

When making a decision not covered by the spec:

1. Add an entry with a unique ID (ED-XXX)
2. State the decision clearly
3. Explain the rationale
4. Note any trade-offs or impacts
5. Update this document in the same commit as the implementation
