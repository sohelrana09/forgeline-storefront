import { initBotId } from "botid/client/core";

// Vercel BotID: the browser attaches its bot-detection headers to these POSTs (Server Actions post to the page they
// run on), and the actions check them with checkBotId() (isAutomated in src/lib/bot-check.ts). A path missing here
// makes that check fail, so keep the list in step with the actions that call it.
initBotId({
  protect: [
    { path: "/login", method: "POST" },
    { path: "/register", method: "POST" },
    { path: "/forgot-password", method: "POST" },
    { path: "/reset-password", method: "POST" },
    { path: "/checkout", method: "POST" },
  ],
});
