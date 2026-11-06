// What a commercetools SDK error says. Pure, unit-tested.
type ErrorBody = { statusCode?: number; errors?: { code?: string }[] };

export const errorBody = (err: unknown): ErrorBody => (err as { body?: ErrorBody })?.body ?? {};
export const statusOf = (err: unknown) => errorBody(err).statusCode;
export const errorCodes = (err: unknown) => (errorBody(err).errors ?? []).flatMap((e) => (e.code ? [e.code] : []));
export const hasCode = (err: unknown, code: string) => errorCodes(err).includes(code);
export const firstCode = (err: unknown) => errorCodes(err)[0];
