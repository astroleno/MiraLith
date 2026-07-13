import { LuBirthRevisedRoute } from "../../components/LuBirthRevisedRoute";

export const metadata = {
  title: "LuBirth Revised Study | MiraLith",
  description: "A revised LuBirth opening route for MiraLith."
};

interface LuBirthRevisedPageProps {
  searchParams?: Promise<{
    visual?: string | string[];
  }>;
}

function hasForcedVisualFallback(visual: string | string[] | undefined) {
  return Array.isArray(visual) ? visual.includes("fallback") : visual === "fallback";
}

export default async function LuBirthRevisedPage({ searchParams }: LuBirthRevisedPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <LuBirthRevisedRoute
      variant="study"
      initialForcedVisualFallback={hasForcedVisualFallback(resolvedSearchParams?.visual)}
    />
  );
}
