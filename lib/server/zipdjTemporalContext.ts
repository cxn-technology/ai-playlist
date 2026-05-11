/** YYYY-MM-DD in local calendar (not UTC) for human-readable chart windows. */
function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMondayWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0 Sun … 6 Sat
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  return x;
}

function endOfSundayWeek(monday: Date): Date {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  return sun;
}

/**
 * When the user implies a calendar window, inject explicit local dates into the web-research prompt.
 * Keeps “this week / this year / last N days” grounded in request time (not model hallucination).
 */
export function computeTemporalContext(userPrompt: string, now: Date = new Date()): string | null {
  const p = userPrompt.toLowerCase();

  if (/\bthis week\b|\bthis week's\b|\bweek's chart\b|\bweekly chart\b/.test(p)) {
    const mon = startOfMondayWeek(now);
    const sun = endOfSundayWeek(mon);
    return `Chart/list window for “this week”: ${isoLocal(mon)} through ${isoLocal(sun)} inclusive (local week Mon–Sun). Prefer pages or chart dates inside or immediately before this span.`;
  }

  if (/\bthis month\b|\bthis month's\b/.test(p)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `Window for “this month”: ${isoLocal(start)} through ${isoLocal(end)} inclusive.`;
  }

  if (/\bthis year\b|\bthis year's\b|\byear to date\b|\bytd\b/.test(p)) {
    const start = new Date(now.getFullYear(), 0, 1);
    return `Window for “this year” / YTD: ${isoLocal(start)} through ${isoLocal(now)} (${now.getFullYear()}).`;
  }

  const mDays = p.match(/\b(?:last|past)\s+(\d+)\s+days?\b/);
  if (mDays) {
    const n = Math.min(366, Math.max(1, parseInt(mDays[1], 10)));
    const from = new Date(now);
    from.setDate(from.getDate() - n);
    from.setHours(0, 0, 0, 0);
    return `Rolling window (~${n} days): prioritize material from ${isoLocal(from)} through ${isoLocal(now)}.`;
  }

  const mWeeks = p.match(/\b(?:last|past)\s+(\d+)\s+weeks?\b/);
  if (mWeeks) {
    const w = Math.min(52, Math.max(1, parseInt(mWeeks[1], 10)));
    const from = new Date(now);
    from.setDate(from.getDate() - w * 7);
    from.setHours(0, 0, 0, 0);
    return `Rolling window (~${w} weeks): prioritize material from ${isoLocal(from)} through ${isoLocal(now)}.`;
  }

  return null;
}
