#!/usr/bin/env node
/**
 * Demo Check Script
 *
 * Quick validation that the repo is correctly set up for judges.
 * Run with: pnpm demo:check
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

console.log("\n🔍 LocaleLens Environment Check\n");
console.log("─".repeat(50) + "\n");

const checks = [];

// 1. Check .env exists
const envPath = path.join(ROOT, ".env");
const envExamplePath = path.join(ROOT, ".env.example");
if (fs.existsSync(envPath)) {
  checks.push({ name: ".env file", status: "✅", note: "exists" });
} else if (fs.existsSync(envExamplePath)) {
  checks.push({ name: ".env file", status: "⚠️", note: "missing - copy from .env.example" });
} else {
  checks.push({ name: ".env file", status: "❌", note: "missing" });
}

// 2. Check database
const dbPath = path.join(ROOT, "prisma", "db.sqlite");
if (fs.existsSync(dbPath)) {
  checks.push({ name: "SQLite database", status: "✅", note: "initialized" });
} else {
  checks.push({ name: "SQLite database", status: "⚠️", note: "run 'pnpm db:push'" });
}

// 3. Check node_modules
const nodeModulesPath = path.join(ROOT, "node_modules");
if (fs.existsSync(nodeModulesPath)) {
  checks.push({ name: "Dependencies", status: "✅", note: "installed" });
} else {
  checks.push({ name: "Dependencies", status: "❌", note: "run 'pnpm install'" });
}

// 4. Check Prisma client
const prismaClientPath = path.join(ROOT, "generated", "prisma");
if (fs.existsSync(prismaClientPath)) {
  checks.push({ name: "Prisma client", status: "✅", note: "generated" });
} else {
  checks.push({ name: "Prisma client", status: "⚠️", note: "run 'pnpm db:push'" });
}

// 5. Check demo assets
const baseImagePath = path.join(ROOT, "docs", "demo-assets", "base_appstore_en_1080x1920.png");
if (fs.existsSync(baseImagePath)) {
  checks.push({ name: "Demo base image", status: "✅", note: "present" });
} else {
  checks.push({ name: "Demo base image", status: "❌", note: "missing from docs/demo-assets/" });
}

const maskImagePath = path.join(ROOT, "docs", "demo-assets", "mask_text_regions_1080x1920.png");
if (fs.existsSync(maskImagePath)) {
  checks.push({ name: "Demo mask image", status: "✅", note: "present" });
} else {
  checks.push({ name: "Demo mask image", status: "❌", note: "missing from docs/demo-assets/" });
}

// Print results
for (const check of checks) {
  console.log(`${check.status} ${check.name.padEnd(20)} ${check.note}`);
}

console.log("\n" + "─".repeat(50) + "\n");

const hasErrors = checks.some((c) => c.status === "❌");
const hasWarnings = checks.some((c) => c.status === "⚠️");

if (hasErrors) {
  console.log("❌ Some checks failed. Please fix the issues above.\n");
  process.exit(1);
} else if (hasWarnings) {
  console.log("⚠️  Some optional setup steps are pending.\n");
  console.log("Quick fix:");
  console.log("  cp .env.example .env");
  console.log("  pnpm db:push\n");
} else {
  console.log("✅ All checks passed. Ready to run!\n");
  console.log("Start the app:");
  console.log("  pnpm dev\n");
}
