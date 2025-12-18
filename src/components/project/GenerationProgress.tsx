/**
 * GenerationProgress Component
 *
 * Displays detailed progress during variant generation.
 * Shows per-locale status with animations and estimated time.
 * Single responsibility: Generation progress visualization.
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import { Check, Clock, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
import {
  LOCALE_REGISTRY,
  type LocaleId,
} from "~/server/domain/value-objects/locale";
import { cn } from "~/lib/utils";

export type LocaleGenerationStatus = "pending" | "generating" | "complete" | "failed";

export interface LocaleProgress {
  locale: LocaleId;
  status: LocaleGenerationStatus;
  startedAt?: number;
  completedAt?: number;
}

interface GenerationProgressProps {
  locales: LocaleId[];
  isGenerating: boolean;
  isDemoMode: boolean;
  /** Called when the estimated current locale changes (for parent tracking) */
  onCurrentLocaleChange?: (locale: LocaleId | null) => void;
}

/** Estimated time per locale in milliseconds */
const ESTIMATED_TIME_PER_LOCALE = 40000; // 40 seconds

/** Demo mode is much faster */
const DEMO_TIME_PER_LOCALE = 2000; // 2 seconds

/**
 * GenerationProgress Component
 *
 * Shows animated progress for each locale being generated.
 * Uses time-based estimation since server doesn't stream progress.
 */
export function GenerationProgress({
  locales,
  isGenerating,
  isDemoMode,
  onCurrentLocaleChange,
}: GenerationProgressProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const timePerLocale = isDemoMode ? DEMO_TIME_PER_LOCALE : ESTIMATED_TIME_PER_LOCALE;
  const totalEstimatedTime = locales.length * timePerLocale;

  // Start timer when generation begins
  useEffect(() => {
    if (isGenerating && !startTime) {
      setStartTime(Date.now());
      setElapsedTime(0);
      setCompletedCount(0);
    } else if (!isGenerating) {
      setStartTime(null);
      // When generation completes, mark all as done
      if (elapsedTime > 0) {
        setCompletedCount(locales.length);
      }
    }
  }, [isGenerating, startTime, elapsedTime, locales.length]);

  // Update elapsed time every 100ms during generation
  useEffect(() => {
    if (!isGenerating || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Estimate how many locales are complete based on elapsed time
      const estimatedComplete = Math.min(
        Math.floor(elapsed / timePerLocale),
        locales.length - 1 // Never show all complete until actually done
      );
      setCompletedCount(estimatedComplete);
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating, startTime, timePerLocale, locales.length]);

  // Calculate current generating locale
  const currentLocaleIndex = useMemo(() => {
    if (!isGenerating) return -1;
    return Math.min(completedCount, locales.length - 1);
  }, [isGenerating, completedCount, locales.length]);

  // Notify parent of current locale
  useEffect(() => {
    if (currentLocaleIndex >= 0 && currentLocaleIndex < locales.length) {
      onCurrentLocaleChange?.(locales[currentLocaleIndex]!);
    } else {
      onCurrentLocaleChange?.(null);
    }
  }, [currentLocaleIndex, locales, onCurrentLocaleChange]);

  // Get status for each locale
  const getLocaleStatus = (index: number): LocaleGenerationStatus => {
    if (!isGenerating && completedCount === locales.length) {
      return "complete";
    }
    if (!isGenerating) {
      return "pending";
    }
    if (index < completedCount) {
      return "complete";
    }
    if (index === completedCount) {
      return "generating";
    }
    return "pending";
  };

  // Calculate overall progress percentage
  const overallProgress = useMemo(() => {
    if (!isGenerating && completedCount === locales.length) {
      return 100;
    }
    if (!isGenerating || !startTime) {
      return 0;
    }
    // Smooth progress: combine completed locales + current locale progress
    const completedProgress = (completedCount / locales.length) * 100;
    const currentLocaleElapsed = elapsedTime % timePerLocale;
    const currentLocaleProgress = (currentLocaleElapsed / timePerLocale) * (100 / locales.length);
    return Math.min(completedProgress + currentLocaleProgress, 99); // Cap at 99% until done
  }, [isGenerating, startTime, completedCount, locales.length, elapsedTime, timePerLocale]);

  // Format remaining time
  const remainingTime = useMemo(() => {
    if (!isGenerating || !startTime) return null;
    const remaining = Math.max(0, totalEstimatedTime - elapsedTime);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.ceil((remaining % 60000) / 1000);
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s remaining`;
    }
    return `~${seconds}s remaining`;
  }, [isGenerating, startTime, totalEstimatedTime, elapsedTime]);

  // Don't render if not generating and nothing completed
  if (!isGenerating && completedCount === 0) {
    return null;
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {isGenerating ? (
            <>
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <span>{isDemoMode ? "Loading Demo" : "Generating Variants"}</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-green-500" />
              <span>Generation Complete</span>
            </>
          )}
        </div>
        {remainingTime && (
          <span className="text-xs text-muted-foreground">{remainingTime}</span>
        )}
      </div>

      {/* Overall Progress Bar */}
      <div className="space-y-1.5">
        <Progress value={overallProgress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {completedCount}/{locales.length} locales
          </span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
      </div>

      {/* Per-Locale Status */}
      <div className="space-y-2">
        {locales.map((locale, index) => {
          const status = getLocaleStatus(index);
          const meta = LOCALE_REGISTRY[locale];

          return (
            <LocaleStatusRow
              key={locale}
              locale={locale}
              name={meta.name}
              nativeName={meta.nativeName}
              isRtl={meta.direction === "rtl"}
              status={status}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}

interface LocaleStatusRowProps {
  locale: LocaleId;
  name: string;
  nativeName: string;
  isRtl: boolean;
  status: LocaleGenerationStatus;
  index: number;
}

function LocaleStatusRow({
  locale,
  name,
  nativeName,
  isRtl,
  status,
  index,
}: LocaleStatusRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300",
        status === "generating" && "bg-primary/10 border border-primary/30 shadow-sm",
        status === "complete" && "bg-green-500/10 border border-green-500/30",
        status === "failed" && "bg-destructive/10 border border-destructive/30",
        status === "pending" && "bg-muted/30 border border-transparent opacity-60"
      )}
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Status Icon */}
      <div className="shrink-0">
        {status === "pending" && (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
        {status === "generating" && (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        {status === "complete" && (
          <Check className="h-4 w-4 text-green-500" />
        )}
        {status === "failed" && (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
      </div>

      {/* Locale Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              status === "generating" && "text-primary",
              status === "complete" && "text-green-600 dark:text-green-400"
            )}
          >
            {name}
          </span>
          {isRtl && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              RTL
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{nativeName}</span>
      </div>

      {/* Status Badge */}
      <div className="shrink-0">
        {status === "generating" && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0 animate-pulse">
            Processing
          </Badge>
        )}
        {status === "complete" && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-green-500 text-green-600 dark:text-green-400"
          >
            Done
          </Badge>
        )}
      </div>
    </div>
  );
}
