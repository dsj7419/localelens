/**
 * Locale Value Object
 *
 * Represents a supported locale for localization.
 * Immutable and self-validating.
 */

/** Supported locale identifiers */
export const SUPPORTED_LOCALES = ["es-MX", "fr-CA", "ar"] as const;

export type LocaleId = (typeof SUPPORTED_LOCALES)[number];

/** Locale metadata for display and processing */
export interface LocaleMetadata {
  id: LocaleId;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  alignment: "left" | "right" | "center";
}

/** Complete locale registry */
export const LOCALE_REGISTRY: Record<LocaleId, LocaleMetadata> = {
  "es-MX": {
    id: "es-MX",
    name: "Spanish (Mexico)",
    nativeName: "Español (México)",
    direction: "ltr",
    alignment: "left",
  },
  "fr-CA": {
    id: "fr-CA",
    name: "French (Canada)",
    nativeName: "Français (Canada)",
    direction: "ltr",
    alignment: "left",
  },
  ar: {
    id: "ar",
    name: "Arabic",
    nativeName: "العربية",
    direction: "rtl",
    alignment: "right",
  },
};

/**
 * Validate and parse a locale string
 */
export function parseLocale(value: string): LocaleId | null {
  if (SUPPORTED_LOCALES.includes(value as LocaleId)) {
    return value as LocaleId;
  }
  return null;
}

/**
 * Get locale metadata
 */
export function getLocaleMetadata(locale: LocaleId): LocaleMetadata {
  return LOCALE_REGISTRY[locale];
}

/**
 * Check if locale is RTL
 */
export function isRtlLocale(locale: LocaleId): boolean {
  return LOCALE_REGISTRY[locale].direction === "rtl";
}
