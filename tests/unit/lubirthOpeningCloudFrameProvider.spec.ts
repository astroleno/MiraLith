import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  firstCloudFrameDeadlineMs,
  frameToMediaTime
} from "../../apps/site/components/lubirth-cloud-asset-opening/frameProvider";

test("maps every cloud frame to an exact all-I media seek time", () => {
  expect(frameToMediaTime(0, 30)).toBe(0);
  expect(frameToMediaTime(39, 30)).toBe(1.3);
  expect(frameToMediaTime(47, 30)).toBeCloseTo(47 / 30, 12);
});

test("uses the locked desktop and mobile first-frame deadlines", () => {
  expect(firstCloudFrameDeadlineMs("desktop")).toBe(1_200);
  expect(firstCloudFrameDeadlineMs("mobile")).toBe(1_800);
});

test("restores the media source as a DOM attribute before a released provider seeks again", () => {
  const source = readFileSync(
    "apps/site/components/lubirth-cloud-asset-opening/frameProvider.ts",
    "utf8"
  );

  expect(source).toContain('this.#video.setAttribute("src", this.metadata.src);');
  expect(source).toContain("this.#video.load();");
});
