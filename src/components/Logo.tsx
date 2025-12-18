import { Globe } from "lucide-react";
import { cn } from "~/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: {
    container: "h-7 w-7",
    icon: "h-4 w-4",
    text: "text-base",
  },
  md: {
    container: "h-9 w-9",
    icon: "h-5 w-5",
    text: "text-lg",
  },
  lg: {
    container: "h-12 w-12",
    icon: "h-7 w-7",
    text: "text-xl",
  },
};

/**
 * LocaleLens Logo Component
 *
 * Displays the brand logo with optional text.
 * Single Responsibility: Brand identity rendering.
 */
export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm",
          config.container
        )}
      >
        <Globe className={cn("text-white", config.icon)} strokeWidth={2} />
      </div>
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-tight text-foreground",
            config.text
          )}
        >
          LocaleLens
        </span>
      )}
    </div>
  );
}
