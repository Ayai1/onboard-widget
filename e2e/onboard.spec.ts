import { expect, test } from "@playwright/test";

test("completes the details, capture, review, and submit path", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The fake camera launch flags are used for Chromium.",
  );
  await page.goto("/");
  await page.getByLabel("Full name").fill("Sample Person");
  await page.getByLabel("Date of birth").fill("1990-01-02");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByLabel("Email address").fill("sample@example.test");
  await page.getByRole("button", { name: "Continue" }).click();

  for (const kindLabel of ["Photograph your ID", "Take a selfie"]) {
    await page.getByRole("button", { name: "Start camera" }).click();
    const captureButton = page.getByRole("button", { name: "Capture photo" });
    await expect(captureButton).toBeEnabled({ timeout: 10_000 });
    await captureButton.click();
    await page.getByRole("button", { name: "Continue" }).click();
    if (kindLabel === "Photograph your ID") {
      await expect(
        page.getByRole("heading", { name: "Take a selfie" }),
      ).toBeVisible();
    }
  }

  await expect(
    page.getByRole("heading", { name: "Review your information" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/Submission reference:/)).toBeVisible({
    timeout: 10_000,
  });
});

test("shows the upload fallback after camera permission is denied", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "The permission override uses Chromium mediaDevices.",
  );
  await page.goto("/");
  await page.getByLabel("Full name").fill("Sample Person");
  await page.getByLabel("Date of birth").fill("1990-01-02");
  await page.getByLabel("Country").selectOption("IN");
  await page.getByLabel("Email address").fill("sample@example.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.context().clearPermissions();
  await page.locator("#widget-mount").evaluate((element) => {
    const mediaDevices = navigator.mediaDevices;
    Object.defineProperty(mediaDevices, "getUserMedia", {
      configurable: true,
      value: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        ),
    });
    element.setAttribute("data-permissions-cleared", "true");
  });
  await page.getByRole("button", { name: "Start camera" }).click();
  await expect(page.getByText(/Camera permission was denied/)).toBeVisible();
  await expect(page.getByLabel("Upload a photo instead")).toBeVisible();
});

test("sets Arabic language and right-to-left layout", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Language").selectOption("ar");
  await expect(page.getByLabel("الاسم الكامل")).toBeVisible();
  const direction = await page
    .locator("#widget-mount")
    .evaluate((element) =>
      element.shadowRoot?.querySelector(".ow-root")?.getAttribute("dir"),
    );
  expect(direction).toBe("rtl");
});

test("keeps the demo usable at 320 pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.getByLabel("Full name")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
  await page.getByLabel("Full name").focus();
  await expect(page.getByLabel("Full name")).toBeFocused();
});
