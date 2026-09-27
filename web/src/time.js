import { CUTOFF_DAY, CUTOFF_HOUR, RUN_DAY_OFFSET } from "./config.js";

function atCutoffHour(date) {
  const d = new Date(date);
  d.setHours(CUTOFF_HOUR, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Returns either:
//   { phase: 'open', cutoff, saturday, msRemaining }   -- ordering window
//   { phase: 'closed', saturday }                       -- Thu 20:00 -> Sat end blackout
export function getCutoffPhase(now = new Date()) {
  const thisThursday = addDays(atCutoffHour(now), CUTOFF_DAY - now.getDay());

  if (now < thisThursday) {
    return {
      phase: "open",
      cutoff: thisThursday,
      saturday: addDays(thisThursday, RUN_DAY_OFFSET),
      msRemaining: thisThursday - now,
    };
  }

  const saturday = addDays(thisThursday, RUN_DAY_OFFSET);
  const saturdayEnd = new Date(saturday);
  saturdayEnd.setHours(23, 59, 59, 999);

  if (now <= saturdayEnd) {
    return { phase: "closed", saturday };
  }

  const nextCutoff = addDays(thisThursday, 7);
  return {
    phase: "open",
    cutoff: nextCutoff,
    saturday: addDays(nextCutoff, RUN_DAY_OFFSET),
    msRemaining: nextCutoff - now,
  };
}

export function formatCountdown(ms) {
  if (ms <= 0) return "0 minutes";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function formatSaturday(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
