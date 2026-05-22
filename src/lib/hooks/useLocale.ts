"use client";
import { useDojo } from "./useDojo";
import { getT, type Translations } from "@/lib/i18n";

export function useLocale(): { locale: string; t: Translations } {
  const dojo   = useDojo();
  const locale = dojo?.locale ?? "es";
  return { locale, t: getT(locale) };
}
