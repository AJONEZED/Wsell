import { CATALOG_ITEMS, getItem } from "./catalog.js";
import { searchCatalog } from "./search.js";
import { stepForUnit, formatQty } from "./units.js";
import { centsToStr, fmtRange } from "./money.js";
import { getCutoffPhase, formatCountdown, formatSaturday } from "./time.js";
import { basketSummary, computeHold, simulateMarketRun, computeBill, lineEstimate } from "./pipeline.js";
import { seedHistory } from "./history-seed.js";
import { MEMBERSHIP_FEE_CENTS } from "./config.js";

const $ = (id) => document.getElementById(id);

const state = {
  screen: "home",
  basket: [],
  basketStatus: "open", // 'open' | 'closed'
  holdCents: null,
  billResults: null, // set once "Demo: simulate market run" has been pressed
  history: seedHistory(),
  historyDetailId: null,
  unknownTerms: [], // free-text items that matched nothing — for a future ops console
  confirmingClose: false,
  suggestionQuery: "",
  suggestionItems: [],
  suggestionHighlight: 0,
};

let idCounter = 0;
function newId() {
  idCounter += 1;
  return `line-${Date.now()}-${idCounter}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function isExactNameOrAlias(item, query) {
  const q = query.trim().toLowerCase();
  return item.name.toLowerCase() === q || item.aliases.some((a) => a.toLowerCase() === q);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function historyIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`;
}

function receiptIconSvg() {
  return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>`;
}

// ---------- basket mutations ----------

function findLineByItemId(itemId) {
  return state.basket.find((l) => l.kind === "catalog" && l.itemId === itemId);
}

function findCustomLineByName(name) {
  const n = name.trim().toLowerCase();
  return state.basket.find((l) => l.kind === "custom" && l.name.toLowerCase() === n);
}

function addCatalogItem(catalogItem) {
  const existing = findLineByItemId(catalogItem.id);
  if (existing) {
    existing.qty = round2(existing.qty + stepForUnit(existing.unit));
  } else {
    state.basket.push({
      lineId: newId(),
      kind: "catalog",
      itemId: catalogItem.id,
      name: catalogItem.name,
      category: catalogItem.category,
      unit: catalogItem.unit,
      qty: stepForUnit(catalogItem.unit),
      stubPriceCents: catalogItem.stubPriceCents,
      substitution: "substitute",
    });
  }
  clearSuggestionInput();
  renderBasketAndSummary();
}

function addCustomItem(rawName) {
  const name = rawName.trim();
  if (!name) return;
  const existing = findCustomLineByName(name);
  if (existing) {
    existing.qty += 1;
  } else {
    state.basket.push({
      lineId: newId(),
      kind: "custom",
      itemId: null,
      name,
      category: "Custom",
      unit: "unit",
      qty: 1,
      stubPriceCents: null,
      substitution: "substitute",
    });
    const key = name.toLowerCase();
    if (!state.unknownTerms.includes(key)) state.unknownTerms.push(key);
  }
  clearSuggestionInput();
  renderBasketAndSummary();
}

function changeQty(lineId, delta) {
  const line = state.basket.find((l) => l.lineId === lineId);
  if (!line) return;
  const next = round2(line.qty + delta);
  if (next <= 0) {
    state.basket = state.basket.filter((l) => l.lineId !== lineId);
  } else {
    line.qty = next;
  }
  renderBasketAndSummary();
}

function removeLine(lineId) {
  state.basket = state.basket.filter((l) => l.lineId !== lineId);
  renderBasketAndSummary();
}

function setSubstitution(lineId, value) {
  const line = state.basket.find((l) => l.lineId === lineId);
  if (line) line.substitution = value;
}

// ---------- screen switching ----------

function showScreen(name) {
  state.screen = name;
  $("screen-home").classList.toggle("hidden", name !== "home");
  $("screen-bill").classList.toggle("hidden", name !== "bill");
  $("screen-history").classList.toggle("hidden", name !== "history");
}

function goToHome() {
  showScreen("home");
  renderHomeShell();
  renderCountdown();
  renderBasketAndSummary();
}

function goToBill() {
  showScreen("bill");
  renderBillScreen();
}

function goToHistory() {
  state.historyDetailId = null;
  showScreen("history");
  renderHistoryScreen();
}

// ---------- Screen 1: Home ----------

function renderHomeShell() {
  $("screen-home").innerHTML = `
    <div class="home-topline">
      <button type="button" id="historyBtn" class="history-btn">${historyIconSvg()} History</button>
    </div>
    <div class="card countdown-card" id="countdownCard"></div>
    <p class="membership-line">Membership ${centsToStr(MEMBERSHIP_FEE_CENTS)}/month, active</p>
    <section class="card basket-card">
      <h2>This week's list</h2>
      <div class="add-item-row">
        <input id="itemInput" type="text" class="search-input" placeholder="Add item, e.g. tomato" autocomplete="off" />
        <div id="suggestions" class="suggestions hidden"></div>
      </div>
      <div id="basketLines" class="basket-lines"></div>
    </section>
    <div id="summaryBar" class="summary-bar"></div>
  `;
}

function renderCountdown() {
  const el = $("countdownCard");
  if (!el) return;
  const info = getCutoffPhase(new Date());
  if (info.phase === "closed") {
    el.innerHTML = `
      <p class="countdown-label">List closed</p>
      <p class="countdown-big">Runner goes to market Saturday</p>
      <p class="countdown-sub">${formatSaturday(info.saturday)}</p>
    `;
  } else {
    el.innerHTML = `
      <p class="countdown-label">Saturday run closes in</p>
      <p class="countdown-big">${formatCountdown(info.msRemaining)}</p>
      <p class="countdown-sub">Delivery ${formatSaturday(info.saturday)}</p>
    `;
  }
}

function basketLineHtml(line, readOnly) {
  const dotClass = `dot dot-${line.category.toLowerCase()}`;
  const estimateHtml =
    line.kind === "custom"
      ? `<p class="line-estimate custom">Custom item, price confirmed at market</p>`
      : (() => {
          const est = lineEstimate(line);
          return `<p class="line-estimate">${fmtRange(est.low, est.high)}</p>`;
        })();

  return `
    <div class="basket-line" data-line-id="${line.lineId}">
      <div class="line-head">
        <span class="${dotClass}" aria-hidden="true"></span>
        <span class="line-name">${escapeHtml(line.name)}</span>
        ${line.kind === "custom" ? '<span class="badge">Custom</span>' : ""}
        <button type="button" class="remove-btn" data-action="remove" ${readOnly ? "disabled" : ""} aria-label="Remove ${escapeHtml(line.name)}">✕</button>
      </div>
      ${estimateHtml}
      <div class="line-controls">
        <div class="stepper">
          <button type="button" class="step-btn" data-action="dec" ${readOnly ? "disabled" : ""} aria-label="Decrease quantity">−</button>
          <span class="step-value">${formatQty(line.qty, line.unit)}</span>
          <button type="button" class="step-btn" data-action="inc" ${readOnly ? "disabled" : ""} aria-label="Increase quantity">+</button>
        </div>
        <label class="sub-field">
          <span class="sub-label">If unavailable</span>
          <select class="sub-select" data-action="sub" ${readOnly ? "disabled" : ""}>
            <option value="substitute" ${line.substitution === "substitute" ? "selected" : ""}>Substitute similar</option>
            <option value="skip" ${line.substitution === "skip" ? "selected" : ""}>Skip</option>
            <option value="ask" ${line.substitution === "ask" ? "selected" : ""}>Ask me</option>
          </select>
        </label>
      </div>
    </div>`;
}

function renderBasketLines() {
  const container = $("basketLines");
  if (!container) return;
  const readOnly = state.basketStatus === "closed";
  if (state.basket.length === 0) {
    container.innerHTML = `<p class="hint">Your list is empty. Start typing an item above.</p>`;
    return;
  }
  container.innerHTML = state.basket.map((line) => basketLineHtml(line, readOnly)).join("");
}

function renderSummaryBar() {
  const el = $("summaryBar");
  if (!el) return;
  const summary = basketSummary(state.basket);
  const hold = computeHold(summary);

  if (state.basketStatus === "closed") {
    const canReopen = getCutoffPhase(new Date()).phase === "open";
    el.innerHTML = `
      <div class="summary-closed">
        <p class="closed-banner">List closed, hold ${centsToStr(state.holdCents)} placed</p>
        <div class="summary-actions">
          ${canReopen ? `<button type="button" id="reopenBtn" class="btn-secondary">Reopen list</button>` : ""}
          <button type="button" id="viewBillBtn" class="btn-primary">View this week's bill</button>
        </div>
      </div>`;
    return;
  }

  if (state.confirmingClose) {
    el.innerHTML = `
      <div class="confirm-panel">
        <p>We'll place a hold of <strong>${centsToStr(hold)}</strong> on your card (top of estimate + 10% + runner share). You're only charged what the runner actually pays.</p>
        <div class="summary-actions">
          <button type="button" id="cancelCloseBtn" class="btn-secondary">Cancel</button>
          <button type="button" id="confirmCloseBtn" class="btn-primary">Confirm &amp; place hold</button>
        </div>
      </div>`;
    return;
  }

  const customNote =
    summary.customCount > 0
      ? `<p class="summary-line custom-note"><span>+ ${summary.customCount} item${summary.customCount === 1 ? "" : "s"} priced at market</span></p>`
      : "";

  el.innerHTML = `
    <div class="summary-open">
      <p class="summary-line"><span>Groceries estimate</span><span>${fmtRange(summary.groceriesLow, summary.groceriesHigh)}</span></p>
      <p class="summary-line"><span>Runner share</span><span>${centsToStr(summary.runnerShare)}</span></p>
      ${customNote}
      <p class="summary-disclaimer">Estimate, final price after the run</p>
      <button type="button" id="closeListBtn" class="btn-primary" ${state.basket.length === 0 ? "disabled" : ""}>Close my list</button>
    </div>`;
}

function renderBasketAndSummary() {
  renderBasketLines();
  renderSummaryBar();
}

function clearSuggestionInput() {
  state.suggestionQuery = "";
  state.suggestionItems = [];
  state.suggestionHighlight = 0;
  const input = $("itemInput");
  if (input) {
    input.value = "";
    input.focus();
  }
  renderSuggestions();
}

function renderSuggestions() {
  const el = $("suggestions");
  if (!el) return;
  if (state.suggestionItems.length === 0) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = state.suggestionItems
    .map(
      (it, i) => `
      <button type="button" class="suggestion-item ${i === state.suggestionHighlight ? "highlighted" : ""}" data-item-id="${it.id}">
        <span class="dot dot-${it.category.toLowerCase()}" aria-hidden="true"></span>
        <span class="suggestion-name">${escapeHtml(it.name)}</span>
        <span class="suggestion-price">${centsToStr(it.stubPriceCents)}/${it.unit}</span>
      </button>`
    )
    .join("");
}

// ---------- Screen 2: Bill ----------

function chipInfo(r) {
  if (r.chip === "within") return { cls: "chip-ok", text: "Within market range" };
  if (r.chip === "above") return { cls: "chip-warn", text: `Above market range (+${centsToStr(r.diffCents)})` };
  if (r.chip === "skipped") return { cls: "chip-skip", text: "Not charged (skipped)" };
  return { cls: "chip-neutral", text: "Priced at market" };
}

function billLineHtml(r) {
  const chip = chipInfo(r);
  const refRange = r.estimate ? `<p class="line-ref">Market reference: ${fmtRange(r.estimate.low, r.estimate.high)}</p>` : "";
  return `
    <div class="bill-line">
      <div class="line-top">
        <span class="line-name">${escapeHtml(r.name)} <span class="line-qty">(${formatQty(r.qty, r.unit)})</span></span>
        <span class="line-paid">${centsToStr(r.paidCents)}</span>
      </div>
      ${refRange}
      ${r.note ? `<p class="line-note">${escapeHtml(r.note)}</p>` : ""}
      <span class="chip ${chip.cls}">${chip.text}</span>
    </div>`;
}

function paymentCardHtml(bill) {
  return `
    <div class="card payment-card">
      <p class="summary-line"><span>Groceries actual</span><span>${centsToStr(bill.groceriesActual)}</span></p>
      <p class="summary-line"><span>Runner share</span><span>${centsToStr(bill.runnerShare)}</span></p>
      <p class="summary-line charged-line"><span>Charged</span><span>${centsToStr(bill.charged)}</span></p>
      ${
        bill.extraCharged > 0
          ? `<p class="summary-line"><span>Hold captured</span><span>${centsToStr(bill.holdCents)}</span></p>
             <p class="summary-line extra-line"><span>Extra charged separately</span><span>${centsToStr(bill.extraCharged)}</span></p>`
          : `<p class="summary-line"><span>Hold released</span><span>${centsToStr(bill.heldRelease)}</span></p>`
      }
    </div>`;
}

function renderBillScreen() {
  const el = $("screen-bill");
  if (state.basketStatus !== "closed") {
    el.innerHTML = `
      <div class="card">
        <p class="hint">No list closed yet.</p>
        <button type="button" id="backHomeBtn" class="btn-secondary">Back to home</button>
      </div>`;
    return;
  }

  if (!state.billResults) {
    el.innerHTML = `
      <button type="button" id="backHomeBtn" class="btn-secondary back-btn">Back to home</button>
      <div class="card">
        <h2>This week's bill</h2>
        <p class="hint">List closed, hold ${centsToStr(state.holdCents)} placed. Waiting for the runner.</p>
        <div class="basket-lines readonly">${state.basket.map((l) => basketLineHtml(l, true)).join("")}</div>
      </div>
      <div class="card demo-card">
        <p class="demo-label">Demo: simulate market run</p>
        <button type="button" id="simulateBtn" class="btn-primary">Simulate market run</button>
      </div>`;
    return;
  }

  const bill = computeBill(state.billResults, state.holdCents);
  el.innerHTML = `
    <div class="card">
      <h2>This week's bill</h2>
      <div class="bill-lines">${state.billResults.map(billLineHtml).join("")}</div>
    </div>
    <div class="card receipt-photo-card">
      <div class="receipt-photo-placeholder">${receiptIconSvg()}<span>Receipt photo (demo)</span></div>
    </div>
    ${paymentCardHtml(bill)}
    <div class="card">
      <p class="delivery-status">Delivered Saturday 11:42, photo confirmed</p>
    </div>
    <button type="button" id="doneBillBtn" class="btn-primary done-btn">Done — back to home</button>
  `;
}

function archiveWeekAndReset() {
  const bill = computeBill(state.billResults, state.holdCents);
  state.history.unshift({
    id: newId(),
    dateLabel: formatSaturday(getCutoffPhase(new Date()).saturday),
    itemCount: state.basket.length,
    chargedCents: bill.charged,
    deliveryStatus: "Delivered Saturday 11:42, photo confirmed",
    sample: false,
    bill,
    items: state.billResults,
  });
  state.basket = [];
  state.basketStatus = "open";
  state.holdCents = null;
  state.billResults = null;
  state.confirmingClose = false;
  $("screen-bill").innerHTML = ""; // drop the stale rendered bill now that it's archived
  goToHome();
}

// ---------- Screen 3: History ----------

function renderHistoryScreen() {
  const el = $("screen-history");
  if (state.historyDetailId) {
    const entry = state.history.find((h) => h.id === state.historyDetailId);
    el.innerHTML = `
      <button type="button" id="backToHistoryBtn" class="btn-secondary back-btn">Back to history</button>
      <div class="card">
        <h2>${entry.dateLabel} ${entry.sample ? '<span class="badge">Sample</span>' : ""}</h2>
        <div class="bill-lines">${entry.items.map(billLineHtml).join("")}</div>
      </div>
      ${paymentCardHtml(entry.bill)}
      <div class="card">
        <p class="delivery-status">${entry.deliveryStatus}</p>
      </div>`;
    return;
  }

  el.innerHTML = `
    <button type="button" id="backHomeFromHistoryBtn" class="btn-secondary back-btn">Back to home</button>
    <h2>History</h2>
    ${state.history.length === 0 ? '<p class="hint">No past weeks yet.</p>' : ""}
    <div class="history-list">
      ${state.history
        .map(
          (h) => `
        <button type="button" class="history-row" data-history-id="${h.id}">
          <span class="history-date">${h.dateLabel} ${h.sample ? '<span class="badge">Sample</span>' : ""}</span>
          <span class="history-meta">${h.itemCount} item${h.itemCount === 1 ? "" : "s"} · ${centsToStr(h.chargedCents)}</span>
          <span class="history-status">${h.deliveryStatus}</span>
        </button>`
        )
        .join("")}
    </div>`;
}

// ---------- event wiring (attached once; screens rebuild their innerHTML) ----------

function handleHomeClick(e) {
  const line = e.target.closest(".basket-line");
  if (line) {
    const lineId = line.dataset.lineId;
    const l = state.basket.find((x) => x.lineId === lineId);
    if (!l) return;
    if (e.target.closest('[data-action="inc"]')) changeQty(lineId, stepForUnit(l.unit));
    else if (e.target.closest('[data-action="dec"]')) changeQty(lineId, -stepForUnit(l.unit));
    else if (e.target.closest('[data-action="remove"]')) removeLine(lineId);
    return;
  }
  const suggestion = e.target.closest(".suggestion-item");
  if (suggestion) {
    addCatalogItem(getItem(suggestion.dataset.itemId));
    return;
  }
  if (e.target.id === "historyBtn") return goToHistory();
  if (e.target.id === "closeListBtn") {
    state.confirmingClose = true;
    renderSummaryBar();
    return;
  }
  if (e.target.id === "cancelCloseBtn") {
    state.confirmingClose = false;
    renderSummaryBar();
    return;
  }
  if (e.target.id === "confirmCloseBtn") {
    const summary = basketSummary(state.basket);
    state.holdCents = computeHold(summary);
    state.basketStatus = "closed";
    state.confirmingClose = false;
    renderBasketAndSummary();
    return;
  }
  if (e.target.id === "reopenBtn") {
    state.basketStatus = "open";
    state.holdCents = null;
    renderBasketAndSummary();
    return;
  }
  if (e.target.id === "viewBillBtn") return goToBill();
}

function handleHomeChange(e) {
  if (e.target.matches(".sub-select")) {
    const line = e.target.closest(".basket-line");
    setSubstitution(line.dataset.lineId, e.target.value);
  }
}

function handleHomeInput(e) {
  if (!e.target.matches("#itemInput")) return;
  state.suggestionQuery = e.target.value;
  state.suggestionItems = searchCatalog(state.suggestionQuery, CATALOG_ITEMS);
  state.suggestionHighlight = 0;
  renderSuggestions();
}

function handleHomeKeydown(e) {
  if (!e.target.matches("#itemInput")) return;
  const hasSuggestions = state.suggestionItems.length > 0;

  if (e.key === "ArrowDown") {
    if (hasSuggestions) {
      e.preventDefault();
      state.suggestionHighlight = (state.suggestionHighlight + 1) % state.suggestionItems.length;
      renderSuggestions();
    }
    return;
  }
  if (e.key === "ArrowUp") {
    if (hasSuggestions) {
      e.preventDefault();
      state.suggestionHighlight = (state.suggestionHighlight - 1 + state.suggestionItems.length) % state.suggestionItems.length;
      renderSuggestions();
    }
    return;
  }
  if (e.key === " ") {
    // Only treat space as "confirm the highlighted suggestion" once the typed
    // text already fully names it — otherwise let it type normally, so a
    // multi-word query (e.g. "green onion") can still be composed even though
    // "green" alone already highlights a different item ("Green bell pepper").
    if (hasSuggestions) {
      const candidate = state.suggestionItems[state.suggestionHighlight];
      if (isExactNameOrAlias(candidate, state.suggestionQuery)) {
        e.preventDefault();
        addCatalogItem(candidate);
      }
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (hasSuggestions) addCatalogItem(state.suggestionItems[state.suggestionHighlight]);
    else if (state.suggestionQuery.trim()) addCustomItem(state.suggestionQuery);
    return;
  }
}

function handleHomeBlur(e) {
  if (!e.target.matches("#itemInput")) return;
  setTimeout(() => {
    state.suggestionItems = [];
    renderSuggestions();
  }, 150);
}

function handleBillClick(e) {
  if (e.target.id === "simulateBtn") {
    state.billResults = simulateMarketRun(state.basket);
    renderBillScreen();
    return;
  }
  if (e.target.id === "doneBillBtn") return archiveWeekAndReset();
  if (e.target.id === "backHomeBtn") return goToHome();
}

function handleHistoryClick(e) {
  const row = e.target.closest(".history-row");
  if (row) {
    state.historyDetailId = row.dataset.historyId;
    renderHistoryScreen();
    return;
  }
  if (e.target.id === "backHomeFromHistoryBtn") return goToHome();
  if (e.target.id === "backToHistoryBtn") {
    state.historyDetailId = null;
    renderHistoryScreen();
  }
}

function init() {
  $("screen-home").addEventListener("click", handleHomeClick);
  $("screen-home").addEventListener("change", handleHomeChange);
  $("screen-home").addEventListener("input", handleHomeInput);
  $("screen-home").addEventListener("keydown", handleHomeKeydown);
  $("screen-home").addEventListener("blur", handleHomeBlur, true);
  $("screen-bill").addEventListener("click", handleBillClick);
  $("screen-history").addEventListener("click", handleHistoryClick);

  goToHome();
  setInterval(renderCountdown, 30000);
}

init();
