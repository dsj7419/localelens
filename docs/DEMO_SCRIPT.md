# LocaleLens — DEMO_SCRIPT (Judge-Optimized, Reproducible Runbook)

> Goal: Provide an **airtight, step-by-step demo** that produces **visually compelling, consistent outputs** showing **high-fidelity localized text replacement** (including **RTL**) with **low drift outside masked regions**.  
> Audience: Judges and reviewers running locally.

---

## 1) What This Demo Proves (in < 2 minutes)

LocaleLens demonstrates that the Image Gen API can:

1) **Replace text inside a precise region** while keeping the rest of the design stable.
2) Produce **high-quality typography** in multiple languages (including **Arabic RTL**).
3) Provide a professional QA signal via **Drift Inspector** (change outside mask).

**Expected “wow” moment:** The Arabic version renders right-to-left text cleanly inside the original layout, while the rest of the screenshot remains unchanged.

---

## 2) Prerequisites

### 2.1 System

- Node.js installed
- pnpm installed
- Repo cloned locally

### 2.2 OpenAI API Key

- Create `.env` from `.env.example`
- Add:

```bash
OPENAI_API_KEY=sk-...

Security note: Never commit .env.

3) Local Run (Fresh Clone → Running App)

From repo root:

pnpm install
pnpm db:push
pnpm dev

Open: http://localhost:3000

4) Demo Assets (Exact Files)

We will include a single, canonical demo base image and an optional canonical mask in the repo so results are consistent.

4.1 Required demo base image (committed to repo)

Path: docs/demo-assets/base_appstore_en_1080x1920.png

Dimensions: 1080 x 1920 (portrait)

Style: “App Store screenshot / mobile landing” layout, no real brands, fictional UI.

4.2 Optional canonical mask (committed to repo)

Path: docs/demo-assets/mask_text_regions_1080x1920.png

Format: PNG with alpha

Transparent = “editable” areas

Must match base image dimensions exactly (1080x1920)

If the app supports “Load Demo Mask”, use it.
If not, the demo script includes manual masking steps.

5) Canonical Source Copy (English)

The base image must contain these exact text strings:

Headline (H1):

PLAN YOUR DAY IN SECONDS

Bullets:

Smart schedule suggestions

One-tap reminders

Share with your team

CTA Button:

TRY IT FREE

Footer microtext (small):

Fictional product. Demo only.

6) Demo Locales (Exact)

Generate exactly these three locales:

es-MX (Spanish - Mexico)

fr-CA (French - Canada)

ar (Arabic, RTL)

Tone: neutral
Constraints: layout-safe / compact enabled (where available)

7) Target Localized Copy (Exact)
7.1 Spanish (es-MX)

Headline:

PLANEA TU DÍA EN SEGUNDOS

Bullets:

Sugerencias inteligentes de horario

Recordatorios con un toque

Compártelo con tu equipo

CTA:

PRUÉBALO GRATIS

Footer:

Producto ficticio. Solo demo.

7.2 French (fr-CA)

Headline (compact):

PLANIFIEZ EN QUELQUES SECONDES

Bullets:

Suggestions d’horaire intelligentes

Rappels en un seul toucher

Partagez avec votre équipe

CTA:

ESSAI GRATUIT

Footer:

Produit fictif. Démo seulement.

7.3 Arabic (ar) — RTL REQUIRED

Headline:

خطّط ليومك في ثوانٍ

Bullets:

اقتراحات ذكية للجدول

تذكيرات بلمسة واحدة

شارك مع فريقك

CTA:

جرّبه مجانًا

Footer:

منتج خيالي. للعرض فقط.

RTL requirements (non-negotiable):

Right-aligned text

Proper RTL shaping (not reversed characters)

8) Masking Instructions (Exact Regions)

The mask should cover only the following regions (do not include icons/photos/background):

Headline text box (H1)

Bullet list area (3 lines)

CTA button text

Footer microtext line

Mask strictness rule: tighter is better.

Leave a small padding around letters (e.g., 6–12px), but do not include large background areas.

9) The Prompt Template (Exact)

LocaleLens must build a final prompt using the following template (fill with locale-specific copy from Section 7). This prompt is deliberately strict to reduce drift:

9.1 Prompt template (string)
You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
- Do NOT change anything outside the masked regions: layout, colors, icons, background, device frame, spacing, shadows, and UI elements must remain identical.
- Preserve the original typographic style as closely as possible (font weight, size, letter spacing, alignment, and visual hierarchy).
- Keep text within the original bounding boxes; if space is tight, shorten phrasing slightly while preserving meaning.

TARGET LOCALE: {LOCALE}
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: {H1}
BULLET 1: {B1}
BULLET 2: {B2}
BULLET 3: {B3}
CTA: {CTA}
FOOTER: {FOOTER}

RTL REQUIREMENT (only if locale is Arabic):
- Render all Arabic text right-to-left and right-aligned.
- Ensure correct Arabic letter shaping and natural typography.

10) Final Prompts (Exact, Per Locale)
10.1 es-MX
You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
- Do NOT change anything outside the masked regions: layout, colors, icons, background, device frame, spacing, shadows, and UI elements must remain identical.
- Preserve the original typographic style as closely as possible (font weight, size, letter spacing, alignment, and visual hierarchy).
- Keep text within the original bounding boxes; if space is tight, shorten phrasing slightly while preserving meaning.

TARGET LOCALE: es-MX
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: PLANEA TU DÍA EN SEGUNDOS
BULLET 1: Sugerencias inteligentes de horario
BULLET 2: Recordatorios con un toque
BULLET 3: Compártelo con tu equipo
CTA: PRUÉBALO GRATIS
FOOTER: Producto ficticio. Solo demo.

10.2 fr-CA
You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
- Do NOT change anything outside the masked regions: layout, colors, icons, background, device frame, spacing, shadows, and UI elements must remain identical.
- Preserve the original typographic style as closely as possible (font weight, size, letter spacing, alignment, and visual hierarchy).
- Keep text within the original bounding boxes; if space is tight, shorten phrasing slightly while preserving meaning.

TARGET LOCALE: fr-CA
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: PLANIFIEZ EN QUELQUES SECONDES
BULLET 1: Suggestions d’horaire intelligentes
BULLET 2: Rappels en un seul toucher
BULLET 3: Partagez avec votre équipe
CTA: ESSAI GRATUIT
FOOTER: Produit fictif. Démo seulement.

10.3 ar (RTL)
You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
- Do NOT change anything outside the masked regions: layout, colors, icons, background, device frame, spacing, shadows, and UI elements must remain identical.
- Preserve the original typographic style as closely as possible (font weight, size, letter spacing, alignment, and visual hierarchy).
- Keep text within the original bounding boxes; if space is tight, shorten phrasing slightly while preserving meaning.

TARGET LOCALE: ar
WRITING TONE: neutral

TEXT TO RENDER (exact):
HEADLINE: خطّط ليومك في ثوانٍ
BULLET 1: اقتراحات ذكية للجدول
BULLET 2: تذكيرات بلمسة واحدة
BULLET 3: شارك مع فريقك
CTA: جرّبه مجانًا
FOOTER: منتج خيالي. للعرض فقط.

RTL REQUIREMENT:
- Render all Arabic text right-to-left and right-aligned.
- Ensure correct Arabic letter shaping and natural typography.

11) Expected Output Files (Exact Names)

LocaleLens should write outputs to:

.local-data/projects/{projectId}/variants/es-MX.png

.local-data/projects/{projectId}/variants/fr-CA.png

.local-data/projects/{projectId}/variants/ar.png

And the montage:

.local-data/projects/{projectId}/exports/montage_2x2.png

And zip:

.local-data/projects/{projectId}/exports/localelens_{projectId}_variants.zip

12) Drift Inspector Expectations (Pass/Fail)
12.1 Drift score definition (policy)

Drift Score = % of pixels changed outside masked regions

Thresholds:

PASS: ≤ 2.0%

WARN: 2.0% – 5.0%

FAIL: > 5.0%

12.2 Expected behavior

es-MX: typically PASS/WARN

fr-CA: typically PASS/WARN (French can be longer; compacting helps)

ar: can be WARN initially; if FAIL, regenerate with tighter prompt + tighter mask

13) Troubleshooting (Judge-Friendly)
13.1 If Arabic text is not RTL or looks broken

Regenerate once (Arabic shaping sometimes improves on retry)

Tighten the mask to include only text pixels and minimal padding

Ensure the prompt includes:

“right-to-left and right-aligned”

“correct Arabic letter shaping”

13.2 If text overflows bounding boxes

Switch to compact headline alternatives:

fr-CA headline alt: PLANIFIEZ VITE

es-MX headline alt: PLANEA RÁPIDO

Re-run generation

13.3 If the image edits endpoint rejects gpt-image-1.5

OpenAI docs currently contain inconsistencies about edit support by model. If the edit call fails with a “model not supported for edits” type error, set the image edit model to gpt-image-1 in .env (or app config) and re-run the demo.

Important: The project still “focuses on 1.5” by using it as the default model and documenting the behavior. This fallback ensures judges can reproduce the demo reliably even if API capability differs by account or region.

14) Screenshot Checklist for README (Required for Submission Polish)

Capture these exact screenshots for the README:

Project page showing the base image + mask overlay

Variant viewer showing es-MX output side-by-side with original

Variant viewer showing ar output side-by-side with original

Drift Inspector overlay heatmap toggled ON (any locale)

The final montage (2x2 grid)

15) Timeboxed Demo Script (What the Judge Does)

Minute 0–1: Setup

pnpm install

Create .env with OPENAI_API_KEY

pnpm db:push

pnpm dev

Minute 1–2: Demo

Create project “Demo App Store”

Upload docs/demo-assets/base_appstore_en_1080x1920.png

Create mask (or load docs/demo-assets/mask_text_regions_1080x1920.png)

Select locales: es-MX, fr-CA, ar

Click “Generate Variants”

View drift score + toggle overlay

Export ZIP + montage

16) Engineering Notes (Implementation Requirements for Sr. Engineer)

To make this demo script real and consistent, the build must include:

Ability to upload a base image

Ability to create/save a mask (or load demo mask)

Locale selection for exactly these three locales

Prompt template in Section 9 used verbatim (or functionally equivalent)

Drift computation and overlay generation

Export montage + ZIP
