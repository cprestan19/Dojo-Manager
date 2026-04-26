import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

export const CACHE_TAGS = {
  katas:  (dojoId: string) => `katas-${dojoId}`,
  dojo:   (dojoId: string) => `dojo-${dojoId}`,
} as const;

export const getCachedKatas = (dojoId: string) =>
  unstable_cache(
    () =>
      prisma.kata.findMany({
        where:   { dojoId, active: true },
        select:  { id: true, name: true, beltColor: true, order: true, description: true },
        orderBy: { order: "asc" },
      }),
    [`katas-${dojoId}`],
    { revalidate: 600, tags: [CACHE_TAGS.katas(dojoId)] }
  )();

export const getCachedDojoMeta = (dojoId: string) =>
  unstable_cache(
    () =>
      prisma.dojo.findUnique({
        where:  { id: dojoId },
        select: {
          id: true, name: true, slug: true, email: true,
          phone: true, slogan: true, ownerName: true,
          reminderToleranceDays: true,
          lateInterestPct:       true,
          autoRemindersEnabled:  true,
        },
      }),
    [`dojo-meta-${dojoId}`],
    { revalidate: 300, tags: [CACHE_TAGS.dojo(dojoId)] }
  )();
