# Sprint 10: World-Class Dynamic Vision Pipeline

## The Problem

Current Vision mode produces generic prompts that don't match the quality of hardcoded demo prompts.
Result: Black rectangles, missing icons, inconsistent results.

**Hardcoded prompts work because they have:**
- Exact spatial relationships: "after checkmark icon"
- Named anchor points: "3 checkmark icons are ANCHOR POINTS"
- Specific UI element descriptions: "Button shapes are CONTAINERS"
- Explicit preservation lists

**Current dynamic prompts are too generic:**
- "next to icons"
- "centered in button"
- No specific anchor points

## The World-Class Solution

**Key Insight: Let GPT-4o WRITE the prompt for gpt-image-1.5!**

Instead of generic templates, we use GPT-4o's understanding of the image to generate
prompts that are AS SPECIFIC as manually-written ones.

## Enhanced Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Deep Structural Analysis (Enhanced TextDetectionService)           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: Base image                                                           │
│                                                                              │
│  GPT-4o Vision analyzes:                                                     │
│  ├─ Text regions with semantic roles (headline, bullet, CTA, footer)        │
│  ├─ UI elements (icons, buttons, frames, dividers)                          │
│  ├─ SPATIAL RELATIONSHIPS:                                                  │
│  │   • "Text A is immediately RIGHT OF checkmark icon"                      │
│  │   • "Text B is CENTERED INSIDE blue rounded button"                      │
│  │   • "Text C is BELOW logo and ABOVE bullet list"                         │
│  ├─ Visual hierarchy (primary/secondary/tertiary)                           │
│  └─ Layout characteristics (colors, background, style)                      │
│                                                                              │
│  Output: StructuralAnalysis JSON                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: User Mask Definition                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User defines which regions to edit:                                        │
│  ├─ "Use Suggested Mask" (auto-generated from text regions)                 │
│  └─ Manual drawing/refinement                                               │
│                                                                              │
│  Mask filtering:                                                             │
│  ├─ Only text regions that OVERLAP with mask will be translated             │
│  └─ Unmasked text regions are preserved                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Translation (TranslationService)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input: Filtered text regions + target locale                               │
│                                                                              │
│  GPT-4o translates with constraints:                                        │
│  ├─ Length constraints (fit same visual space)                              │
│  ├─ Semantic role awareness (headline = impactful, CTA = action-oriented)   │
│  └─ Context from image type                                                 │
│                                                                              │
│  Output: TranslatedText[]                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Intelligent Prompt Engineering (NEW PromptEngineeringService)       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ★ THE KEY INNOVATION ★                                                     │
│                                                                              │
│  Input:                                                                      │
│  ├─ StructuralAnalysis (from Phase 1)                                       │
│  ├─ TranslatedText[] (from Phase 3)                                         │
│  ├─ Target locale                                                           │
│  └─ Mask image (optional, for visual context)                               │
│                                                                              │
│  GPT-4o WRITES the prompt for gpt-image-1.5:                                │
│                                                                              │
│  "Given this structural analysis and translations, write a DETAILED,        │
│   SPECIFIC prompt for an image editing model that describes:                │
│   1. The EXACT layout and visual structure                                  │
│   2. WHERE each translated text should appear (using spatial relationships) │
│   3. Anchor points and containers                                           │
│   4. What elements must be PRESERVED                                        │
│   5. Strong preservation warnings                                           │
│                                                                              │
│   Write it as if a human expert crafted it for THIS EXACT IMAGE."           │
│                                                                              │
│  Output: Highly specific prompt like:                                       │
│                                                                              │
│  "You are editing a mobile app screenshot with a centered layout.           │
│                                                                              │
│   VISUAL STRUCTURE:                                                          │
│   - Blue chevron icon at top center - DO NOT MODIFY                         │
│   - 'LocaleLens' brand text below icon - DO NOT MODIFY                      │
│   - Large headline centered below brand                                     │
│   - 3 feature bullets, each with blue checkmark icon on LEFT:               │
│     * Checkmark → 'Smart schedule suggestions'                              │
│     * Checkmark → 'One-tap reminders'                                       │
│     * Checkmark → 'Share with your team'                                    │
│   - Blue rounded button at bottom with 'TRY IT FREE'                        │
│   - Gray footer text at very bottom                                         │
│                                                                              │
│   TEXT REPLACEMENTS (Spanish):                                              │
│   1. HEADLINE (centered): 'PLANEA TU DÍA EN SEGUNDOS'                       │
│   2. BULLET 1 (immediately after checkmark): 'Sugerencias...'               │
│   3. BULLET 2 (immediately after checkmark): 'Recordatorios...'             │
│   4. BULLET 3 (immediately after checkmark): 'Compártelo...'                │
│   5. BUTTON TEXT (centered in button): 'PRUÉBALO GRATIS'                    │
│   6. FOOTER (centered, gray): 'Producto ficticio...'                        │
│                                                                              │
│   PRESERVATION (CRITICAL):                                                  │
│   - All 3 checkmark icons stay in EXACT positions                           │
│   - Blue button shape/color unchanged                                       │
│   - App icon and brand preserved exactly                                    │
│   - Background gradient preserved exactly                                   │
│   - Text starts at SAME position as original"                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: Image Generation (gpt-image-1.5)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Input:                                                                      │
│  ├─ AI-crafted specific prompt (from Phase 4)                               │
│  ├─ Base image                                                              │
│  └─ Mask image                                                              │
│                                                                              │
│  gpt-image-1.5 generates with:                                              │
│  ├─ size: "auto"                                                            │
│  ├─ quality: "high"                                                         │
│  ├─ background: "opaque"                                                    │
│  └─ output_format: "png"                                                    │
│                                                                              │
│  Output: Generated image (may have drift outside mask)                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: Pixel-Perfect Composite                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Since gpt-image-1.5 uses mask as "soft guidance":                          │
│                                                                              │
│  For each pixel:                                                             │
│  ├─ If mask is OPAQUE (preserve): use ORIGINAL pixel                        │
│  └─ If mask is TRANSPARENT (edit): use GENERATED pixel                      │
│                                                                              │
│  Result: GUARANTEED 0% drift outside mask                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: Verification (VerificationService)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GPT-4o Vision reads the generated image:                                   │
│  ├─ Extracts actual text in target language                                 │
│  ├─ Compares to expected translations                                       │
│  └─ Reports accuracy percentage                                             │
│                                                                              │
│  Color-coded display:                                                        │
│  ├─ Green: 75%+ accuracy                                                    │
│  ├─ Yellow: 60-74.99% accuracy                                              │
│  └─ Red: Below 60% accuracy                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why This Works

1. **AI Writes AI Prompts**: GPT-4o understands the image and writes prompts
   that are as specific as human-written ones.

2. **Spatial Relationships**: Instead of generic "next to icon", we get
   "immediately to the right of blue checkmark icon at position X".

3. **Anchor Points**: GPT-4o identifies and names anchor points like
   "the 3 checkmark icons define where bullet text starts".

4. **Container Awareness**: "Text is CENTERED INSIDE the blue rounded button"
   not just "centered in button".

5. **Preservation Lists**: GPT-4o generates specific lists of what NOT to modify
   based on actual image content.

## Implementation Files

### New Service: `promptEngineeringService.ts`

```typescript
interface PromptEngineeringInput {
  structuralAnalysis: StructuralAnalysis;
  translations: TranslatedText[];
  locale: LocaleId;
  maskDescription?: string; // Optional description of masked areas
}

interface PromptEngineeringResult {
  prompt: string;
  confidence: number;
  preservationElements: string[];
  anchorPoints: string[];
}
```

### Enhanced: `textDetectionService.ts`

```typescript
interface StructuralAnalysis {
  textRegions: TextRegion[];
  uiElements: UIElement[];
  spatialRelationships: SpatialRelationship[];
  hierarchy: VisualHierarchy;
  layout: LayoutCharacteristics;
}

interface SpatialRelationship {
  textId: string;
  relationship: 'right-of' | 'left-of' | 'below' | 'above' | 'inside' | 'centered-in';
  targetElement: string; // "checkmark icon", "blue button", etc.
  description: string; // Natural language description
}

interface UIElement {
  type: 'icon' | 'button' | 'frame' | 'divider' | 'image' | 'background';
  description: string;
  position: string; // "top-center", "left of bullet 1", etc.
  preservationPriority: 'critical' | 'high' | 'medium';
}
```

## Cost Analysis

Additional GPT-4o call for prompt engineering: ~$0.01-0.02 per generation

For contest-winning quality, this is worth it.

## Optional Enhancement: User-Editable Prompts

In Generate step, show "Advanced" toggle that reveals:
- The AI-generated prompt
- User can edit/refine before sending to gpt-image-1.5
- Power users get full control

## Success Metrics

- Works with ANY image containing text
- Produces results as good as hardcoded demo prompts
- Zero black rectangles
- Preserved icons and UI elements
- Accurate translations in correct positions
