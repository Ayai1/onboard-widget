const sampleFunnel = {
  steps: [
    { step: "details", count: 12, dropOffPercent: 16.7 },
    { step: "id_capture", count: 10, dropOffPercent: 20 },
    { step: "selfie", count: 8, dropOffPercent: 25 },
    { step: "review", count: 6, dropOffPercent: 0 },
  ],
};

export const hostedDemoMode = import.meta.env.VITE_DEMO_API_MODE === "mock";

export function demoApiBaseUrl(): string {
  return hostedDemoMode ? window.location.origin : "http://127.0.0.1:8000";
}

export function installDemoApiMock(): void {
  if (!hostedDemoMode) return;

  const browserFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const requestUrl = new URL(
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : input,
      window.location.href,
    );
    if (requestUrl.origin !== window.location.origin) {
      return browserFetch(input, init);
    }

    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    if (method === "POST" && requestUrl.pathname === "/sessions") {
      return jsonResponse({ sessionId: `demo-${crypto.randomUUID()}` });
    }
    if (
      method === "POST" &&
      /^\/sessions\/[^/]+\/documents$/.test(requestUrl.pathname)
    ) {
      return jsonResponse({ documentId: "demo-document" });
    }
    if (
      method === "POST" &&
      /^\/sessions\/[^/]+\/submit$/.test(requestUrl.pathname)
    ) {
      return jsonResponse({ reference: `ONB-DEMO-${crypto.randomUUID()}` });
    }
    if (method === "POST" && requestUrl.pathname === "/events") {
      return jsonResponse({ accepted: 0 });
    }
    if (method === "GET" && requestUrl.pathname === "/funnel") {
      return jsonResponse(sampleFunnel);
    }

    return browserFetch(input, init);
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
