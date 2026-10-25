// Limits: commercetools allows 250 lines per shopping list; the list count is ours (it has no per-customer limit).
export const MAX_LINES = 250;
export const MAX_LISTS = 50;
export const MAX_QUANTITY = 9999;
// Kept 10 years after the last change (the project default deletes untouched lists after 360 days).
export const KEEP_DAYS = 3650;
export const LIST_NAME = /^[\p{L}\p{M}\p{N}' .,&()/#+-]{1,100}$/u;
