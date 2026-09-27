// Business constants. Change these, not the math that uses them.
export const MEMBERSHIP_FEE_CENTS = 2500; // $25/month, charged whether or not the household orders
export const RUNNER_FEE_CENTS = 1500; // $15 per run
export const ZONE_HOUSEHOLDS = 6; // simulated households sharing a runner
export const RUNNER_SHARE_CENTS = Math.round(RUNNER_FEE_CENTS / ZONE_HOUSEHOLDS); // $2.50

export const ESTIMATE_BAND_PCT = 0.08; // +/-8% shown while building the list
export const MARKET_VARIANCE_PCT = 0.12; // +/-12% used by the demo market-run simulator
export const HOLD_BUFFER_PCT = 0.10; // buffer above the high estimate when placing the card hold

export const CUTOFF_DAY = 4; // Thursday (Date#getDay(): 0=Sun..6=Sat)
export const CUTOFF_HOUR = 20; // 20:00 local time
export const RUN_DAY_OFFSET = 2; // Saturday = Thursday + 2 days
