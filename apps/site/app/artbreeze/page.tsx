import type { Metadata } from "next";
import { miraLithChapterRegistry } from "../../content/miraLithChapters";
import { PostCoScrollRouteShell } from "../../components/post-coscroll/PostCoScrollRouteShell";
import {
  postCoScrollMediaResolverOptionsFromEnvironment,
  resolvePostCoScrollMediaManifest
} from "../../lib/media/resolvePostCoScrollMediaManifest.server";

export const metadata: Metadata = {
  title: "ArtBreeze — MiraLith",
  description: "ArtBreeze local preview route.",
  robots: { index: false, follow: false }
};

export default async function ArtBreezePage() {
  const chapter = miraLithChapterRegistry.find((candidate) => candidate.href === "/artbreeze");
  if (!chapter) throw new Error("ArtBreeze is missing from the canonical chapter registry.");

  const resolved = await resolvePostCoScrollMediaManifest(
    postCoScrollMediaResolverOptionsFromEnvironment(process.cwd())
  );
  const mediaItems = resolved.manifest
    ? Object.values(resolved.manifest.items).filter((item) => item.workId === "artbreeze")
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
