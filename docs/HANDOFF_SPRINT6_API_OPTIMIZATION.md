# SPRINT 6 HANDOFF: Critical OpenAI API Optimization

> **PRIORITY: HIGHEST — BLOCKING CONTEST SUBMISSION**
> **USE ULTRATHINK MODE FOR THIS ENTIRE SESSION**

---

## MISSION BRIEFING

You are taking over development of **LocaleLens**, an entry for the **OpenAI Image Generation API Community Contest**. This is a critical, time-sensitive handoff. The codebase is architecturally solid (SOLID/SRP compliant), visually polished, and functionally complete — but we have a **CRITICAL BLOCKING ISSUE** that must be fixed to win.

**The entire point of this contest is to showcase expert use of the OpenAI gpt-image-1.5 API.** We are currently NOT using the API to its full potential, and our drift detection is FAILING at 14.5%.

---

## YOUR FIRST TASK (MANDATORY - DO NOT SKIP)

Before doing ANYTHING else, you MUST use ultrathink mode and thoroughly research the codebase. Execute these steps IN ORDER:

### Step 1: Read ALL Documentation (Do Not Skip Any)

Read these files completely to understand context:

```
docs/CONTEST_SPEC.md       — Contest requirements, judging criteria, win strategy
docs/SPRINTS.md            — Sprint history, current status, Sprint 6 scope (READ SECTION 8 CAREFULLY!)
docs/ENGINEERING_DECISIONS.md — Architectural decisions ED-001 through ED-019
docs/DEMO_SCRIPT.md        — Exact demo flow, expected outputs
README.md                  — Public-facing documentation
```

### Step 2: Understand the API Integration (CRITICAL)

Read these files to understand how we currently call the OpenAI API:

```
src/server/services/openaiImage.ts              — THE MAIN FILE TO MODIFY (API calls)
src/server/domain/services/localePlan.service.ts — Prompt templates (may need hardening)
src/server/domain/services/variantGeneration.service.ts — Generation pipeline orchestration
src/server/services/diffService.ts              — Drift calculation algorithm
src/server/services/heatmapService.ts           — Heatmap overlay generation
src/server/services/fileStore.ts                — Image file handling
```

### Step 3: Understand the Domain Layer

```
src/server/domain/value-objects/locale.ts       — Locale definitions (es-MX, fr-CA, ar)
src/server/domain/value-objects/drift.ts        — Drift score thresholds
src/server/api/routers/variant.ts               — Variant generation router
```

### Step 4: Understand the Mask System

```
src/components/project/MaskCanvas.tsx           — How masks are created
docs/demo-assets/mask_text_regions_1080x1920.png — The demo mask file
```

---

## THE CRITICAL PROBLEM

### Current Drift Score: 14.5% (FAILING)

Our "Drift Inspector" measures how much the AI changed pixels OUTSIDE the masked region. The goal is near-zero drift outside the mask — we only want text replacement inside the mask.

**What's happening:**
1. Generated images are NOT preserving areas outside the mask
2. Images appear **vertically compressed** (top-to-bottom distortion)
3. **UI elements like buttons are being modified** when they shouldn't be
4. The AI is making unwanted changes beyond just the text in the masked region
5. Overall image fidelity is poor — it looks "different" from the original

**Root Causes (Hypothesis):**
1. **API parameters not optimized** — We're not using `input_fidelity`, `quality`, etc.
2. **Prompts not strict enough** — Not explicitly telling API to preserve non-masked areas
3. **Possible mask format issue** — OpenAI expects: transparent=edit, opaque=preserve
4. **Image size mismatch** — May be causing resize/distortion

---

## OPENAI IMAGE EDIT API REFERENCE

**This is the official API documentation. USE THIS AS YOUR SOURCE OF TRUTH.**

### Endpoint: `POST https://api.openai.com/v1/images/edits`

### Critical Parameters for Our Use Case:

| Parameter | Type | Description | **RECOMMENDED VALUE** |
|-----------|------|-------------|----------------------|
| `image` | file/array | Source image(s) to edit | Our base image |
| `mask` | file | Transparent areas = edit, opaque = preserve | Our mask |
| `prompt` | string | What to generate (max 32000 chars for GPT models) | See below |
| `model` | string | `gpt-image-1`, `gpt-image-1-mini`, `gpt-image-1.5` | `gpt-image-1.5` |
| `input_fidelity` | string | **CRITICAL** — `"high"` or `"low"`. Controls style/feature matching. | **`"high"`** |
| `quality` | string | `"high"`, `"medium"`, `"low"`, `"auto"` | **`"high"`** |
| `size` | string | `"1024x1024"`, `"1536x1024"`, `"1024x1536"`, `"auto"` | Match input or `"auto"` |
| `background` | string | `"transparent"`, `"opaque"`, `"auto"` | **`"opaque"`** |
| `output_format` | string | `"png"`, `"jpeg"`, `"webp"` | `"png"` |
| `n` | integer | Number of images (1-10) | `1` |

### Key Insight: `input_fidelity`

> **"Control how much effort the model will exert to match the style and features, especially facial features, of input images. This parameter is only supported for gpt-image-1. Supports high and low. Defaults to low."**

This is EXACTLY what we need! Setting `input_fidelity: "high"` should help the model preserve more of the original image characteristics.

**NOTE:** Documentation says it's for `gpt-image-1` only, but test with `gpt-image-1.5` as well.

### Mask Format Requirements:

- **Transparent areas (alpha = 0):** Regions the AI should EDIT
- **Opaque areas (alpha = 255):** Regions the AI should PRESERVE

**VERIFY OUR MASK IS CORRECT!** If inverted, the AI will modify everything EXCEPT text.

---

## CURRENT IMPLEMENTATION ANALYSIS

### File: `src/server/services/openaiImage.ts`

Current `editImage` method (around line 118):

```typescript
async editImage(options: EditImageOptions): Promise<ImageServiceResult> {
  const { prompt, imageBuffer, maskBuffer, size = DEMO_EDIT_SIZE } = options;
  // ... model fallback logic ...

  const response = await this.client.images.edit({
    model,
    image: imageFile,
    mask: maskFile,
    prompt,
    n: 1,
    size,
  });
}
```

**PROBLEMS:**
- No `input_fidelity` parameter
- No `quality` parameter
- No `background` parameter
- No `output_format` parameter

### File: `src/server/domain/services/localePlan.service.ts`

Current prompts may not be strict enough. Review the `buildPrompt()` method and ensure prompts include:
- Explicit instruction to ONLY modify masked regions
- Instruction to preserve EXACT pixels outside mask
- Instruction to maintain image dimensions
- Instruction to preserve UI elements (buttons, icons, etc.)

---

## WHAT YOU MUST DO

### Priority 1: Add Missing API Parameters

In `src/server/services/openaiImage.ts`, update the `images.edit` call to include:

```typescript
const response = await this.client.images.edit({
  model,
  image: imageFile,
  mask: maskFile,
  prompt,
  n: 1,
  size,
  input_fidelity: "high",  // ADD THIS - critical for preserving original
  quality: "high",          // ADD THIS - maximum quality
  background: "opaque",     // ADD THIS - prevent transparency issues
  output_format: "png",     // ADD THIS - explicit format
});
```

**NOTE:** Test if `input_fidelity` works with gpt-image-1.5. If not, we may need to use gpt-image-1.

### Priority 2: Harden Prompts

In `src/server/domain/services/localePlan.service.ts`, strengthen the prompts:

```
CRITICAL CONSTRAINTS:
- ONLY modify the text within the transparent/masked regions
- DO NOT modify ANY pixels outside the masked area
- Preserve the EXACT appearance of all non-text elements (buttons, icons, backgrounds)
- Maintain the EXACT same image dimensions and aspect ratio
- Match the original typography style, weight, and color
```

### Priority 3: Verify Mask Format

Check that our mask has:
- **Transparent (alpha=0)** where we want text REPLACED
- **Opaque (alpha=255)** where we want image PRESERVED

If inverted, fix in `fileStore.ts` or mask generation.

### Priority 4: Check Image Size Handling

Verify the `size` parameter matches our input image (1080x1920 portrait).
- Closest API size: `1024x1536` (portrait)
- Check if this is causing distortion
- Consider using `size: "auto"` if available for edits

### Priority 5: Debug Drift Calculation

Review `src/server/services/diffService.ts`:
- Is the comparison fair?
- Is the threshold appropriate?
- Are we comparing at the right resolution?

---

## SUCCESS CRITERIA

When you're done, the following MUST be true:

1. **Drift score ≤ 5%** for all three locales (es-MX, fr-CA, ar)
2. **Generated images maintain EXACT dimensions** of original (no compression)
3. **Non-masked areas are pixel-perfect** or near-perfect
4. **UI elements (buttons, icons) are UNCHANGED**
5. **Only text within masked regions is modified**
6. **TypeScript strict mode passes** (`pnpm typecheck`)

---

## COMMANDS

```bash
pnpm dev          # Start dev server (http://localhost:3000)
pnpm typecheck    # TypeScript validation (MUST PASS)
pnpm db:push      # Sync Prisma schema (if needed)
```

---

## TESTING THE FIX

1. Start dev server: `pnpm dev`
2. Go to http://localhost:3000
3. Click "Load Demo Project" (or create new project with demo assets)
4. Go to Generate step
5. Click "Demo Mode" or "Generate" (if you have API key)
6. Check drift scores on Results step
7. Toggle the "Drift Overlay" to visualize changes outside mask

---

## FILES SUMMARY (Priority Order)

| File | Purpose | Action |
|------|---------|--------|
| `src/server/services/openaiImage.ts` | API calls | **ADD PARAMETERS** |
| `src/server/domain/services/localePlan.service.ts` | Prompts | **HARDEN PROMPTS** |
| `src/server/services/diffService.ts` | Drift calc | Review/debug |
| `docs/demo-assets/mask_text_regions_1080x1920.png` | Mask file | Verify format |
| `src/server/services/fileStore.ts` | Image I/O | Check for issues |

---

## CONTEXT YOU NEED TO KNOW

### What is LocaleLens?

A local-first tool that localizes marketing images (App Store screenshots) using OpenAI's Image Edit API. Users:
1. Upload an image
2. Paint a mask over text regions
3. Generate localized variants (Spanish, French, Arabic RTL)
4. Inspect "drift" (unwanted changes outside mask)

### The Contest

- **OpenAI Image Generation API Community Contest**
- Judges will clone repo, run locally, evaluate in < 5 minutes
- We need to demonstrate **expert use of the API**
- RTL Arabic support is our differentiator
- Drift Inspector shows engineering rigor

### Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict mode)
- tRPC v11
- Prisma + SQLite
- Tailwind CSS v4
- Sharp (image processing)

---

## CRITICAL RULES

1. **FIX THE API CALLS FIRST** — This is the root cause
2. **TEST AFTER EACH CHANGE** — Verify drift scores improve
3. **RUN TYPECHECK** — Must pass before committing
4. **COMMIT FREQUENTLY** — Professional commit messages
5. **ASK IF UNCLEAR** — Don't guess on API behavior

---

## YOUR OUTPUT AFTER RESEARCH

After reading ALL the documentation and code, respond with:

1. **Current State Analysis** — What parameters are missing, what prompts need work
2. **Root Cause Hypothesis** — Why drift is so high
3. **Implementation Plan** — Specific code changes, in priority order
4. **First Fix** — What you'll change first and why

**DO NOT start implementing until confirming the plan.** This ensures alignment.

---

## REMEMBER

**This contest is about showcasing expert use of the OpenAI Image Generation API.**

The visual polish is done. The architecture is solid. Now we need to prove we know how to use the API properly. The `input_fidelity` parameter alone could be the key to winning.

**GO WIN THIS CONTEST!**
