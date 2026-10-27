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
