# Drevvy Sources of Truth

These two documents are the canonical product and data-architecture references for this project (internally still named AutoAgent; the product brand is **Drevvy**).

When they conflict with older AutoAgent docs, **these files win** unless a newer written decision explicitly overrides them.

| File | Use it for |
| --- | --- |
| [`DREVVY_CONTEXT.md`](./DREVVY_CONTEXT.md) | Product vision, business model, MarketCheck relationship, consumer/dealer experience, legal guardrails, and open questions |
| [`DREVVY_DATA_ARCHITECTURE.md`](./DREVVY_DATA_ARCHITECTURE.md) | Target data layers, MarketCheck MCP/API vs feed usage, event taxonomy, IDs, search/ranking, and engineering rules |

## When you must read them

Read both before changing:

- MarketCheck MCP client, live search, syndication, or feeds
- Inventory search/index, ranking, or MCP tool contracts
- Lead / quote / offer / negotiation / dealer workflow
- Event tracking, analytics, or identity/PII handling
- Monetization, dealer participation, or consumer agent scope

Older operational guides (`docs/05-MARKETCHECK-INTEGRATION.md`, `docs/api/marketcheck-endpoints.md`, `docs/marketcheck/`) remain useful for current implementation details. They do not override the strategy in these two files.
