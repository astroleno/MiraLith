"use client";

import { useSyncExternalStore } from "react";
import {
  resolveLandingReferenceAbsorptionVariant,
  type LandingReferenceAbsorptionVariant
} from "@miralith/lubirth-hero";
import { LuBirthRevisedRoute } from "./LuBirthRevisedRoute";

interface ReferenceAbsorptionConfig {
  variant: LandingReferenceAbsorptionVariant;
}

const DEFAULT_CONFIG: ReferenceAbsorptionConfig = {
  variant: "baseline"
};

let cachedSearch = "";
let cachedConfig = DEFAULT_CONFIG;

function readConfig(): ReferenceAbsorptionConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  return {
    variant: resolveLandingReferenceAbsorptionVariant(params.get("variant"))
  };
}

function subscribeConfig() {
  return () => undefined;
}

function getConfigSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  if (window.location.search !== cachedSearch) {
    cachedSearch = window.location.search;
    cachedConfig = readConfig();
  }

  return cachedConfig;
}

export function LuBirthReferenceAbsorptionSpikeRoute() {
  const config = useSyncExternalStore(
    subscribeConfig,
    getConfigSnapshot,
    () => DEFAULT_CONFIG
  );

  return (
    <div
      className="lubirth-reference-absorption-spike"
      data-reference-absorption-variant={config.variant}
    >
      <LuBirthRevisedRoute referenceAbsorptionVariant={config.variant} />
    </div>
  );
}
