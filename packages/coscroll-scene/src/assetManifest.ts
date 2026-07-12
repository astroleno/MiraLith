import type { CoScrollAnchorId, CoScrollAssetManifest } from "./types";

const anchorModels = {
  "心": "/assets/coscroll/anchors/xin.glb",
  "空": "/assets/coscroll/anchors/kong.glb",
  "道": "/assets/coscroll/anchors/dao.glb"
} satisfies Partial<Record<CoScrollAnchorId, string>>;

const anchorLabels = {
  "心": "心",
  "空": "空",
  "道": "道"
} satisfies Partial<Record<CoScrollAnchorId, string>>;

const sourceAnchorModels = {
  "观": "/assets/coscroll/source-models/101_观.obj",
  "空": "/assets/coscroll/source-models/001_空.obj",
  "苦": "/assets/coscroll/source-models/045_苦.obj",
  "色": "/assets/coscroll/source-models/094_色.obj",
  "法": "/assets/coscroll/source-models/022_法.obj",
  "生": "/assets/coscroll/source-models/019_生.obj",
  "无": "/assets/coscroll/source-models/012_无.obj",
  "死": "/assets/coscroll/source-models/020_死.obj",
  "道": "/assets/coscroll/source-models/003_道.obj",
  "心": "/assets/coscroll/source-models/002_心.obj",
  "悟": "/assets/coscroll/source-models/008_悟.obj",
  "明": "/assets/coscroll/source-models/007_明.obj",
  "真": "/assets/coscroll/source-models/009_真.obj",
  "圆": "/assets/coscroll/source-models/001_空.obj"
} satisfies Record<CoScrollAnchorId, string>;

const sourceAnchorLabels = Object.fromEntries(
  Object.keys(sourceAnchorModels).map((id) => [id, id])
) as Record<CoScrollAnchorId, string>;

export const DEFAULT_COSCROLL_ASSETS: CoScrollAssetManifest = {
  anchors: Object.entries(anchorModels).map(([id, modelSrc]) => ({
    id: id as CoScrollAnchorId,
    label: anchorLabels[id as keyof typeof anchorLabels] ?? id,
    modelSrc,
    posterSrc: id === "心" ? "/assets/coscroll/posters/coscroll-poster.webp" : undefined,
    materialPreset: "jade-dark",
    bytesBudget: 350_000
  })),
  fallback: {
    posterSrc: "/assets/coscroll/posters/coscroll-poster.webp",
    posterBytesBudget: 180_000
  }
};

export const SOURCE_COSCROLL_ASSETS: CoScrollAssetManifest = {
  anchors: Object.entries(sourceAnchorModels).map(([id, modelSrc]) => ({
    id: id as CoScrollAnchorId,
    label: sourceAnchorLabels[id as CoScrollAnchorId],
    modelSrc,
    posterSrc: id === "观" ? "/assets/coscroll/posters/coscroll-poster.webp" : undefined,
    materialPreset: "jade-blue",
    bytesBudget: 1_800_000
  })),
  fallback: DEFAULT_COSCROLL_ASSETS.fallback
};

export const SOURCE_COSCROLL_EXCERPT_ASSETS: CoScrollAssetManifest = {
  anchors: SOURCE_COSCROLL_ASSETS.anchors.filter((anchor) => anchor.id === "观" || anchor.id === "空"),
  fallback: SOURCE_COSCROLL_ASSETS.fallback
};

export function resolveCoScrollAssets(assets: Partial<CoScrollAssetManifest> = {}): CoScrollAssetManifest {
  return {
    anchors: assets.anchors ?? DEFAULT_COSCROLL_ASSETS.anchors,
    fallback: {
      ...DEFAULT_COSCROLL_ASSETS.fallback,
      ...assets.fallback
    }
  };
}

export function resolveCoScrollSourceAssets(assets: Partial<CoScrollAssetManifest> = {}): CoScrollAssetManifest {
  return {
    anchors: assets.anchors ?? SOURCE_COSCROLL_ASSETS.anchors,
    fallback: {
      ...SOURCE_COSCROLL_ASSETS.fallback,
      ...assets.fallback
    }
  };
}

export function resolveCoScrollSourceExcerptAssets(assets: Partial<CoScrollAssetManifest> = {}): CoScrollAssetManifest {
  return {
    anchors: assets.anchors ?? SOURCE_COSCROLL_EXCERPT_ASSETS.anchors,
    fallback: {
      ...SOURCE_COSCROLL_EXCERPT_ASSETS.fallback,
      ...assets.fallback
    }
  };
}
