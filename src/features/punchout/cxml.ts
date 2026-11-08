import { SaxesParser } from "saxes";

// cXML PunchOut (docs/features/punchout.md), pure and unit-tested: strict parsing of a PunchOutSetupRequest and
// building the PunchOutSetupResponse and the PunchOutOrderMessage that returns the cart.
//
// Parsing is deliberately narrow: saxes is a non-validating parser that never fetches anything and knows only the
// five predefined entities, so external entities (XXE) and entity expansion ("billion laughs") can't happen. On top
// of that a DOCTYPE with an internal subset is refused, as are documents over MAX_BYTES, nesting deeper than
// MAX_DEPTH and more than MAX_NODES elements. The usual `<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/...dtd">` is
// accepted and ignored (never loaded).

export const MAX_BYTES = 64 * 1024;
const MAX_DEPTH = 32;
const MAX_NODES = 2000;

export type XmlNode = { name: string; attrs: Record<string, string>; children: XmlNode[]; text: string };

export class CxmlError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 413 = 400,
  ) {
    super(message);
  }
}

export function parseXml(xml: string): XmlNode {
  if (Buffer.byteLength(xml, "utf8") > MAX_BYTES) throw new CxmlError("Document too large", 413);
  const parser = new SaxesParser({ xmlns: false, position: false });
  const stack: XmlNode[] = [];
  let root: XmlNode | undefined;
  let nodes = 0;
  let failure: Error | undefined;
  parser.on("doctype", (doctype) => {
    if (/[[\]]|<!ENTITY/i.test(doctype)) failure = new CxmlError("DOCTYPE with an internal subset is not accepted");
  });
  parser.on("processinginstruction", () => {
    // Allowed and ignored (e.g. stylesheets); nothing is processed.
  });
  parser.on("opentag", (tag) => {
    if (++nodes > MAX_NODES) failure ??= new CxmlError("Too many elements", 413);
    if (stack.length >= MAX_DEPTH) failure ??= new CxmlError("Nesting too deep");
    const node: XmlNode = { name: tag.name, attrs: { ...(tag.attributes as Record<string, string>) }, children: [], text: "" };
    if (stack.length) stack[stack.length - 1].children.push(node);
    else root = node;
    stack.push(node);
  });
  parser.on("text", (t) => {
    if (stack.length) stack[stack.length - 1].text += t;
  });
  parser.on("cdata", (t) => {
    if (stack.length) stack[stack.length - 1].text += t;
  });
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.on("error", (err) => {
    failure ??= err;
  });
  try {
    parser.write(xml).close();
  } catch (err) {
    failure ??= err as Error;
  }
  if (failure)
    throw failure instanceof CxmlError ? failure : new CxmlError(`Malformed XML: ${failure.message.split("\n")[0].slice(0, 120)}`);
  if (!root) throw new CxmlError("Empty document");
  return root;
}

// Child elements by a path of names ("Header/From/Credential").
export function find(node: XmlNode | undefined, path: string): XmlNode | undefined {
  return path.split("/").reduce<XmlNode | undefined>((n, name) => n?.children.find((c) => c.name === name), node);
}
export const findAll = (node: XmlNode | undefined, name: string) => node?.children.filter((c) => c.name === name) ?? [];
const textOf = (node: XmlNode | undefined) => node?.text.trim() ?? "";

export type Credential = { domain: string; identity: string; sharedSecret?: string };

export type SetupRequest = {
  payloadId: string;
  from: Credential;
  to: Credential;
  sender: Credential;
  userAgent: string;
  operation: "create" | "edit" | "inspect";
  buyerCookie: string;
  browserFormPost: string;
  email?: string;
  name?: string;
};

const credential = (n: XmlNode | undefined): Credential => ({
  domain: (n?.attrs.domain ?? "").trim(),
  identity: textOf(find(n, "Identity")),
  sharedSecret: find(n, "SharedSecret") ? textOf(find(n, "SharedSecret")) : undefined,
});

// The buyer's procurement system asks for a PunchOut session.
export function parseSetupRequest(xml: string): SetupRequest {
  const root = parseXml(xml);
  if (root.name !== "cXML") throw new CxmlError("Not a cXML document");
  const header = find(root, "Header");
  const request = find(root, "Request/PunchOutSetupRequest");
  if (!header || !request) throw new CxmlError("Not a PunchOutSetupRequest");
  const operation = (request.attrs.operation ?? "create") as SetupRequest["operation"];
  if (!["create", "edit", "inspect"].includes(operation)) throw new CxmlError("Unknown operation");
  const browserFormPost = textOf(find(request, "BrowserFormPost/URL"));
  const buyerCookie = textOf(find(request, "BuyerCookie"));
  if (!browserFormPost) throw new CxmlError("BrowserFormPost URL missing");
  if (!buyerCookie || buyerCookie.length > 512) throw new CxmlError("BuyerCookie missing or too long");
  const contact = find(request, "Contact");
  const extrinsic = (name: string) => textOf(findAll(request, "Extrinsic").find((e) => e.attrs.name === name));
  const sender = credential(find(header, "Sender/Credential"));
  return {
    payloadId: (root.attrs.payloadID ?? "").slice(0, 200),
    from: credential(find(header, "From/Credential")),
    to: credential(find(header, "To/Credential")),
    sender,
    userAgent: textOf(find(header, "Sender/UserAgent")).slice(0, 200),
    operation,
    buyerCookie,
    browserFormPost,
    email: (textOf(find(contact, "Email")) || extrinsic("UserEmail") || undefined)?.slice(0, 254),
    name: (textOf(find(contact, "Name")) || undefined)?.slice(0, 200),
  };
}

// ---------- Building cXML ----------

export const esc = (s: string) =>
  s
    // Characters XML 1.0 can't carry at all are dropped rather than escaped.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const DOCTYPE = '<!DOCTYPE cXML SYSTEM "http://xml.cxml.org/schemas/cXML/1.2.014/cXML.dtd">';
const envelope = (payloadId: string, timestamp: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n${DOCTYPE}\n<cXML payloadID="${esc(payloadId)}" timestamp="${esc(timestamp)}" xml:lang="en-US">${body}</cXML>`;

export function setupResponse(payloadId: string, timestamp: string, startUrl: string): string {
  return envelope(
    payloadId,
    timestamp,
    `<Response><Status code="200" text="OK"/><PunchOutSetupResponse><StartPage><URL>${esc(startUrl)}</URL></StartPage></PunchOutSetupResponse></Response>`,
  );
}

export function errorResponse(payloadId: string, timestamp: string, code: number, text: string): string {
  return envelope(payloadId, timestamp, `<Response><Status code="${code}" text="${esc(text)}">${esc(text)}</Status></Response>`);
}

export type ReturnLine = {
  sku: string;
  name: string;
  quantity: number;
  // Unit price as a decimal string in the cart currency ("12.50"), and the line's cart line id.
  unitPrice: string;
  lineId: string;
  unit?: string;
  classification?: string;
};

export type OrderMessage = {
  payloadId: string;
  timestamp: string;
  buyerCookie: string;
  from: Credential; // the supplier (us), as the buyer's system knows it
  to: Credential; // the buyer
  currency: string;
  total: string;
  lines: ReturnLine[];
};

// The cart, back to the procurement system (the browser posts it as the form field cxml-urlencoded).
export function orderMessage(m: OrderMessage): string {
  const cred = (c: Credential) => `<Credential domain="${esc(c.domain)}"><Identity>${esc(c.identity)}</Identity></Credential>`;
  const items = m.lines
    .map(
      (l) =>
        `<ItemIn quantity="${l.quantity}"><ItemID><SupplierPartID>${esc(l.sku)}</SupplierPartID><SupplierPartAuxiliaryID>${esc(l.lineId)}</SupplierPartAuxiliaryID></ItemID>` +
        `<ItemDetail><UnitPrice><Money currency="${esc(m.currency)}">${esc(l.unitPrice)}</Money></UnitPrice><Description xml:lang="en">${esc(l.name)}</Description>` +
        `<UnitOfMeasure>${esc(l.unit ?? "EA")}</UnitOfMeasure><Classification domain="UNSPSC">${esc(l.classification ?? "")}</Classification></ItemDetail></ItemIn>`,
    )
    .join("");
  return envelope(
    m.payloadId,
    m.timestamp,
    `<Header><From>${cred(m.from)}</From><To>${cred(m.to)}</To><Sender>${cred(m.from)}<UserAgent>Forgeline storefront</UserAgent></Sender></Header>` +
      `<Message><PunchOutOrderMessage><BuyerCookie>${esc(m.buyerCookie)}</BuyerCookie>` +
      `<PunchOutOrderMessageHeader operationAllowed="edit"><Total><Money currency="${esc(m.currency)}">${esc(m.total)}</Money></Total></PunchOutOrderMessageHeader>` +
      `${items}</PunchOutOrderMessage></Message>`,
  );
}

// A cent amount as a cXML decimal ("1250" with 2 digits → "12.50").
export const decimal = (centAmount: number, fractionDigits: number) =>
  fractionDigits > 0 ? (centAmount / 10 ** fractionDigits).toFixed(fractionDigits) : String(centAmount);
