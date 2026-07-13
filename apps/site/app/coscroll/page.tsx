import type { Metadata } from "next";
import {
  SOURCE_COSCROLL_EXCERPT_TIMELINE,
  SOURCE_COSCROLL_REVIEW_TIME,
  resolveCoScrollSourceExcerptAssets
} from "@miralith/coscroll-scene";
import { CoScrollSpikeExperience } from "../coscroll-spike/CoScrollSpikeExperience";

export const metadata: Metadata = {
  title: "CoScroll — MiraLith",
  description: "A source-matched Heart Sutra field and MiraLith's digital devotion chapter."
};

export default function CoScrollPage() {
  const timeline = SOURCE_COSCROLL_EXCERPT_TIMELINE;

  return (
    <CoScrollSpikeExperience
      sourceMatch
      staticFrame={false}
      initialProgress={SOURCE_COSCROLL_REVIEW_TIME / timeline.duration}
      timeline={timeline}
      assets={resolveCoScrollSourceExcerptAssets()}
      lyrics={timeline.lyricSegments}
      chapterNavigation
    />
  );
}
