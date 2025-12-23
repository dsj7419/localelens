# LocaleLens — AI Handoff Prompt

> **Use this prompt to onboard any AI assistant to continue work on LocaleLens.**
>
> Copy everything below the line and paste it as your first message to the AI.

---

## CURRENT STATUS (Update this section after each work session)

| Field | Value |
| **Last Updated** | 2025-12-23 |
| **Current Sprint** | Sprint 10 - AI-Powered Prompt Engineering Pipeline |
| **Sprint Status** | IN PROGRESS - README complete, testing remaining |
| **Blocking Issues** | None |
| **Next Action** | Screenshots, diverse image testing, demo GIF |

### Completed in Current Session (Sprint 10 - IN PROGRESS)

**PromptEngineeringService (KEY INNOVATION):**

- `src/server/services/promptEngineeringService.ts` — GPT-4o WRITES prompts for gpt-image-1.5
- Instead of templates, GPT-4o generates image-specific prompts with spatial relationships
- Includes meta-prompt asking GPT-4o to describe exact visual structure, anchor points, preservation elements
- Falls back to template-based prompts if GPT-4o fails
- Factory pattern: `getPromptEngineeringService()`, `createPromptEngineeringService()`

**Why This Matters:**

- Hardcoded demo prompts work because they have exact spatial relationships: "after checkmark icon", "3 checkmark icons are ANCHOR POINTS"
- Dynamic prompts were too generic: "next to icons", "centered in button"
- NOW: GPT-4o generates prompts AS SPECIFIC as hand-crafted ones for ANY image

**Integration:**

- `variant.ts` modified to use `PromptEngineeringService` when `enhancedPrompt: true` (default)
- Added `enhancedPrompt: z.boolean().default(true)` to generateAllWithVision schema

**Cancel Button UX:**

- Added `isCancelling` state to page.tsx
- Cancel button shows "Cancelling..." with spinner
- Message: "Server must complete current operation. Results will be discarded."
- OpenAI API has no cancel endpoint, so this sets correct user expectations

**API Parameter Optimization (ED-058):**

- Added `moderation: "auto"` — Standard content filtering for contest safety (no adult content)
- Added `input_fidelity: "high"` — Better preserves original image details during editing
- These are new gpt-image-1.5 parameters not yet in OpenAI TypeScript SDK types
- Used type assertions (`as any`) to work around SDK limitation

**Image Lightbox for Results (ED-059):**

- `src/components/project/ImageLightbox.tsx` — NEW component using shadcn Dialog (Radix)
- Click-to-zoom on Original and Variant images in Results step
- Visual feedback: `cursor-zoom-in`, ring hover effect, "Click to view full size" tooltip
- Smooth fade-in animation with loading spinner
- Full accessibility with sr-only DialogTitle
- Images display at max 90vw × 85vh while maintaining aspect ratio

**Files Created/Modified:**

- `src/server/services/promptEngineeringService.ts` — NEW (460+ lines)
- `src/server/services/openaiImage.ts` — MODIFIED (moderation, input_fidelity params)
- `src/server/api/routers/variant.ts` — MODIFIED (added import, schema option, integration)
- `src/app/project/[id]/page.tsx` — MODIFIED (isCancelling state)
- `src/components/project/sidebar/GenerateSidebar.tsx` — MODIFIED (cancel button UX)
- `src/components/project/steps/GenerateStep.tsx` — MODIFIED (pass through isCancelling)
- `src/components/project/ImageLightbox.tsx` — NEW (lightbox component)
- `src/components/project/steps/ResultsStep.tsx` — MODIFIED (lightbox integration)

### Sprint 9 Context (Previous Session - COMPLETE)

**VerificationService:**

- GPT-4o Vision re-read verification with Levenshtein distance matching
- Match status thresholds (match >95%, partial 70-95%, mismatch <70%)

**MaskSuggestionService:**

- Auto-generate clean rectangular masks from detected text regions
- Region merging disabled (ED-054)

**Auto-Analyze on Upload:**

- Analysis triggers automatically when base image is uploaded (ED-052)

### What Remains for Sprint 10

- [ ] README overhaul with universal image support
- [ ] Demo video/GIF showing workflow
- [ ] Diverse image testing (8+ image types)
- [ ] Document test results in `docs/TESTING_RESULTS.md`
- [ ] Final polish and contest submission

### Sprint 10 Architecture Achievement

**The Key Innovation:**

```text
Before: GPT-4o → picks "sticky-notes" → we use STICKY_NOTES_TEMPLATE
After:  GPT-4o → analyzes image → WRITES custom prompt with spatial relationships
```

GPT-4o generates prompts that describe:

- Exact visual structure ("3 bullet points, each with checkmark icon on left")
- Spatial relationships ("text starts immediately after checkmark")
- Anchor points ("checkmarks are position anchors")
- Preservation list ("all icons, backgrounds, device frame must be preserved")

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
3. `docs/ENGINEERING_DECISIONS.md` - 59 engineering decisions with rationale
4. `docs/CONTEST_SPEC.md` - Contest requirements and win strategy
5. `docs/FINDINGS.md` - API discoveries and lessons learned

After reading, confirm:
- Sprints 0-9 are COMPLETE
- Sprint 10 is IN PROGRESS (PromptEngineeringService implemented)
- You understand the two-model pipeline: GPT-4o Vision + gpt-image-1.5
- You understand the verification and auto-mask features (Sprint 9)
- You're ready to continue Sprint 10

## Step 2: What's Already Built (Sprints 8-10)

### AI-Powered Prompt Engineering (Sprint 10 - IN PROGRESS):

**Key Innovation - PromptEngineeringService:**
- `src/server/services/promptEngineeringService.ts` - GPT-4o WRITES prompts for gpt-image-1.5
- Instead of templates, GPT-4o generates image-specific prompts with spatial relationships
- Meta-prompt asks GPT-4o to describe exact visual structure, anchor points, preservation elements
- Falls back to template-based prompts if GPT-4o fails
- Factory pattern: `getPromptEngineeringService()`, `createPromptEngineeringService()`

**Why This Matters:**
- Hardcoded demo prompts work because they have exact spatial relationships
- Dynamic prompts were too generic ("next to icons", "centered in button")
- NOW: GPT-4o generates prompts AS SPECIFIC as hand-crafted ones for ANY image

**Integration:**
- `variant.generateAllWithVision` uses PromptEngineeringService when `enhancedPrompt: true` (default)

**Cancel Button UX:**
- Cancel button shows "Cancelling..." with spinner
- Message: "Server must complete current operation. Results will be discarded."

### Vision Pipeline (Sprint 8):

**Services:**
- `src/server/services/textDetectionService.ts` - GPT-4o Vision text extraction (uses semantic positions)
- `src/server/services/translationService.ts` - Dynamic translation with length constraints
- `src/server/domain/services/dynamicPromptBuilder.ts` - Layout-aware prompt templates (fallback)

**API Endpoints:**
- `project.analyzeImage` - Analyze image with GPT-4o Vision (auto-runs on upload)
- `project.getImageAnalysis` - Retrieve stored analysis
- `project.getBaseImage` - Returns image + dimensions for aspect ratio handling
- `variant.generateWithVision` - Single locale Vision generation
- `variant.generateAllWithVision` - Batch Vision generation (uses PromptEngineeringService)

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
- Cancel button shows "Cancelling..." with explanatory message
- Toast message on auto-mask: "This is a starting point — refine if needed"
- Dynamic canvas sizing (works with ANY image resolution)
- **Image Lightbox** (ED-059): Click any image in Results to view at full size in modal overlay

## Step 3: Your Mission - Continue Sprint 10

**CONTEST DEADLINE: January 3, 2026**

Sprint 10 remaining work:

### 1) README Overhaul

- Update with universal image support (not just demo screenshots)
- Explain two-model pipeline (GPT-4o + gpt-image-1.5)
- Explain prompt engineering innovation (GPT-4o writes prompts)
- Updated screenshots showing diverse image support
- Architecture diagram

### 2) Diverse Image Testing

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
2. Check `docs/ENGINEERING_DECISIONS.md` for prior decisions (59 so far!)
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

7. **API Parameters for gpt-image-1.5** (ED-058): Added `moderation: "auto"` for content safety and `input_fidelity: "high"` for better image preservation. TypeScript SDK doesn't have these types yet, so we use type assertions.

8. **Image Lightbox** (ED-059): Click-to-zoom on Results page images. Uses shadcn Dialog (Radix) with smooth animations and full accessibility.

## Now: Begin Sprint 10

Please read the documentation files listed in Step 1 and confirm:

1. You understand the project architecture
2. Sprints 0-9 are complete (Vision pipeline, verification, auto-mask all working)
3. You're ready to implement Sprint 10 (dynamic prompts, README, testing)

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
| 2025-12-22 | 1.3 | Sprint 9 COMPLETE - VerificationService, MaskSuggestionService implemented |
| 2025-12-23 | 1.4 | Sprint 9 refinements: semantic positions, auto-analyze on upload, toast message, Continue button fix |
| 2025-12-23 | 1.5 | Sprint 10 IN PROGRESS - PromptEngineeringService (GPT-4o writes prompts for gpt-image-1.5), cancel button UX |
| 2025-12-23 | 1.6 | API optimization (moderation, input_fidelity), Image lightbox for results (ED-058, ED-059) |
