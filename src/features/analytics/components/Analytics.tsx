"use client";

import { useEffect, useState } from "react";
import { CONSENT_KEY, parseConsent, type Consent } from "@/features/analytics/events";
import { CONSENT_SETTINGS_HASH } from "@/features/analytics/config";

// Google Tag Manager behind a consent banner. Nothing is loaded and no request goes to Google until the visitor
// accepts: Consent Mode v2 defaults are all denied, and only analytics_storage is granted on Accept (no ad storage,
// no ad personalisation). The choice stays in localStorage; the footer's "Cookie settings" (#cookie-settings) opens
// the banner again, and withdrawing reloads the page so the container is gone.
// The script is added from this bundled code, so private pages' 'strict-dynamic' CSP trusts it; shells list the host.

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  // Tag Manager reads gtag commands as `arguments` objects, not arrays.
  return function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
}

let loaded = false;
function loadContainer(id: string) {
  if (loaded) return;
  loaded = true;
  const g = gtag();
  g("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  g("consent", "update", { analytics_storage: "granted" });
  window.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

export function Analytics({ containerId }: { containerId: string }) {
  // undefined until read (no banner flash in the prerendered shell), then the stored choice or "ask".
  const [consent, setConsent] = useState<Consent | "ask" | undefined>(undefined);

  useEffect(() => {
    let stored: Consent | undefined;
    try {
      stored = parseConsent(localStorage.getItem(CONSENT_KEY));
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setConsent(stored ?? "ask");
    const reopen = () => {
      if (window.location.hash === CONSENT_SETTINGS_HASH) setConsent("ask");
    };
    reopen();
    window.addEventListener("hashchange", reopen);
    return () => window.removeEventListener("hashchange", reopen);
  }, []);

  useEffect(() => {
    if (consent === "granted") loadContainer(containerId);
  }, [consent, containerId]);

  const choose = (choice: Consent) => {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {}
    if (window.location.hash === CONSENT_SETTINGS_HASH) history.replaceState(null, "", window.location.pathname + window.location.search);
    // A loaded container can't be unloaded: withdrawing reloads the page without it.
    if (choice === "denied" && loaded) window.location.reload();
    else setConsent(choice);
  };

  if (consent !== "ask") return null;
  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-300 bg-white px-4 py-4 shadow-lg sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-md sm:rounded-md sm:border"
    >
      <p className="m-0 text-sm text-gray-800">
        We&apos;d like to measure how the shop is used (pages, searches, products added to carts) with Google Analytics. No advertising
        cookies, and nothing is sent unless you accept.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose("granted")}
          className="min-h-11 flex-1 rounded bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Accept analytics
        </button>
        <button
          type="button"
          onClick={() => choose("denied")}
          className="min-h-11 flex-1 rounded border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Decline
        </button>
      </div>
    </section>
  );
}
