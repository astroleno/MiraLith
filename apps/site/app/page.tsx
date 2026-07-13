import { LuBirthRevisedRoute } from "../components/LuBirthRevisedRoute";

interface HomePageProps {
  searchParams?: Promise<{
    visual?: string | string[];
  }>;
}

function hasForcedVisualFallback(visual: string | string[] | undefined) {
  return Array.isArray(visual) ? visual.includes("fallback") : visual === "fallback";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <LuBirthRevisedRoute
      variant="home"
      initialForcedVisualFallback={hasForcedVisualFallback(resolvedSearchParams?.visual)}
    />
  );
}
