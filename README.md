# LocaleLens

**Localize text inside real marketing images—with automatic drift detection.**

LocaleLens uses OpenAI's Image Generation API to replace text regions in app store screenshots and marketing visuals while preserving the original design. It automatically detects unintended changes outside the masked area, flags quality issues, and exports production-ready assets.

Built for the [OpenAI Image Generation API Contest](https://openai.com/).

---

## Demo (< 60 seconds)

<!-- TODO: Replace with actual GIF once API access is verified -->
![Demo Flow Placeholder](docs/screenshots/demo-flow-placeholder.png)

1. **Load Demo Project** — Pre-configured with a sample App Store screenshot
2. **View Mask** — Text regions are already marked for replacement
3. **Generate Variants** — Creates Spanish, French, and Arabic versions
4. **Inspect Drift** — See exactly what changed outside the mask
5. **Export** — Download ZIP bundle or 2×2 comparison montage

> **No API key?** Click "Demo Mode" to see pre-generated outputs with full drift analysis.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Mask Editor** | Paint text regions with brush/rectangle tools. Transparent areas get replaced. |
| **Multi-Locale** | Spanish (es-MX), French (fr-CA), Arabic (ar) with RTL support |
| **Drift Inspector** | Pixel-level diff detects changes outside the mask. PASS/WARN/FAIL thresholds. |
| **Heatmap Overlay** | Visual highlighting of unintended modifications |
| **Regenerate** | One-click retry with stricter constraints for failed variants |
| **Demo Mode** | Full UX works offline using committed demo outputs |
| **Export Suite** | Per-locale PNG, ZIP bundle, 2×2 montage grid |

---

## How It Works

```text
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  1. UPLOAD  │ ──▶  │  2. MASK    │ ──▶  │  3. GENERATE│ ──▶  │  4. INSPECT │
│             │      │             │      │             │      │             │
│ Base image  │      │ Paint text  │      │ OpenAI API  │      │ Drift score │
│ (1080×1920) │      │ regions     │      │ per locale  │      │ + heatmap   │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
```

**Drift Detection:** After generation, LocaleLens compares each variant against the original *outside* the masked region. Changes above 2% trigger warnings; above 5% trigger failures with automatic regeneration options.

---

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/localelens.git
cd localelens
pnpm install && pnpm db:push && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### First Run Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Add your `OPENAI_API_KEY` (or use Demo Mode without one)
- [ ] Run `pnpm db:push` to initialize SQLite database

---

## Demo Mode (No API Key Required)

LocaleLens includes pre-generated outputs so judges and reviewers can experience the full workflow without API access.

```bash
# Seed demo assets and open the app
pnpm demo:seed
pnpm dev
```

Then:

1. Click **"Try Demo Project"**
2. Navigate to **Generate** tab
3. Click **"Demo Mode"** instead of "Generate Variants"
4. View results, toggle drift overlays, download exports

Demo Mode loads outputs from `docs/demo-assets/expected-outputs/` and runs the complete drift analysis pipeline.

---

## Configuration

### Environment Variables

```bash
# .env
OPENAI_API_KEY=sk-...               # Required for live generation
IMAGE_MODEL=gpt-image-1.5           # Primary model (contest target)
IMAGE_MODEL_FALLBACK=gpt-image-1    # Fallback if primary unavailable
DATABASE_URL=file:./db.sqlite       # Local SQLite (default)
```

### Supported Locales

| Locale | Language | Direction | Sample Text |
|--------|----------|-----------|-------------|
| `es-MX` | Spanish (Mexico) | LTR | "¡Descarga ahora!" |
| `fr-CA` | French (Canada) | LTR | "Téléchargez maintenant!" |
| `ar` | Arabic | RTL | "!حمّل الآن" |

---

## Screenshots

### Homepage
<!-- TODO: Replace with actual screenshot -->
![Homepage](docs/screenshots/homepage-placeholder.png)

### Mask Editor
<!-- TODO: Replace with actual screenshot -->
![Mask Editor](docs/screenshots/mask-editor-placeholder.png)

### Variant Results with Drift Inspector
<!-- TODO: Replace with actual screenshot -->
![Results](docs/screenshots/results-placeholder.png)

### 2×2 Montage Export
<!-- TODO: Replace with actual screenshot -->
![Montage](docs/screenshots/montage-placeholder.png)

---

## Project Structure

```text
localelens/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Homepage with project list
│   │   └── project/[id]/       # Project workflow (upload → mask → generate → results)
│   ├── components/
│   │   ├── project/            # MaskCanvas, LocaleSelector, VariantViewer
│   │   └── ui/                 # shadcn/ui components
│   └── server/
│       ├── api/routers/        # tRPC endpoints (project, variant, image)
│       ├── domain/             # Entities, value objects, services
│       ├── infrastructure/     # Prisma repository implementations
│       └── services/           # OpenAI, FileStore, Diff, Heatmap, Export
├── prisma/
│   └── schema.prisma           # Project, Mask, Variant models
├── docs/
│   ├── demo-assets/            # Base image, mask, expected outputs
│   └── screenshots/            # README gallery images
└── .local-data/                # Runtime storage (gitignored)
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| API | tRPC v11 |
| Database | Prisma + SQLite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Image Processing | Sharp |
| AI | OpenAI gpt-image-1.5 |

---

## Architecture Decisions

- **Local-first:** SQLite database, file-based asset storage. No external services required beyond OpenAI.
- **Clean Architecture:** Domain layer is framework-agnostic. Repositories use interface segregation.
- **Thin routers:** tRPC handlers delegate to domain services. Business logic is testable in isolation.
- **Model fallback:** If `gpt-image-1.5` fails, automatically retries with `gpt-image-1`.
- **Demo Mode:** Pre-generated outputs enable full UX without API access—critical for contest judging.

See [Engineering Decisions](docs/ENGINEERING_DECISIONS.md) for detailed rationale.

---

## Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm typecheck    # TypeScript validation
pnpm db:push      # Sync Prisma schema to SQLite
pnpm demo:seed    # Copy demo assets for offline demo
```

---

## Security

- API keys are server-side only (never bundled to client)
- No credentials committed to repository
- All data stored locally on your machine
- `.env` is gitignored; `.env.example` is safe to commit

---

## Documentation

- [Contest Spec](docs/CONTEST_SPEC.md) — Requirements and objectives
- [Sprint Plan](docs/SPRINTS.md) — Development roadmap
- [Demo Script](docs/DEMO_SCRIPT.md) — Step-by-step reproduction guide
- [Engineering Decisions](docs/ENGINEERING_DECISIONS.md) — Technical rationale

---

## License

MIT

---

**LocaleLens** — OpenAI Image Generation API Contest Entry
