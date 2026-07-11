import { expect, test } from "@playwright/test";

test("standalone Radio Gaga is a local case study, not a live product runtime", async ({ page }) => {
  const remoteRuntimeRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:3100" ||
      /api|listenhub|publish|mcp|worker|audio/i.test(url.pathname)
    ) {
      remoteRuntimeRequests.push(request.url());
    }
  });

  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-host="standalone"]')).toBeVisible();
  await expect(page.getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })).toBeVisible();
  expect(remoteRuntimeRequests).toEqual([]);
});
