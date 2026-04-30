import { RadioGagaRoute } from "../../components/RadioGagaRoute";

interface RadioGagaPageProps {
  searchParams?: Promise<{
    visual?: string | string[];
  }>;
}

function hasForcedVisualFallback(visual: string | string[] | undefined) {
  return Array.isArray(visual) ? visual.includes("fallback") : visual === "fallback";
}

export default async function RadioGagaPage({ searchParams }: RadioGagaPageProps) {
  const resolvedSearchParams = await searchParams;

  return <RadioGagaRoute initialForcedVisualFallback={hasForcedVisualFallback(resolvedSearchParams?.visual)} />;
}
