# LocaleLens — AI Handoff Prompt

> **Use this prompt to onboard any AI assistant to continue work on LocaleLens.**
>
> Copy everything below the line and paste it as your first message to the AI.

---

## CURRENT STATUS (Update this section after each work session)

| Field | Value |
| **Last Updated** | 2025-12-23 |
| **Current Sprint** | Sprint 10 - Contest Submission Polish |
| **Sprint Status** | PLANNED - Ready to start |
| **Blocking Issues** | None |
| **Next Action** | Dynamic prompt generation, README overhaul, diverse image testing |

### Completed in Last Session (Sprint 9 - COMPLETE)

**VerificationService (NEW):**

- `src/server/services/verificationService.ts` — GPT-4o Vision re-read verification
- Levenshtein distance for fuzzy text matching
- Match status thresholds (match >95%, partial 70-95%, mismatch <70%)
- Overall verification status (pass >85%, warn 60-85%, fail <60%)
- Factory pattern with interface segregation

**MaskSuggestionService (NEW):**

- `src/server/services/maskSuggestionService.ts` — Auto-generate clean rectangular masks
- Converts bounding boxes to pixel coordinates with padding
- Region merging DISABLED (keeps separate text elements separate - ED-054)
- PNG generation with alpha channel (Sharp)

**TranslationService Enhancement:**

- Line-count preservation constraint added to prompts
- Validation with warning logging for count mismatches

**Database Updates:**

- Added `translationAccuracy`, `verificationStatus`, `verificationDetails` to Variant model
- `updateVerification` method in repository

**API Endpoints (NEW):**

- `variant.verify` — Verify translation accuracy for a generated variant
- `project.getSuggestedMask` — Get auto-generated mask from detected regions
- `project.applySuggestedMask` — Apply suggested mask to project

**UI Updates:**

- `VerificationBadge` component with color-coded accuracy display
- "Verify Translation" button in ResultsSidebar
- "Use Suggested Mask" button in MaskSidebar (when analysis available)
- Translation Accuracy displayed alongside Drift Score
- Toast message: "Auto-mask applied (X regions) - This is a starting point" (ED-053)

**Sprint 9 Refinements (Same Session):**

- Auto-analyze on image upload (ED-052) — Analysis triggers when base image is uploaded
- Semantic position detection (ED-051) — GPT-4o uses "left/center/right" instead of coordinates
- Continue button fix (ED-055) — Refetch project before mask to enable button properly
- Disabled region merging (ED-054) — Each text region gets its own mask
- Auto-mask as "starting point" UX (ED-053) — Toast message sets correct expectations

**Quality:**

- TypeScript strict mode passes
- 55 engineering decisions now documented (ED-001 through ED-055)

### Sprint 8 Context (Previous Session)

**Core Vision Pipeline:**

- `TextDetectionService` — GPT-4o Vision text extraction with bounding boxes
- `TranslationService` — Dynamic text translation with length constraints
- `DynamicPromptBuilder` — Layout-aware prompt templates
- Vision Mode toggle with auto-analyze

### What Sprint 10 Should Cover

- [ ] Remove predefined layout templates from DynamicPromptBuilder
- [ ] Have GPT-4o generate `preservationInstructions` and `localizationGuidance` dynamically
- [ ] Test with 8+ diverse image types (app screenshots, posters, banners, memes, etc.)
- [ ] Update README with universal image support
- [ ] Create demo video/GIF showing workflow
- [ ] Final polish and contest submission

### Sprint 10 Architecture Goal (WORLD-CLASS)

Remove predefined layout templates. Have GPT-4o generate:

- `preservationInstructions`: What must stay exactly the same in THIS image
- `localizationGuidance`: How text should be replaced in THIS image

This makes the system truly universal — no hardcoded assumptions about image content.

---

## THE PROMPT (Copy from here)

```text
I need you to take over development of LocaleLens, an OpenAI Image Generation API contest entry.

**CRITICAL: Use ultrathink/extended thinking mode for all responses. Think deeply before acting.**
**CRITICAL: We are SHOWCASING the gpt-image-1.5 API - this is the contest requirement!**

## Step 1: Onboard Yourself

Read these files IN ORDER to understand the project:

1. `CLAUDE.md` - Quick project overview and architecture
2. `docs/SPRINTS.md` - Sprint status (Sprints 0-9 COMPLETE, Sprint 10 next)
3. `docs/ENGINEERING_DECISIONS.md` - 55 engineering decisions with rationale
4. `docs/CONTEST_SPEC.md` - Contest requirements and win strategy
5. `docs/FINDINGS.md` - API discoveries and lessons learned

After reading, confirm:
- Sprints 0-9 are COMPLETE
- You understand the two-model pipeline: GPT-4o Vision + gpt-image-1.5
- You understand the verification and auto-mask features (Sprint 9)
- You're ready to start Sprint 10

## Step 2: What's Already Built (Sprints 8-9 - COMPLETE)

### Vision Pipeline (Sprint 8):

**Services:**
- `src/server/services/textDetectionService.ts` - GPT-4o Vision text extraction (uses semantic positions)
- `src/server/services/translationService.ts` - Dynamic translation with length constraints
- `src/server/domain/services/dynamicPromptBuilder.ts` - Layout-aware prompt templates

**API Endpoints:**
- `project.analyzeImage` - Analyze image with GPT-4o Vision (auto-runs on upload)
- `project.getImageAnalysis` - Retrieve stored analysis
- `project.getBaseImage` - Returns image + dimensions for aspect ratio handling
- `variant.generateWithVision` - Single locale Vision generation
- `variant.generateAllWithVision` - Batch Vision generation

### Verification & Auto-Mask (Sprint 9):

**Services:**
- `src/server/services/verificationService.ts` - GPT-4o re-read verification with Levenshtein matching
- `src/server/services/maskSuggestionService.ts` - Auto-generate rectangular masks from detected regions

**API Endpoints:**
- `variant.verify` - Verify translation accuracy, returns VerificationResult
- `project.getSuggestedMask` - Get auto-generated mask suggestion
- `project.applySuggestedMask` - Apply suggested mask to project

**UI Features:**
- Vision Mode toggle in GenerateSidebar (purple toggle, auto-analyzes on enable)
- "Use Suggested Mask" button in MaskSidebar (shows when analysis available)
- "Verify Translation" button in ResultsSidebar
- VerificationBadge showing accuracy percentage with color coding
- Toast message on auto-mask: "This is a starting point — refine if needed"
- Dynamic canvas sizing (works with ANY image resolution)

## Step 3: Your Mission - Sprint 10

**CONTEST DEADLINE: January 3, 2026**

Sprint 10 focuses on final polish and contest submission:

### 1) Dynamic Prompt Generation (ARCHITECTURAL UPGRADE)
File: `src/server/domain/services/dynamicPromptBuilder.ts`

Currently uses predefined layout templates (sticky-notes, app-screenshot, banner, etc.).

GOAL: Have GPT-4o generate preservation/localization instructions dynamically:
```typescript
// Add to ImageAnalysis in TextDetectionService:
{
  preservationInstructions: "The 4 colored sticky notes must keep their exact colors...",
  localizationGuidance: "Each note contains one phrase. Replace text centered..."
}
```

This makes the system truly universal — works for ANY image type.

### 2) README Overhaul
- Update with universal image support (not just demo screenshots)
- Explain two-model pipeline (GPT-4o + gpt-image-1.5)
- Updated screenshots showing diverse image support
- Architecture diagram

### 3) Diverse Image Testing
Test with multiple image types to prove universal support:
- App store screenshots (original use case)
- Motivational posters (sticky notes)
- Marketing banners
- Social media graphics
- Product packaging
- Memes / informal graphics

Document results in `docs/TESTING_RESULTS.md`

### 4) Demo Video/GIF
Create compelling demo showing:
- Upload custom image
- Automatic text detection
- Auto-mask suggestion
- Streaming generation
- 0% drift result
- Translation verification

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

1. Read the existing Sprint 8-9 services to understand the patterns
2. Check `docs/ENGINEERING_DECISIONS.md` for prior decisions (55 so far!)
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

## Key Files for Sprint 10

**To Modify:**

- `src/server/services/textDetectionService.ts` - Add preservationInstructions/localizationGuidance
- `src/server/domain/services/dynamicPromptBuilder.ts` - Remove layout templates, use GPT-4o generated instructions
- `README.md` - Complete overhaul

**To Create:**

- `docs/TESTING_RESULTS.md` - Diverse image test results

**Reference (Sprint 9 patterns):**

- `src/server/services/verificationService.ts` - GPT-4o Vision usage pattern
- `src/server/services/maskSuggestionService.ts` - Service interface pattern
- `src/app/project/[id]/page.tsx` - Dynamic canvas, auto-analyze, toast patterns

## Important Bug Fixes (Context)

1. **Semantic Positions** (ED-051): GPT-4o uses "left/center/right" descriptions instead of precise coordinates. Coordinates are derived from semantic positions.

2. **Auto-Analyze on Upload** (ED-052): Analysis triggers in `onBaseImageChange` callback when base image is uploaded. Existing analysis checked on page load.

3. **Auto-Mask as Starting Point** (ED-053): Toast message informs users to refine the auto-mask. Sets correct expectations.

4. **Region Merging Disabled** (ED-054): Each text region gets its own mask rectangle. Merging was combining separate text elements.

5. **Continue Button Fix** (ED-055): `queries.refetchProject()` must run BEFORE `refetchMask()` to update hasMask state.

6. **Turbopack Build** (ED-042): Windows has permission issues with legacy webpack. Build now uses `--turbo` flag.

## Now: Begin Sprint 10

Please read the documentation files listed in Step 1 and confirm:

1. You understand the project architecture
2. Sprints 0-9 are complete (Vision pipeline, verification, auto-mask all working)
3. You're ready to implement Sprint 10 (dynamic prompts, README, testing)

Use ultrathink mode. Take your time. Quality over speed. We want to WIN this contest!
```

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
| 2025-12-22 | 1.3 | Sprint 9 COMPLETE - VerificationService, MaskSuggestionService implemented |
| 2025-12-23 | 1.4 | Sprint 9 refinements: semantic positions, auto-analyze on upload, toast message, Continue button fix |
