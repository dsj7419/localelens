# LocaleLens — Engineering Decisions Log

> This document records key engineering decisions and assumptions made during implementation that were not explicitly defined in the spec.

---

## Sprint 0 Decisions

### ED-001: Image Model Default

**Decision:** Default to `gpt-image-1.5` with `gpt-image-1` as fallback

**Rationale:**

- The contest focuses on Image Gen 1.5, so we default to `gpt-image-1.5` as primary
- Fallback to `gpt-image-1` if primary model fails (API availability varies by region/account)
- Both models are configurable via environment variables (`IMAGE_MODEL`, `IMAGE_MODEL_FALLBACK`)
- Pinned edit size of `1024x1536` for portrait demo consistency

**Impact:** Demo showcases 1.5 capabilities while ensuring reliability across all accounts.

---

### ED-002: Tailwind CSS v4 + shadcn/ui

**Decision:** Use Tailwind CSS v4 with the new PostCSS plugin approach

**Rationale:**

- T3 app initialized with Tailwind v4 (latest)
- shadcn/ui has official support for Tailwind v4 as of late 2024
- Modern CSS variables approach with OKLCH color space
- Better dark mode support with `@custom-variant`

**Impact:** Modern, future-proof styling system with excellent dark mode support.

---

### ED-003: Local File Storage Structure

**Decision:** Store all project files under `.local-data/projects/{projectId}/`

**Rationale:**

- Deterministic file naming for reproducibility
- Easy to locate and verify outputs
- Single gitignore entry covers all generated content
- Structure mirrors the conceptual data model

**File Layout:**

```text
.local-data/
├── outputs/          # Test generation outputs
└── projects/
    └── {projectId}/
        ├── base.png
        ├── mask.png
        ├── variants/
        │   ├── es-MX.png
        │   ├── fr-CA.png
        │   └── ar.png
        └── exports/
            ├── montage_2x2.png
            └── localelens_{projectId}_variants.zip
```

**Impact:** Clear separation of concerns, easy debugging, consistent paths across OS.

---

### ED-004: No Authentication for v1

**Decision:** Skip authentication entirely for the contest submission

**Rationale:**

- Explicitly stated in CONTEST_SPEC as a non-goal
- Reduces judge friction (no signup/login required)
- Local-first approach means data never leaves the machine
- Security focus is on API key handling, not user auth

**Impact:** Faster setup, cleaner UX, focused scope.

---

### ED-005: Server-Side Only OpenAI Calls

**Decision:** All OpenAI API calls execute server-side via tRPC mutations

**Rationale:**

- API key never exposed to client bundle
- Follows security best practices
- tRPC provides type safety end-to-end
- Easy to add rate limiting or logging if needed

**Impact:** Secure by design, no client-side key exposure risk.

---

### ED-006: Base64 Image Transfer for UI Display

**Decision:** Return generated images as base64 data URIs to the client

**Rationale:**

- Avoids need for a separate static file serving route
- Immediate display without additional requests
- Works well for moderate-sized images (1024x1024)
- Files are also saved to disk for persistence

**Trade-offs:**

- Larger response payload
- Not suitable for very large images (would need streaming)

**Impact:** Simple, self-contained image display; files persisted for export.

---

### ED-007: Demo Asset Folder Name

**Decision:** Renamed `demo-assetrs` to `demo-assets` (typo fix)

**Rationale:** Original folder had a typo; corrected for clarity and consistency.

**Impact:** Demo script paths now match documentation.

---

## Sprint 1 Decisions

### ED-008: Mask Format and Alpha Channel

**Decision:** Use PNG with alpha channel where transparent = editable regions

**Rationale:**

- OpenAI image edit API expects mask where transparent pixels indicate areas to modify
- PNG preserves alpha channel without compression artifacts
- Canvas `destination-out` composite operation creates clean transparency
- White pixels (opaque) = preserve, Transparent pixels = edit

**Impact:** Clean mask generation that works directly with OpenAI API.

---

### ED-009: Domain Layer Architecture (SOLID/SRP)

**Decision:** Implement clean architecture with distinct layers

**Structure:**

```text
src/server/
├── domain/           # Pure business logic, no dependencies
│   ├── entities/     # Type definitions
│   ├── repositories/ # Interfaces only (ISP)
│   ├── services/     # Domain services
│   └── value-objects/# Immutable value types
├── infrastructure/   # Implementations (DIP)
│   └── repositories/ # Prisma implementations
└── services/         # Application services
```

**Rationale:**

- **S**ingle Responsibility: Each module has one job
- **O**pen/Closed: Interfaces allow extension without modification
- **L**iskov Substitution: Repository implementations interchangeable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: High-level modules depend on abstractions

**Impact:** Testable, maintainable, professional-grade architecture.

---

### ED-010: LocalePlanService with Verbatim Prompts

**Decision:** Use exact DEMO_SCRIPT prompts without modification

**Rationale:**

- Contest reproducibility requires deterministic outputs
- DEMO_SCRIPT Section 7 contains exact localized copy
- DEMO_SCRIPT Section 9 contains exact prompt template
- Any deviation could affect output quality assessment

**Implementation:**

```typescript
const BASE_PROMPT_TEMPLATE = `You are editing an existing marketing screenshot.

STRICT RULES:
- Only modify pixels inside the masked (transparent) regions.
...`
```

**Impact:** Guaranteed prompt consistency with documented demo script.

---

### ED-011: One-Click Demo Project Loader

**Decision:** Implement `loadDemoProject` mutation for instant setup

**Rationale:**

- Judges need fast path to "wow moment"
- Eliminates manual upload/mask creation steps
- Uses canonical assets from `docs/demo-assets/`
- Creates project with base image + mask pre-loaded

**Impact:** Sub-5-minute demo experience for judges.

---

### ED-012: Sequential Variant Generation

**Decision:** Generate variants sequentially, not in parallel

**Rationale:**

- Avoids OpenAI rate limiting issues
- Provides clear progress feedback
- Easier error handling per-locale
- Console logs show progress: `(1/3)`, `(2/3)`, `(3/3)`

**Trade-off:** Slower total time, but more reliable.

**Impact:** Robust generation even on rate-limited accounts.

---

## Future Decisions (Pending)

- **ED-013:** Drift calculation algorithm and thresholds (Sprint 2)
- **ED-014:** Montage layout and sizing (Sprint 2)
- **ED-015:** Export ZIP structure (Sprint 2)

---

## How to Add Decisions

When making a decision not covered by the spec:

1. Add an entry with a unique ID (ED-XXX)
2. State the decision clearly
3. Explain the rationale
4. Note any trade-offs or impacts
5. Update this document in the same commit as the implementation
