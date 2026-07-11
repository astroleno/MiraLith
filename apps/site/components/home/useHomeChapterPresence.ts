"use client";

import { useEffect, useState, type RefObject } from "react";
import type { HomeChapterPresence } from "./homeChapterTypes";

export function useHomeChapterPresence(
  rootRef: RefObject<HTMLElement | null>,
  enabled = true
): HomeChapterPresence {
  const [presence, setPresence] = useState<HomeChapterPresence>({ near: false, active: false });

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || typeof IntersectionObserver === "undefined") {
      return;
    }

    const updatePresence = (patch: Partial<HomeChapterPresence>) => {
      setPresence((current) => {
        const next = { ...current, ...patch };
        return next.near === current.near && next.active === current.active ? current : next;
      });
    };
    const nearObserver = new IntersectionObserver(
      ([entry]) => updatePresence({ near: entry?.isIntersecting ?? false }),
      { rootMargin: "150% 0px 150% 0px", threshold: 0 }
    );
    const activeObserver = new IntersectionObserver(
      ([entry]) => updatePresence({ active: entry?.isIntersecting ?? false }),
      { rootMargin: "-25% 0px -25% 0px", threshold: 0.01 }
    );
    nearObserver.observe(root);
    activeObserver.observe(root);

    return () => {
      nearObserver.disconnect();
      activeObserver.disconnect();
    };
  }, [enabled, rootRef]);

  return presence;
}
