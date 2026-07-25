const ASSET_KEY_PREFIX = "post-coscroll/";

export function isSafePostCoScrollAssetKey(assetKey: string): boolean {
  if (!assetKey.startsWith(ASSET_KEY_PREFIX)) return false;
  if (
    assetKey.startsWith("/") ||
    assetKey.includes("\\") ||
    assetKey.includes("?") ||
    assetKey.includes("#") ||
    assetKey.includes("\0") ||
    /^[a-z][a-z\d+.-]*:/i.test(assetKey)
  ) {
    return false;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(assetKey);
  } catch {
    return false;
  }

  if (decoded !== assetKey || decoded.includes("\\")) return false;
  const segments = assetKey.split("/");
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function normalizeTrustedBaseUrl(assetBaseUrl: string): string {
  if (assetBaseUrl.startsWith("/")) {
    if (
      assetBaseUrl.startsWith("//") ||
      assetBaseUrl.includes("\\") ||
      assetBaseUrl.includes("?") ||
      assetBaseUrl.includes("#") ||
      assetBaseUrl.split("/").some((segment) => segment === "..")
    ) {
      throw new Error("Unsafe local media base URL.");
    }
    return assetBaseUrl.endsWith("/") ? assetBaseUrl : `${assetBaseUrl}/`;
  }

  const url = new URL(assetBaseUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Remote media base URL must be a credential-free HTTPS origin/path.");
  }
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

export function resolvePostCoScrollMediaUrl(assetBaseUrl: string, assetKey: string): string {
  if (!isSafePostCoScrollAssetKey(assetKey)) {
    throw new Error(`Unsafe post-CoScroll media asset key: ${assetKey}`);
  }
  return `${normalizeTrustedBaseUrl(assetBaseUrl)}${assetKey}`;
}
