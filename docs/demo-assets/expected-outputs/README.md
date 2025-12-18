# Expected Outputs

This directory contains pre-generated variant outputs for Demo Mode.

## Required Files

Once OpenAI API access is verified, generate variants and place them here:

```
variants/
├── es-MX.png    # Spanish (Mexico) variant - 1024x1536
├── fr-CA.png    # French (Canada) variant - 1024x1536
└── ar.png       # Arabic (RTL) variant - 1024x1536
```

## How to Generate

1. Run the app: `pnpm dev`
2. Click "Try Demo Project"
3. Navigate to Generate tab
4. Click "Generate Variants" (requires valid API key)
5. Download each variant from Results tab
6. Place files in `variants/` directory
7. Commit to repo

## File Specifications

- **Format:** PNG
- **Size:** 1024x1536 (portrait, matches OpenAI API output)
- **Source:** Generated using base image + mask from parent directory

## Demo Mode Behavior

When Demo Mode is activated, the app loads these files instead of calling the OpenAI API. This allows judges and reviewers to experience the full workflow without API access.
