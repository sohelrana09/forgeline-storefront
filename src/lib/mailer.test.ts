import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMail } from "@/lib/mailer";

const mail = { to: "buyer@example.com", subject: "Hello", text: "Body" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendMail", () => {
  it("prints to the log in development without a key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendMail(mail)).toBe(true);
    expect(info.mock.calls[0][0]).toContain("Subject: Hello");
  });

  it("refuses in production without a key", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendMail(mail)).toBe(false);
  });

  it("posts to Resend with the sender from MAIL_FROM", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "Shop <shop@example.com>");
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendMail(mail)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body)).toEqual({ from: "Shop <shop@example.com>", to: ["buyer@example.com"], subject: "Hello", text: "Body" });
  });

  it("reports a refusal without throwing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "shop@example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"name":"validation_error"}', { status: 422 })));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendMail(mail)).toBe(false);
    expect(error.mock.calls[0][0]).toContain("Resend 422 validation_error");
  });

  it("needs MAIL_FROM with a key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendMail(mail)).toBe(false);
  });
});
