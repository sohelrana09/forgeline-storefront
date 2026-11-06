import { describe, expect, it } from "vitest";
import { orderEventTarget } from "@/features/order-processing/events";

const ID = "0f8b5a54-6c1e-4b8f-9d3a-2a1c3e4f5a6b";
const message = { notificationType: "Message", type: "OrderCreated", resource: { typeId: "order", id: ID } };

describe("orderEventTarget", () => {
  it("reads a plain message", () => {
    expect(orderEventTarget(message)).toEqual({ typeId: "order", id: ID });
  });

  it("unwraps EventBridge and Pub/Sub deliveries", () => {
    expect(orderEventTarget({ detail: message })).toEqual({ typeId: "order", id: ID });
    const data = Buffer.from(JSON.stringify(message)).toString("base64");
    expect(orderEventTarget({ message: { data } })).toEqual({ typeId: "order", id: ID });
  });

  it("accepts payment messages", () => {
    expect(orderEventTarget({ resource: { typeId: "payment", id: ID } })).toEqual({ typeId: "payment", id: ID });
  });

  it("ignores other resources, bad ids and junk", () => {
    for (const body of [
      undefined,
      "x",
      { resource: { typeId: "cart", id: ID } },
      { resource: { typeId: "order", id: "abc" } },
      { resource: { typeId: "order", id: `${ID}" or 1=1` } },
      { message: { data: "%%%" } },
      { detail: { detail: { detail: message } } },
    ]) {
      expect(orderEventTarget(body)).toBeUndefined();
    }
  });
});
