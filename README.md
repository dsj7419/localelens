# LocaleLens

> AI-Powered Marketing Localization Tool

LocaleLens is a local-first workflow tool that takes a base marketing visual, lets you mark text regions with a mask, then generates **layout-safe localized variants** using OpenAI's Image Gen API—while automatically measuring visual drift.

Built for the OpenAI Image Gen API Contest

---

## Current Status

| Sprint | Status | Description |
|--------|--------|-------------|
| Sprint 0 | Complete | Foundation + OpenAI service |
| Sprint 1 | Complete | Mask editor + variant generation |
| Sprint 2 | Pending | Drift Inspector + RTL polish |
| Sprint 3 | Pending | README gallery + submission polish |

---

## Quick Start

```bash
# Clone and install
git clone <repo-url>
cd localelens
pnpm install

# Configure environment
cp .env.example .env
# Add your OPENAI_API_KEY to .env

# Initialize database
pnpm db:push

# Start development server
pnpm dev
```

Open <http://localhost:3000>

---

## Demo Flow (< 2 minutes)

1. Click **"Load Demo Project"** on homepage
2. Go to **"3. Generate"** tab
3. Select locales: es-MX, fr-CA, ar
4. Click **"Generate Variants"**
5. View results in **"4. Results"** tab

---

## Features

### Sprint 1 (Current)

- Project create/upload workflow
- Canvas-based mask editor (brush, eraser, rectangle tools)
- Locale selection: Spanish (Mexico), French (Canada), Arabic (RTL)
- Variant generation with model fallback (gpt-image-1.5 → gpt-image-1)
- Side-by-side comparison viewer
- Per-locale download

### Sprint 2 (Upcoming)

- Drift Inspector with pixel-level diff
- RTL text rendering validation
- Export ZIP + montage generation
- Regeneration controls

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **API:** tRPC for type-safe server calls
- **Database:** Prisma + SQLite (local-first)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **AI:** OpenAI Image Gen API (gpt-image-1.5)

---

## Architecture

```text
src/server/
├── domain/                    # Clean architecture
│   ├── entities/              # Type definitions
│   ├── repositories/          # Interfaces (ISP)
│   ├── services/              # Domain services
│   └── value-objects/         # Locale, Drift
├── infrastructure/            # Prisma implementations
└── services/                  # OpenAI, FileStore
```

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (defaults shown)
IMAGE_MODEL=gpt-image-1.5
IMAGE_MODEL_FALLBACK=gpt-image-1
DATABASE_URL=file:./db.sqlite
```

---

## Documentation

- [Contest Spec](docs/CONTEST_SPEC.md) - Project requirements
- [Sprint Plan](docs/SPRINTS.md) - Execution roadmap
- [Demo Script](docs/DEMO_SCRIPT.md) - Reproducible demo steps
- [Engineering Decisions](docs/ENGINEERING_DECISIONS.md) - Technical choices

---

## Security

- API keys are **server-side only** (never in client bundle)
- No credentials committed to repo
- Local-first: all data stays on your machine

---

## License

MIT

---

LocaleLens - Built for the OpenAI Image Gen API Contest
