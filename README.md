# Onboard Widget

Onboard Widget is a config-driven identity onboarding flow that can be mounted in an existing page. It collects details, captures ID and selfie images through a browser camera or image upload, presents a review step, and submits the flow to the local FastAPI service.

The demo uses synthetic values. Its selfie step captures a photo and displays basic lighting and blur hints. The server's default `ImageCheck` returns `not_run`.

## Repository layout

| Path                       | Contents                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `packages/widget`          | React 18 and TypeScript widget, config schema, camera flow, SDK and custom element |
| `apps/demo`                | Vite host app with live theme and locale selection and the funnel page             |
| `server`                   | FastAPI API, SQLite metadata, local upload storage, seed script and pytest suite   |
| `e2e`                      | Playwright browser scenarios                                                       |
| `scripts`                  | Built bundle gzip size check                                                       |
| `.github/workflows/ci.yml` | GitHub Actions lint, typecheck, unit, API, browser and build jobs                  |

## Quickstart

Requirements: Node.js 22.12 or newer, npm, and Python 3.11 or newer.

Install JavaScript and Python dependencies from the repository root:

```sh
npm ci
python -m pip install -r server/requirements.txt
```

Start the API in one terminal:

```sh
npm run server:dev
```

Start the demo in another terminal. The root `dev` script builds the widget package before starting Vite:

```sh
npm run dev
```

Open `http://127.0.0.1:4173`. The API listens on `http://127.0.0.1:8000`.

The demo displays **Demo only - do not upload real documents**. Use synthetic values and synthetic images.

## Embedding

### Script tag

The UMD file is a single widget file and uses the React 18 browser globals. Load React, ReactDOM, then the widget bundle:

```html
<div id="onboard"></div>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="/assets/onboard-widget.umd.js"></script>
<script>
  const config = {
    steps: ["details", "id_capture", "selfie", "review"],
    theme: {
      primaryColor: "#2459d3",
      backgroundColor: "#ffffff",
      textColor: "#172033",
      radius: "16px",
      fontFamily: "system-ui, sans-serif",
    },
    locale: "en",
    api: { baseUrl: "https://api.example.test", publicKey: "public-demo-key" },
    camera: {
      idMaxDimension: 1600,
      selfieMaxDimension: 1200,
      jpegQuality: 0.82,
    },
    analytics: { enabled: true },
  };
  const widget = OnboardWidget.init({
    container: document.getElementById("onboard"),
    config,
    onComplete: (result) => console.log(result.reference),
    onError: (error) => console.error(error),
  });
</script>
```

### ESM import

```ts
import { init, type WidgetConfig } from "@onboard/widget";

const config: WidgetConfig = {
  steps: ["details", "id_capture", "selfie", "review"],
  theme: {
    primaryColor: "#2459d3",
    backgroundColor: "#ffffff",
    textColor: "#172033",
    radius: "16px",
    fontFamily: "system-ui, sans-serif",
  },
  locale: "en",
  api: { baseUrl: "https://api.example.test", publicKey: "public-demo-key" },
  camera: { idMaxDimension: 1600, selfieMaxDimension: 1200, jpegQuality: 0.82 },
  analytics: { enabled: true },
};

const widget = init({
  container: document.querySelector<HTMLElement>("#onboard")!,
  config,
  onComplete: (result) => console.log(result.reference),
  onError: (error) => console.error(error),
  onEvent: (event) => console.log(event.type, event.step),
});

widget.updateConfig({ locale: "ar" });
// Call widget.destroy() when the host removes the mount.
```

The ESM build keeps the camera step in a lazy chunk. The single-file UMD build includes the camera module because that output has no additional JavaScript chunks.

### Custom element

```html
<onboard-widget id="onboard"></onboard-widget>
<script type="module">
  import "@onboard/widget";
  const element = document.querySelector("#onboard");
  element.setAttribute("config", JSON.stringify(config));
  element.addEventListener("onboard:complete", (event) => {
    console.log(event.detail.reference);
  });
  element.addEventListener("onboard:error", (event) =>
    console.error(event.detail),
  );
  element.addEventListener("onboard:event", (event) =>
    console.log(event.detail.type),
  );
</script>
```

The custom element reads JSON from its `config` attribute. It dispatches bubbling, composed `CustomEvent`s named `onboard:complete`, `onboard:error`, and `onboard:event`.

Both mounting APIs render in an open Shadow DOM and inject the widget CSS inside that root.

## Configuration reference

Every field other than `theme.logoUrl` and `strings` is required. Unknown keys, invalid values, duplicate step IDs, and a non-final review step produce a `ConfigError` with a `problems` array.

| Field                       | Type                                                    | Rules                                                              |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `steps`                     | `("details" \| "id_capture" \| "selfie" \| "review")[]` | At least one unique step; any order; `review`, if present, is last |
| `theme.primaryColor`        | `string`                                                | CSS color value                                                    |
| `theme.backgroundColor`     | `string`                                                | CSS color value                                                    |
| `theme.textColor`           | `string`                                                | CSS color value                                                    |
| `theme.radius`              | `string`                                                | CSS border radius value                                            |
| `theme.fontFamily`          | `string`                                                | CSS font family value                                              |
| `theme.logoUrl`             | `string?`                                               | Optional absolute URL, displayed as a decorative logo              |
| `locale`                    | `"en" \| "ar"`                                          | Base locale; Arabic sets `dir="rtl"`                               |
| `strings`                   | `Record<string, string>?`                               | Optional message overrides keyed by message name                   |
| `api.baseUrl`               | `string`                                                | Absolute API URL                                                   |
| `api.publicKey`             | `string`                                                | Sent as `X-Public-Key` on widget API requests                      |
| `camera.idMaxDimension`     | `number`                                                | Positive integer maximum image edge for ID photos                  |
| `camera.selfieMaxDimension` | `number`                                                | Positive integer maximum image edge for selfies                    |
| `camera.jpegQuality`        | `number`                                                | JPEG encoder quality from `0` to `1`                               |
| `analytics.enabled`         | `boolean`                                               | Enables sending queued events to `POST /events`                    |

Example locale overrides:

```ts
{ locale: "en", strings: { continue: "Next step", title: "Details" } }
```

## Events

Each event contains `type`, `sessionId`, `step`, ISO `timestamp`, `locale`, and a coarse `deviceClass` (`ios`, `android`, or `desktop`). Some event types include a non-personal `reason` code. Events do not contain form values or image data. `onEvent` receives events even when network analytics are disabled.

| Event                      | When it is emitted                                             | Optional field                |
| -------------------------- | -------------------------------------------------------------- | ----------------------------- |
| `step_viewed`              | A configured step becomes current                              | —                             |
| `step_completed`           | Details or a capture step is completed, or submission succeeds | —                             |
| `step_failed`              | Step validation, required data, or submission fails            | `reason`                      |
| `camera_permission_denied` | The browser rejects camera permission                          | `reason: "permission_denied"` |
| `upload_fallback_used`     | A file is selected as the camera fallback                      | —                             |
| `submit_started`           | The widget starts session submission                           | —                             |
| `submit_succeeded`         | The API returns a reference                                    | —                             |
| `submit_failed`            | A submission request fails                                     | `reason`                      |

The widget batches events in groups of eight and attempts `navigator.sendBeacon`; if that call is unavailable or returns false, it sends a `fetch` request with `keepalive: true`.

## API endpoints

| Method and path                 | Request                                                     | Response                             |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `GET /health`                   | —                                                           | `{ "status": "ok" }`                 |
| `POST /sessions`                | Empty body                                                  | `{ "sessionId": "…" }`               |
| `POST /sessions/{id}/documents` | Multipart fields `kind` (`id_front` or `selfie`) and `file` | Document ID, kind, and byte size     |
| `POST /sessions/{id}/submit`    | JSON: `fullName`, `dateOfBirth`, `country`, `email`         | `{ "reference": "ONB-…" }`           |
| `POST /events`                  | `{ "events": [...] }`, up to 100 events                     | `{ "accepted": number }`             |
| `GET /funnel`                   | —                                                           | Step counts and drop-off percentages |

Document uploads accept JPEG or PNG content with matching magic bytes. The default maximum file size is 5 MiB. Structured errors use an `error` object with `code` and `message` fields.

Server settings are read from environment variables: `CORS_ORIGINS`, `ONBOARD_DATABASE`, `UPLOADS_DIR`, `MAX_UPLOAD_BYTES`, `MAX_REQUEST_BYTES`, `UPLOAD_RATE_LIMIT`, `SUBMIT_RATE_LIMIT`, and `RATE_LIMIT_WINDOW_SECONDS`. The funnel can be populated with `npm run server:seed`; it inserts synthetic event data.

## Accessibility checklist

- Inputs and selectors have visible labels and associated inline errors.
- Invalid fields expose `aria-invalid` and `aria-describedby` references.
- Error and capture hint areas use live regions.
- The step heading receives focus when navigation changes the step.
- Buttons, selectors, and file upload controls have a 44-pixel minimum target height.
- Keyboard focus has a visible outline.
- The interface sets `lang` and `dir`; Arabic uses right-to-left direction and logical CSS properties.
- Step transition animation is disabled when `prefers-reduced-motion: reduce` is active.
- The demo layout supports a 320-pixel viewport without a horizontal page overflow.

## Tests and verification

The repository includes Vitest and React Testing Library cases, pytest API cases, and Playwright scenarios for Chromium. Set `PLAYWRIGHT_WEBKIT=1` to add the WebKit project when its browser is installed.

```sh
npx playwright install chromium webkit
npm run lint
npm run typecheck
npm run test:widget
npm run test:coverage
npm run test:server
npm run test:e2e
npm run test:all
npm run build
npm run size:check
```

`BUNDLE_GZIP_BUDGET_KB` changes the gzip budget for the ESM startup graph and the single-file UMD bundle. It defaults to 80 KB. Dynamically loaded ESM camera chunks are reported and excluded from the startup budget.

## Tested environments

| Device/browser | OS  | Result | Date |
| -------------- | --- | ------ | ---- |
|                |     |        |      |

## Measured results

| Metric                          | Value |
| ------------------------------- | ----- |
| Gzip bundle size                |       |
| Lighthouse performance (mobile) |       |
| Unit test count                 |       |
| E2E test count                  |       |
| Test coverage                   |       |

## Limitations

- The demo accepts synthetic information and is not configured for real identity workflows.
- The selfie step captures an image and shows basic quality hints; it does not perform liveness detection or identity verification. The default server `ImageCheck` returns `not_run`.
- The API requires valid details plus both an ID front and selfie image at submission. A configuration that omits a required details or capture step cannot complete submission; the widget reports the missing configuration.
- Uploaded files are stored unencrypted under `server/uploads` and are not automatically deleted. The database stores document metadata and submission references; it does not store the submitted details payload.
- Rate limiting uses in-memory per-IP counters and resets when the server restarts.
- `api.publicKey` is sent by the client but is not authenticated by this demo server.
- The ESM build lazy-loads camera code. The single-file UMD build includes camera code in its main file.
- Browser camera access requires a secure context, except for browser-defined localhost origins. Camera availability and file input behavior depend on the device and browser.
- The funnel uses distinct session counts for `step_viewed` events and compares steps in the fixed order details, ID capture, selfie, review.
