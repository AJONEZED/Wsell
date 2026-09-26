import { runWeeklyCycle, aggregateBaskets, reconcileDisplayTotals } from "./pipeline.js";
import { CATALOG_ITEMS, CATEGORIES, getItem, stepForUnit, formatQty } from "./catalog.js";

const $ = (id) => document.getElementById(id);
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `$${n.toFixed(2)}`;

const HOUSEHOLD_IDS = ["A", "B"];

const state = {
  baskets: {
    A: { tomato: 4, potato: 3, orange: 2, mint: 1 },
    B: { tomato: 6, onion: 2, banana: 1.5, lettuce: 2 },
  },
  picker: {
    A: { search: "", category: "All" },
    B: { search: "", category: "All" },
  },
  // Present only for items the user has manually edited — everything else
  // falls back to the catalog stub each render.
  feedPriceOverrides: {},
  receiptOverrides: {},
};

function filteredItems(hid) {
  const { search, category } = state.picker[hid];
  const needle = search.trim().toLowerCase();
  return CATALOG_ITEMS.filter((item) => {
    const inCategory = category === "All" || item.category === category;
    const matchesSearch = !needle || item.name.toLowerCase().includes(needle);
    return inCategory && matchesSearch;
  });
}

function basketEntries(hid) {
  const basket = state.baskets[hid];
  return CATALOG_ITEMS.filter((item) => (basket[item.id] || 0) > 0).map((item) => ({
    item,
    qty: basket[item.id],
  }));
}

function renderPickerShell(hid) {
  const container = $(`picker${hid}`);
  const chipsHtml = CATEGORIES.map(
    (cat) =>
      `<button type="button" class="chip${cat === "All" ? " active" : ""}" data-category="${cat}">${cat}</button>`
  ).join("");

  container.innerHTML = `
    <input type="search" class="search-input" data-role="search" placeholder="Search fruits & vegetables…" />
    <div class="chip-row">${chipsHtml}</div>
    <div class="item-grid" data-role="grid"></div>
    <div class="basket" data-role="basket"></div>
  `;

  renderGrid(hid);
  renderBasket(hid);

  container.querySelector('[data-role="search"]').addEventListener("input", (e) => {
    state.picker[hid].search = e.target.value;
    renderGrid(hid);
  });

  container.querySelector(".chip-row").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.picker[hid].category = chip.dataset.category;
    container.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    renderGrid(hid);
  });

  container.querySelector('[data-role="grid"]').addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile) return;
    addItem(hid, tile.dataset.item);
  });

  container.querySelector('[data-role="basket"]').addEventListener("click", (e) => {
    const line = e.target.closest(".basket-line");
    if (!line) return;
    const itemId = line.dataset.item;
    if (e.target.closest(".remove-btn")) {
      removeItem(hid, itemId);
    } else if (e.target.closest('[data-action="inc"]')) {
      changeQty(hid, itemId, stepForUnit(getItem(itemId).unit));
    } else if (e.target.closest('[data-action="dec"]')) {
      changeQty(hid, itemId, -stepForUnit(getItem(itemId).unit));
    }
  });
}

function renderGrid(hid) {
  const container = $(`picker${hid}`).querySelector('[data-role="grid"]');
  const items = filteredItems(hid);
  if (items.length === 0) {
    container.innerHTML = `<p class="hint">No items match your search.</p>`;
    return;
  }
  container.innerHTML = items
    .map((item) => {
      const qty = state.baskets[hid][item.id] || 0;
      const badge = qty > 0 ? `<span class="tile-badge">${formatQty(qty, item.unit)}</span>` : "";
      return `
        <button type="button" class="tile" data-item="${item.id}">
          <span class="tile-name">${item.name}</span>
          <span class="tile-unit">$${item.stubPrice.toFixed(2)}/${item.unit}</span>
          ${badge}
        </button>`;
    })
    .join("");
}

function renderBasket(hid) {
  const container = $(`picker${hid}`).querySelector('[data-role="basket"]');
  const entries = basketEntries(hid);
  if (entries.length === 0) {
    container.innerHTML = `<p class="hint">No items in this basket yet — tap an item above to add it.</p>`;
    return;
  }
  container.innerHTML = entries
    .map(
      ({ item, qty }) => `
      <div class="basket-line" data-item="${item.id}">
        <span class="bl-name">${item.name}</span>
        <div class="stepper">
          <button type="button" class="step-btn" data-action="dec" aria-label="Decrease">−</button>
          <span class="step-value">${formatQty(qty, item.unit)}</span>
          <button type="button" class="step-btn" data-action="inc" aria-label="Increase">+</button>
        </div>
        <button type="button" class="remove-btn" aria-label="Remove ${item.name}">✕</button>
      </div>`
    )
    .join("");
}

function addItem(hid, itemId) {
  const item = getItem(itemId);
  const current = state.baskets[hid][itemId] || 0;
  state.baskets[hid][itemId] = round2(current + stepForUnit(item.unit));
  renderGrid(hid);
  renderBasket(hid);
  renderAggregated();
}

function changeQty(hid, itemId, delta) {
  const current = state.baskets[hid][itemId] || 0;
  const next = round2(current + delta);
  if (next <= 0) {
    delete state.baskets[hid][itemId];
  } else {
    state.baskets[hid][itemId] = next;
  }
  renderGrid(hid);
  renderBasket(hid);
  renderAggregated();
}

function removeItem(hid, itemId) {
  delete state.baskets[hid][itemId];
  renderGrid(hid);
  renderBasket(hid);
  renderAggregated();
}

function pruneOverrides(aggregated) {
  for (const id of Object.keys(state.feedPriceOverrides)) {
    if (!aggregated[id]) delete state.feedPriceOverrides[id];
  }
  for (const id of Object.keys(state.receiptOverrides)) {
    if (!aggregated[id]) delete state.receiptOverrides[id];
  }
}

function renderAggregated() {
  const aggregated = aggregateBaskets(state.baskets);
  pruneOverrides(aggregated);
  const itemIds = CATALOG_ITEMS.filter((i) => aggregated[i.id]).map((i) => i.id);

  const aggregatedList = $("aggregatedList");
  const priceFeedList = $("priceFeedList");
  const receiptList = $("receiptList");

  if (itemIds.length === 0) {
    aggregatedList.innerHTML = `<p class="hint">No items ordered yet — add items to a household's basket above.</p>`;
    priceFeedList.innerHTML = `<p class="hint">Nothing to price yet.</p>`;
    receiptList.innerHTML = `<p class="hint">Nothing to submit a receipt for yet.</p>`;
    return;
  }

  aggregatedList.innerHTML = itemIds
    .map((id) => {
      const item = getItem(id);
      const agg = aggregated[id];
      const who = agg.households.map((h) => h.id).sort().join(", ");
      return `
        <div class="agg-row">
          <div class="agg-top">
            <span class="agg-name">${item.name}</span>
            <span class="agg-qty">${formatQty(agg.totalQty, item.unit)}</span>
          </div>
          <div class="agg-who">Wanted by: ${who}</div>
        </div>`;
    })
    .join("");

  priceFeedList.innerHTML = itemIds
    .map((id) => {
      const item = getItem(id);
      const value = state.feedPriceOverrides[id] ?? item.stubPrice;
      return `
        <label>
          ${item.name} ($/${item.unit})
          <input type="number" min="0" step="0.01" inputmode="decimal" data-item="${id}" value="${value}" />
        </label>`;
    })
    .join("");

  receiptList.innerHTML = itemIds
    .map((id) => {
      const item = getItem(id);
      const agg = aggregated[id];
      const defaultPaid = round2(item.stubPrice * agg.totalQty);
      const value = state.receiptOverrides[id] ?? defaultPaid;
      return `
        <label>
          ${item.name} — actual paid ($)
          <input type="number" min="0" step="0.01" inputmode="decimal" data-item="${id}" value="${value}" />
        </label>`;
    })
    .join("");
}

function renderResults(result) {
  const { itemChecks, totalBand, totalCheck, totalPaid, bills } = result;
  const displayTotals = reconcileDisplayTotals(bills);

  let checksHtml;
  if (itemChecks.length === 0) {
    checksHtml = `<p class="hint">No items were ordered this cycle — nothing to check or bill.</p>`;
  } else {
    const overallFlagHtml = totalCheck.flagged
      ? `<p class="flag flag-bad">⚠ Receipt total is ${(totalCheck.deviationPct * 100).toFixed(1)}% off the expected band.</p>`
      : `<p class="flag flag-ok">✓ Receipt total is within the expected band.</p>`;
    const totalBandHtml = `<p class="hint">Expected total: ${fmt(totalBand.low)} – ${fmt(totalBand.high)} (center ${fmt(totalBand.expectedTotal)}); runner submitted ${fmt(totalPaid)}.</p>`;
    const itemFlagsHtml = itemChecks
      .map((c) => {
        const item = getItem(c.itemId);
        const cls = c.flagged ? "flag-bad" : "flag-ok";
        const icon = c.flagged ? "⚠" : "✓";
        return `<li class="${cls}">${icon} ${item.name}: paid ${fmt(c.paid)}, expected ${fmt(c.band.low)} – ${fmt(c.band.high)}</li>`;
      })
      .join("");
    checksHtml = overallFlagHtml + totalBandHtml + `<ul class="item-checks">${itemFlagsHtml}</ul>`;
  }

  const billsHtml = bills
    .map((b) => {
      if (!b.isActive) {
        return `
          <div class="bill">
            <h3>Household ${b.id}</h3>
            <p class="hint">No items ordered this cycle — nothing to bill.</p>
          </div>`;
      }
      const itemRows = b.items
        .map((line) => {
          const item = getItem(line.itemId);
          return `<tr class="item-row"><td>${item.name} (${formatQty(line.qty, item.unit)})</td><td>${fmt(line.cost)}</td></tr>`;
        })
        .join("");
      return `
        <div class="bill">
          <h3>Household ${b.id}</h3>
          <table>
            ${itemRows}
            <tr><td>Wholesale passthrough</td><td>${fmt(b.wholesaleCost)}</td></tr>
            <tr><td>Platform fee</td><td>${fmt(b.platformFee)}</td></tr>
            <tr><td>Runner fee share</td><td>${fmt(b.runnerFeeShare)}</td></tr>
            <tr class="total"><td>Total</td><td>${fmt(displayTotals[b.id])}</td></tr>
          </table>
        </div>`;
    })
    .join("");

  $("resultsBody").innerHTML = checksHtml + billsHtml;
  $("results").classList.remove("hidden");
}

function runCycle() {
  const aggregated = aggregateBaskets(state.baskets);
  const feedPrices = {};
  const actualPaid = {};
  for (const id of Object.keys(aggregated)) {
    const item = getItem(id);
    feedPrices[id] = state.feedPriceOverrides[id] ?? item.stubPrice;
    actualPaid[id] = state.receiptOverrides[id] ?? round2(item.stubPrice * aggregated[id].totalQty);
  }
  const runnerFlatFee = parseFloat($("runnerFee").value) || 0;

  const result = runWeeklyCycle({ baskets: state.baskets, feedPrices, actualPaid, runnerFlatFee });
  renderResults(result);
}

function init() {
  for (const hid of HOUSEHOLD_IDS) renderPickerShell(hid);
  renderAggregated();

  $("priceFeedList").addEventListener("input", (e) => {
    const input = e.target.closest("input[data-item]");
    if (!input) return;
    state.feedPriceOverrides[input.dataset.item] = parseFloat(input.value) || 0;
  });

  $("receiptList").addEventListener("input", (e) => {
    const input = e.target.closest("input[data-item]");
    if (!input) return;
    state.receiptOverrides[input.dataset.item] = parseFloat(input.value) || 0;
  });

  $("runBtn").addEventListener("click", runCycle);
  runCycle();
}

init();
