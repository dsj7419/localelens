/**
 * Drift Value Objects
 *
 * Represents drift analysis results for variant quality assessment.
 */

/** Drift status thresholds from DEMO_SCRIPT */
export const DRIFT_THRESHOLDS = {
  PASS: 2.0, // <= 2.0%
  WARN: 5.0, // 2.0% - 5.0%
  // > 5.0% = FAIL
} as const;

/** Drift status enum matching Prisma schema */
export type DriftStatus = "PENDING" | "PASS" | "WARN" | "FAIL";

/**
 * Calculate drift status from a percentage score
 */
export function calculateDriftStatus(score: number): DriftStatus {
  if (score <= DRIFT_THRESHOLDS.PASS) {
    return "PASS";
  }
  if (score <= DRIFT_THRESHOLDS.WARN) {
    return "WARN";
  }
  return "FAIL";
}

/**
 * Drift result containing score and computed status
 */
export interface DriftResult {
  score: number;
  status: DriftStatus;
  outsideMaskPixelsChanged: number;
  totalOutsideMaskPixels: number;
}

/**
 * Create a drift result from raw pixel counts
 */
export function createDriftResult(
  changedPixels: number,
  totalPixels: number
): DriftResult {
  const score = totalPixels > 0 ? (changedPixels / totalPixels) * 100 : 0;
  return {
    score,
    status: calculateDriftStatus(score),
    outsideMaskPixelsChanged: changedPixels,
    totalOutsideMaskPixels: totalPixels,
  };
}

/**
 * Get human-readable drift status description
 */
export function getDriftStatusDescription(status: DriftStatus): string {
  switch (status) {
    case "PENDING":
      return "Drift analysis pending";
    case "PASS":
      return "Low drift - excellent preservation";
    case "WARN":
      return "Moderate drift - review recommended";
    case "FAIL":
      return "High drift - regeneration recommended";
  }
}
