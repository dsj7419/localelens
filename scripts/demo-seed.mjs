#!/usr/bin/env node
/**
 * Demo Seed Script
 *
 * Verifies demo assets are in place for offline demo mode.
 * Run with: pnpm demo:seed
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DEMO_ASSETS = {
  base: "docs/demo-assets/base_appstore_en_1080x1920.png",
  mask: "docs/demo-assets/mask_text_regions_1080x1920.png",
  variants: {
    "es-MX": "docs/demo-assets/expected-outputs/variants/es-MX.png",
    "fr-CA": "docs/demo-assets/expected-outputs/variants/fr-CA.png",
    "ar": "docs/demo-assets/expected-outputs/variants/ar.png",
  },
};

console.log("\n🌐 LocaleLens Demo Seed\n");
console.log("Checking demo assets...\n");

let allPresent = true;
const missing = [];

// Check base image
const basePath = path.join(ROOT, DEMO_ASSETS.base);
if (fs.existsSync(basePath)) {
  console.log("✅ Base image:    " + DEMO_ASSETS.base);
} else {
  console.log("❌ Base image:    " + DEMO_ASSETS.base + " (MISSING)");
  allPresent = false;
  missing.push("base");
}

// Check mask
const maskPath = path.join(ROOT, DEMO_ASSETS.mask);
if (fs.existsSync(maskPath)) {
  console.log("✅ Mask image:    " + DEMO_ASSETS.mask);
} else {
  console.log("❌ Mask image:    " + DEMO_ASSETS.mask + " (MISSING)");
  allPresent = false;
  missing.push("mask");
}

// Check variant outputs
console.log("\nExpected outputs:");
for (const [locale, variantPath] of Object.entries(DEMO_ASSETS.variants)) {
  const fullPath = path.join(ROOT, variantPath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${locale}:         ${variantPath}`);
  } else {
    console.log(`⏳ ${locale}:         ${variantPath} (pending API verification)`);
    missing.push(locale);
  }
}

console.log("\n" + "─".repeat(60) + "\n");

if (missing.length === 0) {
  console.log("✅ All demo assets present. Demo Mode is fully functional.\n");
  console.log("Run the app:");
  console.log("  pnpm dev\n");
  console.log("Then click 'Try Demo Project' → 'Demo Mode' to see pre-generated outputs.\n");
} else if (missing.includes("base") || missing.includes("mask")) {
  console.log("❌ Critical demo assets missing. Please ensure docs/demo-assets/ is intact.\n");
  process.exit(1);
} else {
  console.log("⏳ Variant outputs pending (waiting for API verification).\n");
  console.log("The app will work, but Demo Mode will show placeholders until");
  console.log("real outputs are generated and committed.\n");
  console.log("Run the app:");
  console.log("  pnpm dev\n");
  console.log("Use 'Generate Variants' with your API key, or wait for Demo Mode assets.\n");
}
