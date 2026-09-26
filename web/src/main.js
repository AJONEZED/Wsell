import { runWeeklyCycle } from "./pipeline.js";

const $ = (id) => document.getElementById(id);

function fmt(n) {
  return `$${n.toFixed(2)}`;
}

function render(result) {
  const { band, check, bills } = result;

  const flagHtml = check.flagged
    ? `<p class="flag flag-bad">⚠ Flagged — receipt is ${(check.deviationPct * 100).toFixed(1)}% off the expected price band.</p>`
    : `<p class="flag flag-ok">✓ Within expected price band.</p>`;

  const bandHtml = `<p class="hint">Expected: ${fmt(band.low)} – ${fmt(band.high)} (band center ${fmt(band.expectedTotal)})</p>`;

  const billsHtml = bills
    .map(
      (b) => `
      <div class="bill">
        <h3>Household ${b.id}</h3>
        <table>
          <tr><td>Wholesale passthrough</td><td>${fmt(b.wholesaleCost)}</td></tr>
          <tr><td>Platform fee</td><td>${fmt(b.platformFee)}</td></tr>
          <tr><td>Runner fee share</td><td>${fmt(b.runnerFeeShare)}</td></tr>
          <tr class="total"><td>Total</td><td>${fmt(b.total)}</td></tr>
        </table>
      </div>`
    )
    .join("");

  $("resultsBody").innerHTML = flagHtml + bandHtml + billsHtml;
  $("results").classList.remove("hidden");
}

function runCycle() {
  const households = [
    { id: "A", qty: parseFloat($("qtyA").value) || 0 },
    { id: "B", qty: parseFloat($("qtyB").value) || 0 },
  ];
  const unitPrice = parseFloat($("feedPrice").value) || 0;
  const receiptTotal = parseFloat($("receiptTotal").value) || 0;
  const runnerFlatFee = parseFloat($("runnerFee").value) || 0;

  const result = runWeeklyCycle({ households, unitPrice, receiptTotal, runnerFlatFee });
  render(result);
}

$("runBtn").addEventListener("click", runCycle);
runCycle();
