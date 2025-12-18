"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  SUPPORTED_LOCALES,
  LOCALE_REGISTRY,
  type LocaleId,
} from "~/server/domain/value-objects/locale";

interface LocaleSelectorProps {
  selectedLocales: LocaleId[];
  onSelectionChange: (locales: LocaleId[]) => void;
  disabled?: boolean;
}

/**
 * LocaleSelector Component
 *
 * Multi-select for choosing target locales.
 * Displays native names and RTL indicator.
 */
export function LocaleSelector({
  selectedLocales,
  onSelectionChange,
  disabled = false,
}: LocaleSelectorProps) {
  const toggleLocale = (locale: LocaleId) => {
    if (disabled) return;

    if (selectedLocales.includes(locale)) {
      onSelectionChange(selectedLocales.filter((l) => l !== locale));
    } else {
      onSelectionChange([...selectedLocales, locale]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onSelectionChange([...SUPPORTED_LOCALES]);
  };

  const clearAll = () => {
    if (disabled) return;
    onSelectionChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Target Locales</span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={disabled || selectedLocales.length === SUPPORTED_LOCALES.length}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={disabled || selectedLocales.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUPPORTED_LOCALES.map((locale) => {
          const meta = LOCALE_REGISTRY[locale];
          const isSelected = selectedLocales.includes(locale);

          return (
            <button
              key={locale}
              onClick={() => toggleLocale(locale)}
              disabled={disabled}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:bg-accent"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className="font-medium">{meta.name}</span>
              <span className="text-muted-foreground text-sm">
                ({meta.nativeName})
              </span>
              {meta.direction === "rtl" && (
                <Badge variant="outline" className="text-xs">
                  RTL
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {selectedLocales.length === 0 && (
        <p className="text-sm text-destructive">
          Select at least one locale to generate variants
        </p>
      )}
    </div>
  );
}
