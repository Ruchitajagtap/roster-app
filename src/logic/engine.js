import { daysInMonth, weekBlocks, WEEKDAYS } from './dates';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const RULES = {
  ALL_365: '365 days (Sundays & holidays included)',
  EXCEPT_HOLIDAYS: 'Daily, public holidays off',
  NO_SUN_HOL: 'Sundays & public holidays off',
};

export const STATUS_LABEL = {
  W: 'Working',
  WO: 'Weekly off',
  PH: 'Public holiday',
  L: 'Leave',
  CO: 'Comp-off',
};

const isOff = (s) => s === 'WO' || s === 'L' || s === 'CO';

// ---------- lookup tables ----------
export function buildCtx(state) {
  const holidaySet = new Set(state.holidays.map((h) => h.date));
  const procById = new Map(state.processes.map((p) => [p.id, p]));
  const brandById = new Map(state.brands.map((b) => [b.id, b]));
  const empById = new Map(state.employees.map((e) => [e.id, e]));
  const empProcs = new Map();
  const procEmps = new Map();
  state.assignments.forEach((a) => {
    const p = procById.get(a.processId);
    if (!p || !empById.has(a.employeeId)) return;
    if (!empProcs.has(a.employeeId)) empProcs.set(a.employeeId, []);
    empProcs.get(a.employeeId).push(p);
    if (!procEmps.has(p.id)) procEmps.set(p.id, []);
    procEmps.get(p.id).push(a.employeeId);
  });
  const leaveMap = new Map();
  state.leaves.forEach((l) => leaveMap.set(l.employeeId + '|' + l.date, l.type));
  const coverMap = new Map();
  state.covers.forEach((c) => {
    const k = c.processId + '|' + c.date;
    if (!coverMap.has(k)) coverMap.set(k, []);
    coverMap.get(k).push(c.employeeId);
  });
  return { holidaySet, procById, brandById, empById, empProcs, procEmps, leaveMap, coverMap };
}

// ---------- BRAND/PROCESS calendar (demand side) ----------
export function operates(p, d, ctx) {
  const hol = ctx.holidaySet.has(d.date);
  if (p.rule === 'ALL_365') return true;
  if (p.rule === 'EXCEPT_HOLIDAYS') return !hol;
  return !hol && d.weekday !== 0; // NO_SUN_HOL
}

export function required(p, d, ctx) {
  if (!operates(p, d, ctx)) return 0;
  const o = p.minOverrides ? p.minOverrides[d.weekday] : undefined;
  if (o !== undefined && o !== null && o !== '') return Number(o);
  return Number(p.minStaff) || 0;
}

// ---------- EMPLOYEE schedule (supply side) ----------
export function baseStatus(empId, d, ctx) {
  const procs = ctx.empProcs.get(empId) || [];
  if (procs.some((p) => operates(p, d, ctx))) return 'W';
  if (ctx.holidaySet.has(d.date)) return 'PH';
  if (d.weekday === 0) return 'WO';
  return 'W';
}

export function getStatus(empId, d, ctx, roster) {
  const key = empId + '|' + d.date;
  const lv = ctx.leaveMap.get(key);
  if (lv) return lv;
  if (roster && roster.manual && roster.manual[key]) return roster.manual[key];
  const base = baseStatus(empId, d, ctx);
  if (base === 'W' && roster && roster.offs && roster.offs[key]) return 'WO';
  return base;
}

export function workingFor(p, d, ctx, roster) {
  const ids = new Set(ctx.procEmps.get(p.id) || []);
  (ctx.coverMap.get(p.id + '|' + d.date) || []).forEach((e) => {
    if (ctx.empById.has(e)) ids.add(e);
  });
  return [...ids].map((empId) => ({ empId, status: getStatus(empId, d, ctx, roster) }));
}

// ---------- VALIDATION ----------
export function validate(state, month, roster) {
  const issues = [];
  if (!roster) return issues;
  const ctx = buildCtx(state);
  const days = daysInMonth(month);
  const blocks = weekBlocks(days);
  const nm = (id) => (ctx.empById.get(id) ? ctx.empById.get(id).name : id);

  // 1. Coverage (mandatory)
  state.processes.forEach((p) => {
    const brand = ctx.brandById.get(p.brandId);
    if (!brand) return;
    const assigned = ctx.procEmps.get(p.id) || [];
    if (assigned.length === 0) {
      issues.push({
        id: 'un|' + p.id, severity: 'error', type: 'unassigned', processId: p.id, brandId: p.brandId,
        message: `${brand.name} – ${p.name}: no employee assigned.`,
        hint: 'Assign at least one employee in Data → Assignments.',
      });
      return;
    }
    days.forEach((d) => {
      const req = required(p, d, ctx);
      if (!req) return;
      const list = workingFor(p, d, ctx, roster);
      const working = list.filter((x) => x.status === 'W').length;
      if (working < req) {
        const reasons = list.filter((x) => x.status !== 'W')
          .map((x) => `${nm(x.empId)} (${STATUS_LABEL[x.status]})`).join(', ');
        issues.push({
          id: `cov|${p.id}|${d.date}`, severity: 'error', type: 'coverage', date: d.date,
          processId: p.id, brandId: p.brandId, required: req, working, shortage: req - working,
          message: `${brand.name} – ${p.name} on ${d.date} (${WEEKDAYS[d.weekday]}): ${working}/${req} working.`,
          hint: working === 0
            ? `No assigned employee is available. ${reasons}`
            : `Short by ${req - working}. Unavailable: ${reasons}`,
        });
      }
    });
  });

  // 2. Employee-level rules
  state.employees.forEach((e) => {
    blocks.forEach((b) => {
      if (b.length < 4) return;
      const has = b.some((d) => isOff(getStatus(e.id, d, ctx, roster)));
      if (!has) {
        issues.push({
          id: `wo|${e.id}|${b[0].date}`, severity: 'error', type: 'weekly-off', employeeId: e.id, date: b[0].date,
          message: `${e.name}: no weekly off in the week starting ${b[0].date}.`,
          hint: 'Give this employee a weekly off in the Roster grid (click a cell).',
        });
      }
    });

    // preference (soft)
    if (e.prefOff && e.prefOff.length) {
      days.forEach((d) => {
        if (getStatus(e.id, d, ctx, roster) === 'WO' && baseStatus(e.id, d, ctx) === 'W' && !e.prefOff.includes(d.weekday)) {
          issues.push({
            id: `pref|${e.id}|${d.date}`, severity: 'warning', type: 'preference', employeeId: e.id, date: d.date,
            message: `${e.name}: weekly off on ${d.date} (${WEEKDAYS[d.weekday]}) is not a preferred off day.`,
            hint: 'Preference only. Coverage requirements take priority.',
          });
        }
      });
    }

    // consecutive working days (soft)
    let streak = 0;
    days.forEach((d) => {
      if (getStatus(e.id, d, ctx, roster) === 'W') {
        streak++;
        if (streak === 7) {
          issues.push({
            id: `streak|${e.id}|${d.date}`, severity: 'warning', type: 'streak', employeeId: e.id, date: d.date,
            message: `${e.name}: more than 6 consecutive working days (until ${d.date}).`,
            hint: 'Consider moving a weekly off.',
          });
        }
      } else streak = 0;
    });

    // overload (soft)
    const brandsOf = new Set((ctx.empProcs.get(e.id) || []).map((p) => p.brandId));
    if (brandsOf.size > 3) {
      issues.push({
        id: `load|${e.id}`, severity: 'warning', type: 'overload', employeeId: e.id,
        message: `${e.name} is assigned to ${brandsOf.size} brands (more than 3).`,
        hint: 'Check workload.',
      });
    }
  });

  // 3. Cover entries that no longer work
  state.covers.forEach((c) => {
    if (!c.date.startsWith(month)) return;
    const d = days.find((x) => x.date === c.date);
    const p = ctx.procById.get(c.processId);
    if (!d || !p || !ctx.empById.has(c.employeeId)) return;
    const s = getStatus(c.employeeId, d, ctx, roster);
    if (s !== 'W') {
      const brand = ctx.brandById.get(p.brandId);
      issues.push({
        id: 'covbad|' + c.id, severity: 'warning', type: 'cover', date: c.date,
        message: `Cover for ${brand ? brand.name : ''} – ${p.name} on ${c.date}: ${nm(c.employeeId)} is now ${STATUS_LABEL[s]}.`,
        hint: 'Remove or reassign this cover (Data → Leaves & Covers).',
      });
    }
  });

  issues.sort((a, b) =>
    (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
    (a.date || '').localeCompare(b.date || ''));
  return issues;
}

export function coverageStats(state, month, roster) {
  const ctx = buildCtx(state);
  const days = daysInMonth(month);
  const out = {};
  state.processes.forEach((p) => {
    let req = 0, ok = 0;
    days.forEach((d) => {
      const r = required(p, d, ctx);
      if (!r) return;
      req++;
      const w = workingFor(p, d, ctx, roster).filter((x) => x.status === 'W').length;
      if (w >= r) ok++;
    });
    out[p.id] = { req, ok };
  });
  return out;
}

// ---------- GENERATION ----------
export function generateRoster(state, month, prev) {
  const ctx = buildCtx(state);
  const days = daysInMonth(month);
  const blocks = weekBlocks(days);
  const manual = prev && prev.manual ? { ...prev.manual } : {};
  const roster = { offs: {}, manual, generatedAt: new Date().toISOString() };

  // shortfall of the whole company on one day
  const dayCost = (d) => {
    let c = 0;
    state.processes.forEach((p) => {
      const r = required(p, d, ctx);
      if (!r) return;
      const w = workingFor(p, d, ctx, roster).filter((x) => x.status === 'W').length;
      if (w < r) c += r - w;
    });
    return c;
  };

  // most constrained employees first
  const tight = (e) => (ctx.empProcs.get(e.id) || []).reduce(
    (s, p) => s + 1 / ((ctx.procEmps.get(p.id) || []).length || 1), 0);
  const ordered = [...state.employees].sort((a, b) => tight(b) - tight(a));

  const offCount = {};
  const lastWd = {};

  // Pass 1: greedy weekly-off placement
  blocks.forEach((b) => {
    if (b.length < 4) return;
    ordered.forEach((e) => {
      if (b.some((d) => isOff(getStatus(e.id, d, ctx, roster)))) return;
      const cands = b.filter((d) => getStatus(e.id, d, ctx, roster) === 'W' && !manual[e.id + '|' + d.date]);
      if (!cands.length) return;
      let best = null, bestScore = Infinity;
      cands.forEach((d) => {
        const key = e.id + '|' + d.date;
        const before = dayCost(d);
        roster.offs[key] = true;
        const impact = dayCost(d) - before;
        delete roster.offs[key];
        let score = impact * 1000;                                              // HARD: coverage
        if (e.prefOff && e.prefOff.length && !e.prefOff.includes(d.weekday)) score += 10; // SOFT: preference
        const pat = lastWd[e.id] !== undefined ? lastWd[e.id] : (e.prefOff && e.prefOff.length ? e.prefOff[0] : undefined);
        if (pat !== undefined && d.weekday !== pat) score += 3;                 // consistent weekday
        score += (offCount[d.date] || 0) * 0.5;                                 // spread offs
        if (score < bestScore) { bestScore = score; best = d; }
      });
      roster.offs[e.id + '|' + best.date] = true;
      offCount[best.date] = (offCount[best.date] || 0) + 1;
      lastWd[e.id] = best.weekday;
    });
  });

  // Pass 2: repair – move offs to remove remaining gaps
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    blocks.forEach((b) => {
      if (b.length < 4) return;
      state.employees.forEach((e) => {
        const cur = b.find((d) => roster.offs[e.id + '|' + d.date]);
        if (!cur) return;
        const curKey = e.id + '|' + cur.date;
        let bestAlt = null, bestGain = 0;
        b.forEach((alt) => {
          if (alt.date === cur.date) return;
          const altKey = e.id + '|' + alt.date;
          if (manual[altKey]) return;
          if (getStatus(e.id, alt, ctx, roster) !== 'W') return;
          const before = dayCost(cur) + dayCost(alt);
          delete roster.offs[curKey];
          roster.offs[altKey] = true;
          const after = dayCost(cur) + dayCost(alt);
          delete roster.offs[altKey];
          roster.offs[curKey] = true;
          if (before - after > bestGain) { bestGain = before - after; bestAlt = alt; }
        });
        if (bestAlt) {
          delete roster.offs[curKey];
          roster.offs[e.id + '|' + bestAlt.date] = true;
          improved = true;
        }
      });
    });
    if (!improved) break;
  }
  return roster;
}

// ---------- BACKUP SUGGESTIONS ----------
export function suggestBackups(state, month, roster, issue) {
  const ctx = buildCtx(state);
  const d = daysInMonth(month).find((x) => x.date === issue.date);
  const p = ctx.procById.get(issue.processId);
  if (!d || !p) return [];
  const brand = ctx.brandById.get(p.brandId);
  const already = new Set([...(ctx.procEmps.get(p.id) || []), ...(ctx.coverMap.get(p.id + '|' + d.date) || [])]);
  const out = [];
  state.employees.forEach((e) => {
    if (already.has(e.id)) return;
    if (getStatus(e.id, d, ctx, roster) !== 'W') return;
    const mine = ctx.empProcs.get(e.id) || [];
    const load = mine.filter((x) => operates(x, d, ctx)).length +
      state.covers.filter((c) => c.employeeId === e.id && c.date === d.date).length;
    const samePod = brand && e.podId === brand.podId;
    const sameType = mine.some((x) => x.name === p.name);
    const score = (samePod ? 30 : 0) + (sameType ? 20 : 0) - load * 5;
    const reasons = [];
    if (samePod) reasons.push('same pod');
    if (sameType) reasons.push('already does ' + p.name);
    reasons.push(load === 0 ? 'free that day' : `${load} process(es) already that day`);
    out.push({ empId: e.id, name: e.name, score, reasons: reasons.join(', ') });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

// assign best backup to every coverage gap (or only the given issue ids)
export function autoCover(state, month, roster, onlyIds) {
  const issues = validate(state, month, roster).filter(
    (i) => i.type === 'coverage' && (!onlyIds || onlyIds.has(i.id)));
  const covers = [...state.covers];
  issues.forEach((i) => {
    for (let k = 0; k < i.shortage; k++) {
      const s = suggestBackups({ ...state, covers }, month, roster, i)[0];
      if (!s) break;
      covers.push({ id: uid(), employeeId: s.empId, processId: i.processId, date: i.date });
    }
  });
  return covers;
}