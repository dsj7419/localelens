# LocaleLens — API Findings & Lessons Learned

> Key discoveries, limitations, and best practices from building LocaleLens with the OpenAI Image Generation API (gpt-image-1.5).

---

## Executive Summary

LocaleLens demonstrates that **gpt-image-1.5 is capable of high-quality text localization** when used correctly. However, success depends heavily on **mask design** and **prompt engineering**. This document captures our findings for the benefit of future developers and OpenAI's API team.

---

## Key Findings

### 1. Mask Design is Critical

**Discovery:** The size and shape of the mask dramatically affects output quality.

| Mask Strategy | Result |
| Too tight (text only) | Text gets cut off at edges, misaligned |
| Too loose (large area) | Model hallucinates content, adds artifacts, black boxes |
| Optimal (text + small margin) | Best results with proper positioning |

**Best Practice:**

- Include a small margin around text (5-10% padding)
- Keep visual anchor points (icons, checkmarks) OUTSIDE the mask
- The model needs to SEE surrounding context to position text correctly

**Example Issue:** When the mask included only text with no margin, the headline "PLANEA TU DÍA EN SEGUNDOS" would get cut off at the top. When the mask was too large, Arabic would generate a black box in the middle of the image.

### 2. input_fidelity is NOT Available for gpt-image-1.5

**Critical Discovery:** The `input_fidelity` parameter (which controls how closely the model matches the original image) is **only available for gpt-image-1**, NOT gpt-image-1.5.

This means preservation must be achieved through:

1. **Prompt engineering** - Explicit instructions to preserve pixels
2. **Post-processing** - Pixel-perfect composite mode
3. **Mask design** - Smaller, more targeted masks

### 3. Streaming Works but Requires Careful SSE Parsing

**Discovery:** The streaming API splits SSE events across network chunks. A single event like:

```text
event: image_edit.partial_image
data: {"b64_json": "..."}
```

May arrive as:

- Chunk 1: `event: image_edit.partial_image\n`
- Chunk 2: `data: {"b64_json": "..."}\n`

**Solution:** Track event type in variables that persist ACROSS chunks, not inside the parsing loop.

### 4. Size "auto" is Essential for Dimension Preservation

**Discovery:** Using fixed sizes like `1024x1536` causes aspect ratio distortion when the source image has different proportions.

| Source | Fixed Size | Result |
| 1080×1920 (0.5625) | 1024×1536 (0.667) | Vertical compression |

**Solution:** Use `size: "auto"` and post-resize the output to match original dimensions.

### 5. Localization Context Improves Text Positioning

**Discovery:** Prompts that explain the TASK (localization/translation) produce better results than generic "replace text" instructions.

**Before:**

```text
You are performing SURGICAL text replacement on a marketing screenshot.
```

**After:**

```text
You are a LOCALIZATION TOOL performing text translation on an app store screenshot.
TASK: Replace English text with {LOCALE} translations. This is a SURGICAL text substitution - the translated text must occupy the EXACT same visual positions as the original English text.
```

The model better understands that:

- Checkmarks are anchor points
- Text should align with existing elements
- Button text should be centered

### 6. Multi-Generation with Auto-Select Improves Quality

**Discovery:** Generating multiple variants (n=2-3) and selecting the one with lowest drift score produces consistently better results than single generation.

**Trade-off:** 2-3x API cost per locale, but significantly higher quality output.

### 7. Pixel-Perfect Composite Mode Guarantees 0% Drift

**Discovery:** Post-processing composite that:

1. Takes ORIGINAL pixels where mask is opaque
2. Takes GENERATED pixels where mask is transparent

Produces **guaranteed 0% drift** outside the mask, regardless of what the API generates.

This is the most reliable method for production use when pixel-perfect preservation is required.

---

## API Limitations Encountered

### 1. Inconsistent Behavior with Large Masks

When the masked area exceeds ~30% of the image, the model may:

- Leave areas blank or black
- Drop content entirely (missing headlines)
- Change unrelated elements (checkmarks changing color)
- Add unexpected artifacts

### 2. No Control Over Text Positioning

The API does not provide parameters to specify:

- Text alignment (left, center, right)
- Text start position
- Bounding box constraints

All positioning must be communicated through prompts and inferred from context.

### 3. RTL Language Challenges

Arabic text works but requires:

- Explicit RTL instructions in prompt
- Right-alignment guidance
- Checkmarks may need to appear on opposite side (model handles this inconsistently)

### 4. No Font Matching

The model attempts to match the original font style but there's no parameter to specify:

- Exact font family
- Font weight
- Letter spacing

Results vary in how closely typography matches the original.

---

## Recommendations for OpenAI

Based on our extensive testing, we suggest these API improvements:

1. **Add `input_fidelity` to gpt-image-1.5** - The most impactful change for inpainting use cases

2. **Add text positioning parameters** - Allow specifying alignment, bounding box, or anchor points

3. **Improve large mask handling** - Current behavior with large masked areas is unpredictable

4. **Add font specification** - Parameter to specify font family or style for text rendering

5. **Better RTL support** - Built-in handling for right-to-left languages

---

## What Works Well

Despite the challenges, gpt-image-1.5 excels at:

- **Text rendering quality** - Generated text is clear and readable
- **Font style inference** - Usually matches the general style
- **Color matching** - Text colors typically match the original
- **Multi-language support** - Successfully renders Spanish, French, Arabic
- **Streaming capability** - Progressive generation provides great UX

---

## Conclusion

LocaleLens demonstrates that gpt-image-1.5 can be used effectively for text localization with:

- Careful mask design
- Explicit localization prompts
- Post-processing composite mode
- Multi-generation selection

The API has room for improvement in preservation guarantees and text positioning, but current limitations can be worked around with proper engineering.

---

*These findings are from the LocaleLens project, an entry for the OpenAI Image Generation API Contest (December 2024).*
