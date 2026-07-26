import { expect, test } from "@playwright/test";
import {
  getNextAccessibleMiraLithChapter,
  miraLithChapterRegistry,
  publishedMiraLithChapters,
  resolveMiraLithChapterAccess
} from "../../apps/site/content/miraLithChapters";

test("defines all seven chapters in canonical order while deriving the public rail", () => {
  expect(miraLithChapterRegistry.map((chapter) => [chapter.index, chapter.availability, chapter.href])).toEqual([
    ["01", "published", "/"],
    ["02", "published", "/radio-gaga"],
    ["03", "published", "/coscroll"],
    ["04", "preview", "/artbreeze"],
    ["05", "preview", "/constellation"],
    ["06", "preview", "/client-works"],
    ["07", "preview", "/now-building"]
  ]);
  expect(publishedMiraLithChapters.map((chapter) => chapter.index)).toEqual(["01", "02", "03"]);
});

test("resolves public, preview, and unknown chapter access without browser state", () => {
  expect(resolveMiraLithChapterAccess("/coscroll", { previewActive: false })).toMatchObject({
    chapter: { index: "03", availability: "published" },
    level: "published",
    directEntryAllowed: true,
    coordinatorAllowed: true,
    visibleInNavigation: true,
    preloadAllowed: true
  });
  expect(resolveMiraLithChapterAccess("/artbreeze", { previewActive: false })).toMatchObject({
    chapter: { index: "04", availability: "preview" },
    level: "known",
    directEntryAllowed: true,
    coordinatorAllowed: false,
    visibleInNavigation: false,
    preloadAllowed: false
  });
  expect(resolveMiraLithChapterAccess("/artbreeze", { previewActive: true })).toMatchObject({
    chapter: { index: "04", availability: "preview" },
    level: "preview",
    directEntryAllowed: true,
    coordinatorAllowed: true,
    visibleInNavigation: true,
    preloadAllowed: true
  });
  expect(resolveMiraLithChapterAccess("/not-a-chapter", { previewActive: true })).toMatchObject({
    chapter: null,
    level: "unknown",
    directEntryAllowed: false,
    coordinatorAllowed: false,
    visibleInNavigation: false,
    preloadAllowed: false
  });
});

test("returns only the immediately following accessible canonical chapter", () => {
  expect(getNextAccessibleMiraLithChapter("/coscroll", { previewActive: false })).toBeUndefined();
  expect(getNextAccessibleMiraLithChapter("/coscroll", { previewActive: true })).toMatchObject({
    index: "04",
    href: "/artbreeze",
    availability: "preview"
  });
  expect(getNextAccessibleMiraLithChapter("/artbreeze", { previewActive: false })).toBeUndefined();
  expect(getNextAccessibleMiraLithChapter("/artbreeze", { previewActive: true })).toMatchObject({
    index: "05",
    href: "/constellation",
    availability: "preview"
  });
});
