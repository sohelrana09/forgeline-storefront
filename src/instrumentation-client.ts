import { initBotId } from "botid/client/core";
import { PRIVATE_SEGMENTS } from "@/lib/private-segments";

// Vercel BotID: the browser attaches its bot-detection headers to these POSTs (Server Actions post to the page they
// run on), and the actions check them with checkBotId() (isAutomated in src/lib/bot-check.ts). A path missing here
// makes that check fail, so keep the list in step with the actions that call it.
// Only the private pages load it: everything it protects is there, and moving from a shop page to a private one is a
// full page load, so catalog visitors don't pay for the challenge.
if (PRIVATE_SEGMENTS.has(window.location.pathname.split("/")[1])) {
  initBotId({
    protect: [
      { path: "/login", method: "POST" },
      { path: "/register", method: "POST" },
      { path: "/forgot-password", method: "POST" },
      { path: "/reset-password", method: "POST" },
      { path: "/checkout", method: "POST" },
    ],
  });
}
