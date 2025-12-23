# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AI HANDOFF:** For comprehensive onboarding, see `docs/AI_HANDOFF_PROMPT.md`
> This contains the full prompt to get any AI up to speed on this project.

## Project Overview

LocaleLens is a locally-runnable tool for localizing marketing visuals using OpenAI's gpt-image-1.5 API. Users upload images, mark text regions with a mask, generate localized variants in multiple languages (including RTL), and automatically detect unintended visual drift.

**Key Innovation:** Three-model pipeline using GPT-4o Vision (to detect text) + GPT-4o (to write prompts) + gpt-image-1.5 (to generate). The breakthrough: GPT-4o WRITES the prompts for gpt-image-1.5, generating image-specific prompts with spatial relationships as detailed as hand-crafted ones. This enables universal image support - works with ANY image.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm db:push          # Initialize/sync SQLite database (required before first run)
pnpm dev              # Start dev server at http://localhost:3000
pnpm build            # Production build (uses Turbopack for Windows compatibility)
pnpm typecheck        # TypeScript validation
pnpm db:studio        # Open Prisma Studio for database inspection
pnpm demo:seed        # Load pre-generated demo assets for offline testing
```

## Architecture

### Tech Stack

- **Framework:** Next.js 15 (App Router)
- **API:** tRPC v11 (type-safe RPC)
- **Database:** Prisma + SQLite
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Image Processing:** Sharp
- **AI:** OpenAI gpt-image-1.5

### Directory Structure

```text
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Homepage with project list
│   ├── project/[id]/       # Four-step workflow (upload → mask → generate → results)
│   └── api/variant/stream/ # SSE streaming endpoint
├── components/
│   ├── project/            # Workflow components (MaskCanvas, VariantViewer, etc.)
│   │   ├── steps/          # Step-based UI components (SRP)
│   │   └── sidebar/        # Sidebar per step
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
│   ├── useProjectQueries.ts   # Data fetching orchestration
│   ├── useProjectMutations.ts # Mutation orchestration
│   ├── useMaskEditor.ts       # Mask editor state
│   ├── useWorkflow.ts         # Step navigation
│   ├── useStreamingGeneration.ts # SSE streaming
│   └── useResultsState.ts     # Results display state
└── server/
    ├── api/routers/        # tRPC endpoints (project, variant, image)
    ├── domain/             # Clean Architecture: entities, value objects, services
    │   ├── entities/       # Project, Variant types
    │   ├── repositories/   # Interfaces only (ISP)
    │   └── services/       # VariantGeneration, LocalePlan
    ├── infrastructure/     # Prisma repository implementations
    └── services/           # OpenAI, FileStore, Diff, Heatmap, Export
```

### Key Architectural Patterns

1. **Clean Architecture with SOLID principles**: Domain layer is framework-agnostic with interface segregation. tRPC handlers delegate to domain services.

2. **Four-step workflow**: Upload → Mask → Generate → Results. Each step has dedicated components in `src/components/project/steps/`.

3. **File storage**: All assets stored locally in `.local-data/projects/{projectId}/` (base.png, mask.png, variants/{locale}.png, drift/, exports/).

4. **SSE Streaming**: `/api/variant/stream` endpoint provides progressive image previews during generation. Events: `start`, `partial`, `processing`, `complete`, `error`.

5. **Three-Model Pipeline** (Sprint 8-10):

   ```text
   GPT-4o Vision (Inspector) → GPT-4o (Translator) → GPT-4o (Prompt Writer) → gpt-image-1.5 (Artist) → GPT-4o Vision (Verifier)
   ```

   - **TextDetectionService**: Extracts text regions from any image using GPT-4o Vision
   - **TranslationService**: Translates detected text to target locales (with line-count preservation)
   - **PromptEngineeringService**: GPT-4o WRITES prompts for gpt-image-1.5 (Sprint 10 KEY INNOVATION)
   - **DynamicPromptBuilder**: Layout-aware templates (fallback if PromptEngineeringService fails)
   - **VerificationService**: Re-reads generated images to verify translation accuracy (Sprint 9)
   - **MaskSuggestionService**: Auto-generates clean rectangular masks from detected regions (Sprint 9)

### Database Schema (Prisma)

- **Project**: id, name, baseImagePath, timestamps
- **Mask**: id, projectId (unique), maskImagePath
- **Variant**: id, projectId, locale, prompt, outputImagePath, driftScore, driftStatus, modelUsed, translationAccuracy, verificationStatus, verificationDetails

## Key Implementation Details

### OpenAI Image Generation

- Primary model: `gpt-image-1.5` (contest requirement)
- Parameters: `quality: "high"`, `background: "opaque"`, `size: "auto"`, `output_format: "png"`, `moderation: "auto"`, `input_fidelity: "high"`
- `moderation: "auto"` ensures contest-appropriate content filtering
- `input_fidelity: "high"` better preserves input image details (gpt-image-1.5 preserves first 5 images with higher fidelity)
- Pixel-perfect composite mode: Generated images are composited onto original using mask to guarantee 0% drift outside masked regions

### Drift Detection

- Algorithm: Euclidean distance in RGB space (threshold: 30 = changed pixel)
- Score: `(changed pixels outside mask) / (total pixels outside mask) * 100`
- Thresholds: PASS (≤2%), WARN (2-5%), FAIL (>5%)

### Mask Handling

- Format: PNG with alpha channel (transparent = editable regions)
- Auto-resize: Masks are automatically resized to match base image dimensions when saved

### Supported Locales

- `es-MX` (Spanish) - LTR
- `fr-CA` (French) - LTR
- `ar` (Arabic) - RTL

## Environment Variables

```bash
DATABASE_URL="file:./db.sqlite"
OPENAI_API_KEY="sk-..."
IMAGE_MODEL="gpt-image-1.5"
IMAGE_MODEL_FALLBACK="gpt-image-1"
```

## Important Files

- `src/app/project/[id]/page.tsx` - Main workflow orchestration
- `src/server/api/routers/variant.ts` - Variant generation pipeline (includes Vision mutations)
- `src/server/api/routers/project.ts` - Project management (includes analyzeImage mutation)
- `src/server/domain/services/variantGeneration.service.ts` - Core variant logic
- `src/server/services/openaiImage.ts` - OpenAI gpt-image-1.5 client with streaming
- `src/server/services/textDetectionService.ts` - GPT-4o Vision text extraction (Sprint 8)
- `src/server/services/translationService.ts` - Dynamic text translation (Sprint 8)
- `src/server/services/promptEngineeringService.ts` - GPT-4o writes prompts for gpt-image-1.5 (Sprint 10 KEY INNOVATION)
- `src/server/domain/services/dynamicPromptBuilder.ts` - Layout-aware prompts (Sprint 8, now fallback)
- `src/server/services/verificationService.ts` - GPT-4o Vision re-read verification (Sprint 9)
- `src/server/services/maskSuggestionService.ts` - Auto-mask from detected regions (Sprint 9)
- `docs/ENGINEERING_DECISIONS.md` - 59 documented engineering decisions with rationale
- `docs/SPRINTS.md` - Sprint planning (Sprints 0-9 complete, Sprint 10 in progress)

## Vision Pipeline (Sprint 8 - COMPLETE)

**Problem Solved:** The system now works with ANY image, not just demo screenshots.

**Two-Model Pipeline:**

```text
GPT-4o Vision (Inspector) → GPT-4o (Translator) → gpt-image-1.5 (Artist)
```

**New Services (Sprint 8):**

- `TextDetectionService` - Extracts text regions with bounding boxes, layout type, style hints
- `TranslationService` - Translates with length constraints for visual content
- `DynamicPromptBuilder` - Layout-aware templates (sticky notes, banners, screenshots)

**New API Endpoints:**

- `project.analyzeImage` - Analyze image with GPT-4o Vision
- `project.getImageAnalysis` - Retrieve stored analysis
- `variant.generateWithVision` - Single locale Vision generation
- `variant.generateAllWithVision` - Batch Vision generation

**UI:**

- Vision Mode toggle in Generate step sidebar (auto-analyzes on enable)
- Analysis status with spinner → checkmark transition
- Detection count display ("X regions found")
- Dynamic canvas dimensions for any image aspect ratio

## Verification & Auto-Mask (Sprint 9 - COMPLETE)

**Problem Solved:** Quality assurance and workflow automation.

**New Services (Sprint 9):**

- `VerificationService` - Re-reads generated images with GPT-4o Vision, computes translation accuracy using Levenshtein distance
- `MaskSuggestionService` - Auto-generates clean rectangular masks from detected text regions with intelligent padding

**New API Endpoints:**

- `variant.verify` - Verify translation accuracy for a generated variant
- `project.getSuggestedMask` - Get auto-generated mask from detected regions
- `project.applySuggestedMask` - Apply suggested mask to project

**UI Features:**

- "Use Suggested Mask" button in Mask step (when analysis available)
- "Verify Translation" button in Results step
- VerificationBadge showing accuracy with color coding (pass >85%, warn 60-85%, fail <60%)
- Auto-analyze on image upload (no manual button needed)
- Toast message: "Auto-mask applied - This is a starting point" (manages user expectations)

**Technical Details:**

- Semantic position detection (GPT-4o uses "left/center/right" instead of precise coordinates)
- Region merging disabled (each text region gets separate mask)
- Line-count preservation in translations

## Prompt Engineering Pipeline (Sprint 10 - IN PROGRESS)

**Problem Solved:** Template-based prompts were too generic ("next to icons"). Hardcoded demo prompts worked because they had exact spatial relationships.

**Key Innovation (Sprint 10):**

- `PromptEngineeringService` - GPT-4o WRITES prompts for gpt-image-1.5
- Instead of templates, GPT-4o generates image-specific prompts with:
  - Exact visual structure descriptions
  - Spatial relationships ("immediately to the right of [icon]")
  - Anchor points ("checkmark icon at start of each bullet")
  - Comprehensive preservation lists
- Prompts read like a human expert wrote them for each specific image

**Integration:**

- `variant.generateAllWithVision` uses PromptEngineeringService when `enhancedPrompt: true` (default)
- Falls back to DynamicPromptBuilder templates on failure

## Current Sprint Status

| Sprint | Status |
| Sprints 0-9 | **COMPLETE** |
| Sprint 10 | **IN PROGRESS** - PromptEngineeringService done, README/testing remaining |

See `docs/SPRINTS.md` for full sprint details and `docs/AI_HANDOFF_PROMPT.md` for AI onboarding.
