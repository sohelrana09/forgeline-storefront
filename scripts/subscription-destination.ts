// Shared by the Subscription scripts: the queue destination from the command line.
//   --eventbridge <aws-account-id>      AWS EventBridge in the project's region (us-east-2)
//   --pubsub <gcp-project>/<topic>      Google Cloud Pub/Sub
import type { Destination } from "@commercetools/platform-sdk";

const REGION = "us-east-2";

export function destinationFromArgs(args: string[]): Destination | undefined {
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const account = value("--eventbridge");
  if (account) {
    if (!/^\d{12}$/.test(account)) throw new Error("--eventbridge needs the 12-digit AWS account id");
    // `source` is set by commercetools (the SDK type wrongly requires it on create).
    return { type: "EventBridge", region: REGION, accountId: account } as Destination;
  }
  const pubsub = value("--pubsub");
  if (pubsub) {
    const [projectId, topic] = pubsub.split("/");
    if (!projectId || !topic) throw new Error("--pubsub needs <gcp-project>/<topic>");
    return { type: "GoogleCloudPubSub", projectId, topic };
  }
  return undefined;
}
