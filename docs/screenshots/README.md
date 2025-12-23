# Screenshots

Screenshots and media for the README gallery.

---

## Required Media (Priority Order)

### 1. Hero Image/GIF (Most Important)

**Filename:** `hero-demo.gif` or `hero-demo.png`

Shows the complete workflow in action. This is the first visual judges see.

**Content:**

- Streaming generation showing partial images building up
- OR: Side-by-side before/after comparison
- OR: 2×2 montage showing Original + 3 locales

**Capture method:** Use screen recording software (OBS, ScreenToGif) at 1280×720

---

### 2. Workflow Screenshots

| Step | Filename | What to Capture |
| Upload | `step-upload.png` | Homepage with "Try Demo Project" button visible |
| Mask | `step-mask.png` | Mask editor with suggested regions shown, tools visible |
| Generate | `step-generate.png` | Generation in progress with streaming preview |
| Results | `step-results.png` | Side-by-side comparison with drift score visible |

---

### 3. Feature Highlights

| Feature | Filename | What to Capture |
| Vision Analysis | `feature-vision.png` | "X text regions detected" message after analysis |
| Streaming | `feature-streaming.gif` | GIF showing partial images building up (5-10 seconds) |
| Drift Inspector | `feature-drift.png` | Heatmap overlay showing drift analysis |
| RTL Arabic | `feature-rtl.png` | Arabic variant showing right-to-left text |
| Montage Export | `feature-montage.png` | The 2×2 comparison grid |

---

## Capture Instructions

### Setup

1. Run the app: `pnpm dev`
2. Open browser to `http://localhost:3000`
3. Set viewport to **1280×800** (DevTools → Device Toolbar → Responsive)
4. Use the demo project for consistent results

### For Screenshots

1. Navigate to the appropriate step
2. Use full-page screenshot (Ctrl+Shift+P → "Capture screenshot")
3. Crop to show the relevant UI
4. Save as PNG

### For GIFs

1. Use ScreenToGif, OBS, or LICEcap
2. Record at 1280×720
3. Keep duration under 15 seconds
4. Optimize with ezgif.com (target: under 5MB)

### Optimization

Before committing:

- PNG: Run through TinyPNG or similar (aim for <500KB)
- GIF: Use ezgif.com to optimize (aim for <5MB)

---

## Naming Convention

Use descriptive names without "placeholder":

```text
hero-demo.gif          # Main hero media
step-upload.png        # Workflow step
step-mask.png
step-generate.png
step-results.png
feature-vision.png     # Feature highlight
feature-streaming.gif
feature-drift.png
feature-rtl.png
feature-montage.png
```

---

## Integration with README

After capturing, update the README.md with actual image references:

```markdown
<!-- Before -->
<!-- Screenshot: Upload step showing custom image analysis -->

<!-- After -->
![Upload Step](docs/screenshots/step-upload.png)
```

---

## Quality Checklist

Before committing screenshots:

- [ ] Images are clear and readable
- [ ] No personal information visible
- [ ] Browser chrome cropped out (or minimal)
- [ ] File sizes optimized
- [ ] Consistent viewport size across all screenshots
- [ ] Dark mode OR light mode (pick one, be consistent)
