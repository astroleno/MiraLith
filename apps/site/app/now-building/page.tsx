import type { Metadata } from "next";
import { miraLithChapterRegistry } from "../../content/miraLithChapters";
import { PostCoScrollRouteShell } from "../../components/post-coscroll/PostCoScrollRouteShell";
import {
  postCoScrollMediaResolverOptionsFromEnvironment,
  resolvePostCoScrollMediaManifest
} from "../../lib/media/resolvePostCoScrollMediaManifest.server";

const nowBuildingWorkIds = ["li", "ugcflow"] as const;

export const metadata: Metadata = {
  title: "Now Building — MiraLith",
  description: "Now Building local preview route.",
  robots: { index: false, follow: false }
};

export default async function NowBuildingPage() {
  const chapter = miraLithChapterRegistry.find((candidate) => candidate.href === "/now-building");
  if (!chapter) throw new Error("Now Building is missing from the canonical chapter registry.");

  const resolved = await resolvePostCoScrollMediaManifest(
    postCoScrollMediaResolverOptionsFromEnvironment(process.cwd())
  );
  const mediaItems = resolved.manifest
    ? nowBuildingWorkIds.flatMap((workId) =>
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
