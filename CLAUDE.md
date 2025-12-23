# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **AI HANDOFF:** For comprehensive onboarding, see `docs/AI_HANDOFF_PROMPT.md`
> This contains the full prompt to get any AI up to speed on this project.

## Project Overview

LocaleLens is a locally-runnable tool for localizing marketing visuals using OpenAI's gpt-image-1.5 API. Users upload images, mark text regions with a mask, generate localized variants in multiple languages (including RTL), and automatically detect unintended visual drift.

**Key Innovation:** Two-model pipeline using GPT-4o Vision (to detect text) + gpt-image-1.5 (to generate). This enables universal image support - works with ANY image, not just demo screenshots.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm db:push          # Initialize/sync SQLite database (required before first run)
pnpm dev              # Start dev server at http://localhost:3000
pnpm build            # Production build
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
```
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

5. **Two-Model Pipeline** (NEW - Sprint 8+):
   ```
   GPT-4o Vision (Inspector) → GPT-4o (Translator) → gpt-image-1.5 (Artist) → GPT-4o Vision (Verifier)
   ```
   - **TextDetectionService**: Extracts text regions from any image using GPT-4o Vision
   - **TranslationService**: Translates detected text to target locales
   - **DynamicPromptBuilder**: Builds image-specific prompts (not hardcoded)
   - **VerificationService**: Re-reads generated images to verify translation accuracy

### Database Schema (Prisma)
- **Project**: id, name, baseImagePath, timestamps
- **Mask**: id, projectId (unique), maskImagePath
- **Variant**: id, projectId, locale, prompt, outputImagePath, driftScore, driftStatus, modelUsed

## Key Implementation Details

### OpenAI Image Generation
- Primary model: `gpt-image-1.5` (contest requirement)
- Parameters: `quality: "high"`, `background: "opaque"`, `size: "auto"`, `output_format: "png"`
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
- `src/server/api/routers/variant.ts` - Variant generation pipeline
- `src/server/domain/services/variantGeneration.service.ts` - Core variant logic
- `src/server/services/openaiImage.ts` - OpenAI client with streaming
- `src/server/domain/services/localePlan.service.ts` - **CRITICAL**: Currently uses hardcoded translations (being replaced)
- `docs/ENGINEERING_DECISIONS.md` - 40 documented engineering decisions with rationale
- `docs/SPRINTS.md` - Sprint planning including Sprints 8-10 for Vision pipeline

## Critical Issue (Sprint 8 Fix)

**Problem:** The system only works with ONE specific demo image because:
1. `LocalePlanService` uses hardcoded `LOCALIZED_COPY` translations
2. Prompts reference "checkmarks", "bullets", "CTA buttons" that don't exist in other images
3. When users upload custom images, the AI creates phantom UI elements

**Solution (In Progress):** Implement Vision-powered text detection:
- `TextDetectionService` - Use GPT-4o Vision to detect actual text in images
- `TranslationService` - Translate detected text dynamically
- `DynamicPromptBuilder` - Build prompts from actual image content

See `docs/SPRINTS.md` Sprint 8-10 for implementation plan.
