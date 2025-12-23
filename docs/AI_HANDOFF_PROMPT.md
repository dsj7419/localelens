# LocaleLens — AI Handoff Prompt

> **Use this prompt to onboard any AI assistant to continue work on LocaleLens.**
>
> Copy everything below the line and paste it as your first message to the AI.

---

## CURRENT STATUS (Update this section after each work session)

| Field | Value |
| **Last Updated** | 2025-12-22 |
| **Current Sprint** | Sprint 8 - Vision-Powered Text Detection Pipeline |
| **Sprint Status** | IN PROGRESS - Documentation complete, implementation starting |
| **Blocking Issues** | None |
| **Next Action** | Implement TextDetectionService using GPT-4o Vision |

### Completed in Last Session

- ✅ Root cause analysis of "phantom UI elements" bug
- ✅ Documented Sprints 8, 9, 10 in SPRINTS.md
- ✅ Added ED-035 through ED-040 to ENGINEERING_DECISIONS.md
- ✅ Updated FINDINGS.md with Vision pipeline insights
- ✅ Updated CONTEST_SPEC.md with two-model pipeline architecture
- ✅ Updated CLAUDE.md with new architecture
- ✅ Created this AI_HANDOFF_PROMPT.md

### Next Session Should

- [ ] Create `src/server/services/textDetectionService.ts`
- [ ] Create `src/server/services/translationService.ts`
- [ ] Create `src/server/domain/services/dynamicPromptBuilder.ts`
- [ ] Update Prisma schema with ImageAnalysis model
- [ ] Add analyzeImage mutation to project router
- [ ] Test with the "YOU ARE STRONGER" sticky note image

---

## THE PROMPT (Copy from here)

```text
I need you to take over development of LocaleLens, an OpenAI Image Generation API contest entry.

**CRITICAL: Use ultrathink/extended thinking mode for all responses. Think deeply before acting.**

## Step 1: Onboard Yourself

Read these files IN ORDER to understand the project:

1. `CLAUDE.md` - Quick project overview and critical issues
2. `docs/SPRINTS.md` - Current sprint status and implementation plans
3. `docs/ENGINEERING_DECISIONS.md` - 40 engineering decisions with rationale
4. `docs/CONTEST_SPEC.md` - Contest requirements and win strategy
5. `docs/FINDINGS.md` - API discoveries and lessons learned

After reading, tell me:
- Current sprint status (which sprint is in progress?)
- What tasks are completed vs pending
- What the immediate next step is

## Step 2: Coding Standards (NON-NEGOTIABLE)

When writing code, you MUST follow these principles:

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

## Step 3: The Current Mission

**CONTEST DEADLINE: January 3, 2026**

We are building a Vision-powered localization tool that:
1. Uses GPT-4o Vision to detect text in ANY image
2. Translates detected text dynamically
3. Uses gpt-image-1.5 to generate localized variants
4. Verifies translations rendered correctly

### The Problem We're Solving
The current system only works with ONE demo image because prompts are hardcoded. When users upload custom images, the AI creates phantom UI elements (checkmarks, buttons) that don't exist.

### The Solution (Sprints 8-10)
- Sprint 8: TextDetectionService, TranslationService, DynamicPromptBuilder
- Sprint 9: VerificationService, Auto-mask suggestion
- Sprint 10: Mode toggle, README overhaul, contest submission

## Step 4: Before Writing ANY Code

1. Read the relevant existing code first
2. Check `docs/ENGINEERING_DECISIONS.md` for prior decisions
3. Plan your approach and explain it
4. Ask clarifying questions if requirements are unclear
5. Update documentation as you implement

## Step 5: After Completing Work

1. Update `docs/SPRINTS.md` with completed tasks (mark checkboxes)
2. Add new engineering decisions to `docs/ENGINEERING_DECISIONS.md` if you made architectural choices
3. Update `CLAUDE.md` if you added new services or changed architecture
4. Run `pnpm typecheck` to verify no type errors

## Commands Reference

```bash
pnpm install          # Install dependencies
pnpm db:push          # Sync database schema
pnpm dev              # Start dev server (http://localhost:3000)
pnpm typecheck        # TypeScript validation (MUST PASS)
pnpm build            # Production build
```

## Project Structure Quick Reference

```text
src/
├── app/                          # Next.js pages
│   └── project/[id]/page.tsx     # Main workflow
├── components/project/           # UI components
│   ├── steps/                    # Step-based UI
│   └── sidebar/                  # Sidebar components
├── hooks/                        # React hooks (state logic)
├── server/
│   ├── api/routers/              # tRPC endpoints
│   ├── domain/                   # Business logic (NO DEPS)
│   │   ├── entities/
│   │   ├── repositories/         # Interfaces
│   │   ├── services/             # Domain services
│   │   └── value-objects/
│   ├── infrastructure/           # Implementations
│   └── services/                 # Application services
└── trpc/                         # tRPC setup
```

## Key Files for Current Work (Sprint 8)

**To Create:**

- `src/server/services/textDetectionService.ts` - GPT-4o Vision text extraction
- `src/server/services/translationService.ts` - Text translation
- `src/server/domain/services/dynamicPromptBuilder.ts` - Image-aware prompts

**To Modify:**

- `src/server/domain/services/localePlan.service.ts` - Replace hardcoded copy
- `src/server/api/routers/project.ts` - Add analyzeImage mutation
- `prisma/schema.prisma` - Add ImageAnalysis model

## Now: Begin Onboarding

Please read the documentation files listed in Step 1 and report back with:

1. Your understanding of the project
2. Current sprint status
3. Recommended next action

Use ultrathink mode. Take your time. Quality over speed.

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
| - | - | Sprint 8 (Vision Pipeline) in progress |
