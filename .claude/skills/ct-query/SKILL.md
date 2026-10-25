---
name: ct-query
description: Query the live commercetools project (ctwara, us-east-2) read-only and summarise the result. Use when the user asks what is in the project, or to check data shapes (prices, stores, channels, business units, roles, discounts) before writing code.
allowed-tools: Bash(npm run -s ct:query:*), Bash(jq:*)
---

# Query the commercetools project

1. Map the question to an endpoint (path relative to `/{projectKey}/`):

   | Question about | Endpoint | Useful predicate |
   |---|---|---|
   | Products | `product-projections` or `product-projections/key=<key>` | `masterVariant(sku="...")` |
   | Prices | `standalone-prices` | `sku="<sku>"` |
   | Stores and channels | `stores`, `channels` | `key="..."` |
   | B2B | `business-units`, `associate-roles` | `unitType="Company"` |
   | Promotions | `product-discounts`, `cart-discounts`, `discount-codes` | `isActive=true` |
   | Schema | `product-types`, `types` | |

2. Run: `npm run -s ct:query -- <endpoint> '<predicate>' <limit> | jq '<filter>'`. Always use `jq` to select only the fields you need. Never dump full responses into the conversation.
3. Replace ids with keys by querying the referenced resource.
4. Answer with a short table or bullets, then add one line on what this means for the code being written.

This skill is read-only. To change data, write a script in `scripts/` following `.claude/rules/scripts.md` instead.
