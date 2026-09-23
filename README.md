# Wsell

A wholesale-marketplace matching and fulfillment algorithm: households
subscribe to a weekly basket, runners buy one aggregated list per
zone/market instead of many small ones, and every household gets an
itemized bill built from a verified wholesale price passthrough.

## The weekly cycle

1. **Onboarding** (`wsell/onboarding.py`) — households pick a zone,
   budget tier, and delivery day; runners must pass ID + vehicle
   verification and are assigned to a zone/market pair before they're
   eligible to receive orders.
2. **Demand aggregation** (`wsell/aggregation.py`) — by the weekly
   cutoff, all household orders for a zone are grouped by the wholesale
   market that zone is served from, and assigned to that zone/market's
   most reliable eligible runner. Output: one aggregated shopping list
   per runner per market.
3. **Price verification** (`wsell/price_verification.py`,
   `wsell/price_feed.py`) — the aggregated list is priced against a live
   wholesale feed to produce an expected cost band (±8% by default).
   After the runner submits a receipt, a total outside that band is
   flagged for review instead of silently accepted.
4. **Runner execution / allocation** (`wsell/allocation.py`) — the
   runner buys once. Each household's wholesale cost is its ordered
   quantity's share of the total ordered quantity, applied to what the
   receipt actually shows was paid. Items the runner couldn't source are
   reported, never silently charged. The runner is paid a flat fee, not
   a markup — they never set a price.
5. **Delivery** (`wsell/delivery.py`) — stops are sequenced for the
   runner's own zone subscribers only.
6. **Billing** (`wsell/billing.py`) — each household sees three itemized
   lines: verified wholesale passthrough, platform fee, and its share of
   the runner's flat fee.
7. **Feedback** (`wsell/feedback.py`) — runner reliability is an
   exponential moving average of on-time delivery, order accuracy, and
   receipt-flag history, and gates eligibility for more zones/subscribers.
   Household complaint rate is tallied for churn/pricing decisions.

`wsell/pipeline.py` runs steps 2–6 end to end for a week's orders and
returns a per-runner result (aggregated list, cost band, receipt check,
allocation, route, bills).

## The open dependency: the live price feed

Step 3 is the one piece this repo can't solve on its own. `PriceFeed` in
`wsell/price_feed.py` is a plain interface —
`unit_price(market_id, sku, unit) -> float` — with a fixed-table
`StubPriceFeed` for tests. Without a real, trustworthy per-market daily
price source behind that interface, the fraud check has nothing to check
against and the model degrades to "just trust the runner." Options worth
evaluating, roughly in order of effort:

- A market's own published price sheet or API, if one exists.
- A daily manually-entered price sheet (staff or a second runner spot-
  checks a handful of SKUs each morning).
- A commercial agricultural/wholesale price data vendor.

Whichever is chosen, only `price_feed.py` needs to change — nothing else
in the pipeline depends on how prices are sourced.

## Running the tests

```
pip install pytest
python3 -m pytest
```
