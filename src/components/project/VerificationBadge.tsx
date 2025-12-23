"use client";

import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { CheckCircle, AlertCircle, XCircle, HelpCircle } from "lucide-react";
import type { VerificationStatus } from "~/server/domain/entities/project";

interface VerificationBadgeProps {
  accuracy: number | null;
  status: VerificationStatus | null;
  compact?: boolean;
}

/**
 * Get badge variant based on verification status
 */
function getBadgeVariant(
  status: VerificationStatus | null
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pass":
      return "default";
    case "warn":
      return "secondary";
    case "fail":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Get icon for verification status
 */
function getStatusIcon(status: VerificationStatus | null) {
  switch (status) {
    case "pass":
      return <CheckCircle className="h-3 w-3" />;
    case "warn":
      return <AlertCircle className="h-3 w-3" />;
    case "fail":
      return <XCircle className="h-3 w-3" />;
    default:
      return <HelpCircle className="h-3 w-3" />;
  }
}

/**
 * Get status label for tooltip
 */
function getStatusLabel(status: VerificationStatus | null): string {
  switch (status) {
    case "pass":
      return "Translations verified correctly";
    case "warn":
      return "Some translations may have issues";
    case "fail":
      return "Translation verification failed";
    default:
      return "Not verified";
  }
}

/**
 * VerificationBadge Component
 *
 * Displays translation accuracy with color coding.
 * Shows percentage and status icon with tooltip.
 *
 * @param accuracy - The accuracy percentage (0-100)
 * @param status - The verification status ("pass" | "warn" | "fail")
 * @param compact - If true, shows only icon and percentage
 */
export function VerificationBadge({
  accuracy,
  status,
  compact = false,
}: VerificationBadgeProps) {
  // Not verified yet
  if (accuracy === null || status === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="text-[10px] px-1.5 gap-1">
              <HelpCircle className="h-3 w-3" />
              {!compact && "Not Verified"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Translation accuracy not yet verified</p>
            <p className="text-xs text-muted-foreground">
              Click Verify to check translations
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const variant = getBadgeVariant(status);
  const icon = getStatusIcon(status);
  const label = getStatusLabel(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="text-[10px] px-1.5 gap-1">
            {icon}
            {accuracy.toFixed(0)}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
          <p className="text-xs text-muted-foreground">
            Translation Accuracy: {accuracy.toFixed(1)}%
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
