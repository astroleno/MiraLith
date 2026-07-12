import {
  DEFAULT_COSCROLL_TIMELINE,
  SOURCE_COSCROLL_EXCERPT_TIMELINE,
  SOURCE_COSCROLL_REVIEW_TIME,
  resolveCoScrollAssets,
  resolveCoScrollSourceExcerptAssets
} from "@miralith/coscroll-scene";
import { CoScrollSpikeExperience } from "./CoScrollSpikeExperience";

type CoScrollSpikeSearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CoScrollSpikePage({
  searchParams
}: {
  searchParams?: CoScrollSpikeSearchParams | Promise<CoScrollSpikeSearchParams>;
}) {
  const params = await searchParams;
  const sourceMatch = firstSearchParam(params?.sourceMatch) === "1";
  const staticFrame = firstSearchParam(params?.visualTest) === "pixels";
  const activeTimeline = sourceMatch ? SOURCE_COSCROLL_EXCERPT_TIMELINE : DEFAULT_COSCROLL_TIMELINE;
  const activeAssets = sourceMatch ? resolveCoScrollSourceExcerptAssets() : resolveCoScrollAssets();
  const reviewProgress = sourceMatch ? SOURCE_COSCROLL_REVIEW_TIME / activeTimeline.duration : 0.42;
  const lyrics = activeTimeline.lyricSegments;

  return (
    <CoScrollSpikeExperience
      sourceMatch={sourceMatch}
      staticFrame={staticFrame}
      initialProgress={reviewProgress}
      timeline={activeTimeline}
      assets={activeAssets}
      lyrics={lyrics}
    />
  );
}
