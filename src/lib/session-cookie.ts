// The session cookie's name, shared with the proxy (which can't import server code). __Host- makes the browser refuse
// it unless it is Secure, for this exact host and path "/", so a sibling subdomain can't plant one. Over plain http in
// development the browser would drop it, hence the plain name there.
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-ct_session" : "ct_session";
