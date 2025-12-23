# LocaleLens — AI Handoff Prompt

> **Use this prompt to onboard any AI assistant to continue work on LocaleLens.**
>
> Copy everything below the line and paste it as your first message to the AI.

---

## CURRENT STATUS (Update this section after each work session)

| Field | Value |
| **Last Updated** | 2025-12-22 |
| **Current Sprint** | Sprint 8 - Vision-Powered Text Detection Pipeline |
| **Sprint Status** | COMPLETE - All features implemented and bugs fixed |
| **Blocking Issues** | None |
| **Next Action** | Sprint 9: VerificationService and Auto-mask suggestion |

### Completed in This Session (Sprint 8)

**Core Vision Pipeline:**

- ✅ `TextDetectionService` — GPT-4o Vision text extraction with bounding boxes
- ✅ `TranslationService` — Dynamic text translation with length constraints
- ✅ `DynamicPromptBuilder` — Layout-aware prompt templates (sticky notes, banners, etc.)
- ✅ `ImageAnalysis` Prisma model — Stores detected regions in database
- ✅ `analyzeImage` mutation — API endpoint for image analysis
- ✅ `generateWithVision` mutation — Vision pipeline variant generation
- ✅ `generateAllWithVision` mutation — Batch Vision generation

**UI Improvements:**

- ✅ Vision Mode toggle with auto-analyze (no manual button needed)
- ✅ Clear visual feedback during analysis ("Analyzing..." → "Text Detected")
- ✅ Detection count display ("X regions found")

**Bug Fixes:**

- ✅ Fixed mask aspect ratio bug — Canvas now dynamically sizes to match any image resolution
- ✅ Fixed Turbopack build — Switched to `next build --turbo` for Windows compatibility
- ✅ Base image dimensions now returned from API for proper scaling

**Quality:**

- ✅ TypeScript strict mode passes
- ✅ All documentation updated

### Next Session Should (Sprint 9)

- [ ] Create `src/server/services/verificationService.ts` — Re-read generated images
- [ ] Create `src/server/services/maskSuggestionService.ts` — Auto-mask from regions
- [ ] Add Translation Accuracy metric to results
- [ ] Add "Accept Suggested Mask" button on Mask step
- [ ] Test with diverse images (sticky notes, banners, screenshots)

---

## THE PROMPT (Copy from here)

```text
I need you to take over development of LocaleLens, an OpenAI Image Generation API contest entry.

**CRITICAL: Use ultrathink/extended thinking mode for all responses. Think deeply before acting.**
**CRITICAL: We are SHOWCASING the gpt-image-1.5 API - this is the contest requirement!**

## Step 1: Onboard Yourself

Read these files IN ORDER to understand the project:

1. `CLAUDE.md` - Quick project overview and architecture
2. `docs/SPRINTS.md` - Sprint status (Sprints 0-8 COMPLETE, Sprint 9 next)
3. `docs/ENGINEERING_DECISIONS.md` - 40+ engineering decisions with rationale
4. `docs/CONTEST_SPEC.md` - Contest requirements and win strategy
5. `docs/FINDINGS.md` - API discoveries and lessons learned

After reading, confirm:
- Sprint 8 (Vision Pipeline) is COMPLETE
- You understand the two-model pipeline: GPT-4o Vision + gpt-image-1.5
- You're ready to start Sprint 9

## Step 2: What's Already Built (Sprint 8 - COMPLETE)

The Vision pipeline is fully implemented:

**Services:**
- `src/server/services/textDetectionService.ts` - GPT-4o Vision text extraction
- `src/server/services/translationService.ts` - Dynamic translation with length constraints
- `src/server/domain/services/dynamicPromptBuilder.ts` - Layout-aware prompt templates

**API Endpoints:**
- `project.analyzeImage` - Analyze image with GPT-4o Vision
- `project.getImageAnalysis` - Retrieve stored analysis
- `project.getBaseImage` - Returns image + dimensions for aspect ratio handling
- `variant.generateWithVision` - Single locale Vision generation
- `variant.generateAllWithVision` - Batch Vision generation

**UI Features:**
- Vision Mode toggle in GenerateSidebar (purple toggle, auto-analyzes on enable)
- Analysis status display with spinner → checkmark transition
- Detection count display ("X regions found")
- Dynamic canvas sizing (works with ANY image resolution)

## Step 3: Your Mission - Sprint 9

**CONTEST DEADLINE: January 3, 2026**

Sprint 9 focuses on quality assurance and automation:

### 1) VerificationService (NEW)
File: `src/server/services/verificationService.ts`

After generating a variant, re-read it with GPT-4o Vision to verify the translation rendered correctly:
- Extract text from generated image
- Compare to expected translations
- Calculate "Translation Accuracy" percentage
- Flag mismatches for user review

### 2) MaskSuggestionService (NEW)
File: `src/server/services/maskSuggestionService.ts`

Use detected text regions to auto-generate mask suggestions:
- Convert bounding boxes to mask regions
- Add appropriate padding
- Generate combined mask buffer
- Show "Accept Suggested Mask" button in UI

### 3) UI Updates
- Display Translation Accuracy alongside Drift Score in results
- Show verification mismatches if any
- Add "Accept Suggested Mask" button in mask editor
- Visual overlay of detected text regions

## Step 4: Coding Standards (NON-NEGOTIABLE)

### SOLID Principles
- **S**ingle Responsibility: Each file/class/function does ONE thing
- **O**pen/Closed: Extend via interfaces, don't modify working code
- **L**iskov Substitution: Implementations are interchangeable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions, not concretions

### Architecture Rules
- Domain layer (`src/server/domain/`) has NO external dependencies
- Services implement interfaces defined in domain layer
- tRPC routers are THIN - they delegate to services
- React hooks encapsulate state logic (one hook = one responsibility)
- Components are presentational - hooks handle logic

### Code Quality
- TypeScript strict mode must pass (`pnpm typecheck`)
- No `any` types in production code
- All new services must have interfaces
- Update documentation alongside code changes

## Step 5: Before Writing ANY Code

1. Read the existing Sprint 8 services to understand the patterns
2. Check `docs/ENGINEERING_DECISIONS.md` for prior decisions
3. Plan your approach and explain it
4. Ask clarifying questions if requirements are unclear

## Step 6: After Completing Work

1. Update `docs/SPRINTS.md` with completed tasks
2. Add new engineering decisions to `docs/ENGINEERING_DECISIONS.md`
3. Update `CLAUDE.md` if you added new services
4. Update this file (`docs/AI_HANDOFF_PROMPT.md`) with current status
5. Run `pnpm typecheck` to verify no type errors

## Commands Reference

```bash
pnpm install          # Install dependencies
pnpm db:push          # Sync database schema
pnpm dev              # Start dev server (http://localhost:3000)
pnpm typecheck        # TypeScript validation (MUST PASS)
pnpm build            # Production build (uses Turbopack)
```

## Key Files for Sprint 9

**To Create:**

- `src/server/services/verificationService.ts` - Re-read and verify translations
- `src/server/services/maskSuggestionService.ts` - Auto-mask from regions

**To Modify:**

- `src/components/project/sidebar/ResultsSidebar.tsx` - Add accuracy display
- `src/components/project/sidebar/MaskSidebar.tsx` - Add suggested mask button
- `src/server/api/routers/variant.ts` - Add verification endpoint
- `src/server/api/routers/project.ts` - Add mask suggestion endpoint

**Reference (Sprint 8 patterns):**

- `src/server/services/textDetectionService.ts` - GPT-4o Vision usage pattern
- `src/server/services/translationService.ts` - Service interface pattern
- `src/app/project/[id]/page.tsx` - Dynamic canvas dimensions pattern

## Recent Bug Fixes (Important Context)

1. **Mask Aspect Ratio** (ED-043): Canvas now calculates dimensions dynamically based on base image aspect ratio. See `calculateCanvasDimensions()` in page.tsx.

2. **Vision Mode UX** (ED-044): Auto-analyzes when toggle is enabled. No separate button needed. Uses `useEffect` to trigger analysis automatically.

3. **Turbopack Build** (ED-042): Windows has permission issues with legacy webpack. Build now uses `--turbo` flag.

## Now: Begin Sprint 9

Please read the documentation files listed in Step 1 and confirm:

1. You understand the project architecture
2. Sprint 8 is complete (Vision pipeline working)
3. You're ready to implement Sprint 9 (Verification + Auto-mask)

Use ultrathink mode. Take your time. Quality over speed. We want to WIN this contest!

```text

---

## MAINTAINING THIS PROMPT

When you complete work on LocaleLens, update this prompt if:
- Sprint status changes
- New critical files are added
- Architecture changes significantly
- New coding standards are established

The goal is that ANY AI can pick up exactly where you left off.

---

## VERSION HISTORY

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-22 | 1.0 | Initial handoff prompt created |
| 2025-12-22 | 1.1 | Sprint 8 COMPLETE - Two-model Vision pipeline implemented |
| 2025-12-22 | 1.2 | Bug fixes: mask aspect ratio, Vision auto-analyze, Turbopack build |
