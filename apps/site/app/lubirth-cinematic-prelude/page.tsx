import {
  LuBirthCinematicPreludeRoute,
  type CinematicPreludeRouteSearchParams
} from "../../components/LuBirthCinematicPreludeRoute";

export const metadata = {
  title: "LuBirth Cinematic Prelude | MiraLith",
  description: "A query-only validation route for the normalized LuBirth cinematic prelude."
};

export default async function LuBirthCinematicPreludePage({
  searchParams
}: {
  searchParams?: Promise<CinematicPreludeRouteSearchParams>;
}) {
  return (
    <LuBirthCinematicPreludeRoute initialSearchParams={(await searchParams) ?? {}} />
  );
}
