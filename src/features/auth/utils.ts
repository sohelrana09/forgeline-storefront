// Sign-in throttling (pure, unit-tested). Only failed attempts count, so colleagues behind one office address can all
// sign in. The tight limit is per address AND email. The per-email limit stops guessing spread over many addresses,
// but anyone could use it to lock a buyer out, so it doesn't apply on a device that signed in to that account before
// (the sealed known-device cookie). Without a proxy the address is unknown ("no-proxy"): then there is no per-address
// limit, or one person's typos would lock out everybody.
export const KNOWN_DEVICES_MAX = 5;

export function loginLimits(ip: string, email: string, knownDevice: boolean): { key: string; max: number }[] {
  return [
    { key: `login:${ip}:${email}`, max: 10 },
    ...(knownDevice ? [] : [{ key: `login-email:${email}`, max: 50 }]),
    ...(ip === "no-proxy" ? [] : [{ key: `login-ip:${ip}`, max: 100 }]),
  ];
}

// The accounts remembered on this device after a sign-in: this one first, at most KNOWN_DEVICES_MAX.
export const rememberAccount = (emails: string[], email: string) =>
  [email, ...emails.filter((e) => e !== email)].slice(0, KNOWN_DEVICES_MAX);

// What ended a customer's sessions: a time, and single sessions by id until they would have expired anyway.
export type Revocation = { after: number; ended: { sid: string; until: number }[] };
const MAX_ENDED = 50;

export function parseRevocation(value: unknown): Revocation {
  const v = value as { after?: unknown; ended?: unknown } | undefined;
  const ended = Array.isArray(v?.ended) ? (v.ended as Revocation["ended"]).filter((e) => typeof e?.sid === "string") : [];
  return { after: Number(v?.after) || 0, ended };
}

export const withEndedSession = (value: Revocation, sid: string, until: number, now: number): Revocation => ({
  ...value,
  ended: [...value.ended.filter((e) => e.until > now && e.sid !== sid), { sid, until }].slice(-MAX_ENDED),
});

export const sessionRefused = (revocation: Revocation, issuedAt: number, sid: string | undefined) =>
  issuedAt < revocation.after || (!!sid && revocation.ended.some((e) => e.sid === sid));

// Passwords. Length carries the strength, with a letter and a digit so a common word alone fails; breached passwords
// are refused separately (features/auth/password.ts).
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const PASSWORD_RULE = `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters with at least one letter and one number.`;
export const strongEnough = (password: string) =>
  password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX && /\p{L}/u.test(password) && /\d/.test(password);
