import { demoSellerFields } from "@/lib/seller";

// What a production deployment needs (src/instrumentation.ts runs this at start). `missing` stops the server, because
// it can't work or can't be safe without it. `degraded` is logged at every start: it runs, but a feature is weaker
// than it looks. Pure, unit-tested.
type Env = Record<string, string | undefined>;

const REQUIRED = [
  "CTP_PROJECT_KEY",
  "CTP_CLIENT_ID",
  "CTP_CLIENT_SECRET",
  "CTP_AUTH_URL",
  "CTP_API_URL",
  "CTP_STOREFRONT_CLIENT_ID",
  "CTP_STOREFRONT_CLIENT_SECRET",
  "SITE_URL",
  "SESSION_SECRET",
];

const longEnough = (value: string | undefined) => (value?.length ?? 0) >= 32;

export function checkEnv(env: Env): { missing: string[]; degraded: string[] } {
  const missing = REQUIRED.filter((k) => !env[k]);
  const open = env.SITE_INDEXABLE === "true";
  if (open) missing.push(...demoSellerFields(env));

  const degraded: string[] = [];
  const note = (condition: boolean, text: string) => {
    if (condition) degraded.push(text);
  };
  note(
    !(env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL),
    "no Redis: rate limits count per instance, so sign-in and order limits are far weaker than configured",
  );
  note(!env.RESEND_API_KEY || !env.MAIL_FROM, "no RESEND_API_KEY or MAIL_FROM: no email goes out (confirmations, password resets)");
  note(!longEnough(env.CRON_SECRET), "CRON_SECRET missing or under 32 characters: the order sweep refuses every call, nothing retries");
  note(!longEnough(env.ORDER_EVENTS_SECRET), "ORDER_EVENTS_SECRET missing or under 32 characters: order events are refused");
  note(
    !longEnough(env.REVALIDATE_SECRET),
    "REVALIDATE_SECRET missing or under 32 characters: cached pages only refresh by their lifetimes",
  );
  note(
    (env.B2C_CARD_PAYMENTS !== "true" || env.B2C_BANK_TRANSFER === "true") && !env.BANK_TRANSFER_EXPIRY_DAYS,
    "BANK_TRANSFER_EXPIRY_DAYS unset: unpaid orders hold their stock forever",
  );
  note(!open && demoSellerFields(env).length > 0, `demo seller details in use: ${demoSellerFields(env).join(", ")}`);
  return { missing, degraded };
}
