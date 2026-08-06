import type { Metadata } from "next";
import { miraLithChapterRegistry } from "../../content/miraLithChapters";
import { PostCoScrollRouteShell } from "../../components/post-coscroll/PostCoScrollRouteShell";
import {
  postCoScrollMediaResolverOptionsFromEnvironment,
  resolvePostCoScrollMediaManifest
} from "../../lib/media/resolvePostCoScrollMediaManifest.server";

const constellationWorkIds = ["aescape", "focuence", "sonoscope", "sadine", "cosmic-threshold"] as const;

export const metadata: Metadata = {
  title: "Floating Constellation — MiraLith",
  description: "Floating Constellation local preview route.",
  robots: { index: false, follow: false }
};

export default async function ConstellationPage() {
  const chapter = miraLithChapterRegistry.find((candidate) => candidate.href === "/constellation");
  if (!chapter) throw new Error("Floating Constellation is missing from the canonical chapter registry.");

  const resolved = await resolvePostCoScrollMediaManifest(
    postCoScrollMediaResolverOptionsFromEnvironment(process.cwd())
  );
  const mediaItems = resolved.manifest
    ? constellationWorkIds.flatMap((workId) =>
        Object.values(resolved.manifest.items).filter((item) => item.workId === workId)
      )
    : [];

  return (
    <PostCoScrollRouteShell
      chapter={chapter}
      resolverStatus={resolved.status}
      diagnostics={resolved.diagnostics}
      mediaItems={mediaItems}
    />
  );
}
