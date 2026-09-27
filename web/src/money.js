// All money is handled in integer cents. This file is the only place that
// formats cents into a display string.
export function centsToStr(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function fmtRange(lowCents, highCents) {
  return `${centsToStr(lowCents)} to ${centsToStr(highCents)}`;
}
