/**
 * useResultsState Hook
 *
 * Manages results display state.
 * Single responsibility: Results viewing state management.
 */

import { useState, useCallback } from "react";
import type { LocaleId } from "~/server/domain/value-objects/locale";

export function useResultsState() {
  const [activeVariant, setActiveVariant] = useState<LocaleId | "original">("original");
  const [showOverlay, setShowOverlay] = useState(false);

  const selectVariant = useCallback((variant: LocaleId | "original") => {
    setActiveVariant(variant);
    setShowOverlay(false); // Reset overlay when changing variants
  }, []);

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev);
  }, []);

  const selectFirstVariant = useCallback((locales: LocaleId[]) => {
    if (locales.length > 0) {
      setActiveVariant(locales[0]!);
    }
  }, []);

  return {
    activeVariant,
    showOverlay,
    selectVariant,
    toggleOverlay,
    selectFirstVariant,
  };
}
