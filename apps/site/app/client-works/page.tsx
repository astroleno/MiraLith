import type { Metadata } from "next";
import { miraLithChapterRegistry } from "../../content/miraLithChapters";
import { PostCoScrollRouteShell } from "../../components/post-coscroll/PostCoScrollRouteShell";
import {
  postCoScrollMediaResolverOptionsFromEnvironment,
  resolvePostCoScrollMediaManifest
} from "../../lib/media/resolvePostCoScrollMediaManifest.server";

const clientWorksWorkIds = ["dulwich", "li", "ugcflow"] as const;

export const metadata: Metadata = {
  title: "Client Works — MiraLith",
  description: "Client Works local preview route.",
  robots: { index: false, follow: false }
};

export default async function ClientWorksPage() {
  const chapter = miraLithChapterRegistry.find((candidate) => candidate.href === "/client-works");
  if (!chapter) throw new Error("Client Works is missing from the canonical chapter registry.");

  const resolved = await resolvePostCoScrollMediaManifest(
    postCoScrollMediaResolverOptionsFromEnvironment(process.cwd())
  );
  const mediaItems = resolved.manifest
    ? clientWorksWorkIds.flatMap((workId) =>
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
