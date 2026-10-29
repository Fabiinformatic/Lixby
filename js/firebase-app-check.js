import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js";

const initializedApps = new WeakMap();

export function initializeLixbyAppCheck(app) {
  if (initializedApps.has(app)) return initializedApps.get(app);

  const initialization = initializeLixbyAppCheckOnce(app);
  initializedApps.set(app, initialization);
  return initialization;
}

async function initializeLixbyAppCheckOnce(app) {
  let config;
  try {
    const response = await fetch("/js/firebase-app-check-config.json", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    config = await response.json();
  } catch {
    return null;
  }

  const siteKey =
    config && typeof config.siteKey === "string" ? config.siteKey.trim() : "";
  if (!siteKey) return null;

  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheck;
}
