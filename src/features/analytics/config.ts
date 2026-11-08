import { gtmId } from "@/features/analytics/events";

// The Google Tag Manager container (NEXT_PUBLIC_GTM_ID, inlined at build). Without one, events still go to
// window.dataLayer (harmless, and what the browser tests read) but nothing loads and no consent banner shows.
export const analyticsContainer = () => gtmId(process.env.NEXT_PUBLIC_GTM_ID);
export const CONSENT_SETTINGS_HASH = "#cookie-settings";
