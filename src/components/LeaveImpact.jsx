import { useEffect, useMemo, useState } from 'react';
import { daysInMonth } from '../logic/dates';
import {
  buildCtx, getStatus, workingFor, required, validate, autoCover, suggestBackups, uid,
} from '../logic/engine';

export default function LeaveImpact({ state, update, month, roster }) {
  const [empId, setEmpId] = useState(state.employees[0] ? state.employees[0].id : '');
  const [type, setType] = useState('L');
  const [from, setFrom] = useState(`${month}-20`);
  const [to, setTo] = useState(`${month}-20`);

  useEffect(() => { setFrom(`${month}-20`); setTo(`${month}-20`); }, [month]);

  const preview = useMemo(() => {
    if (!roster || !empId) return null;
    const days = daysInMonth(month);
    const dates = days.filter((d) => d.date >= from && d.date <= to);
    if (!dates.length) return null;
    const fresh = dates.filter((d) => !state.leaves.some((l) => l.employeeId === empId && l.date === d.date));
    const after = {
      ...state,
      leaves: [...state.leaves, ...fresh.map((d) => ({ id: 'tmp', employeeId: empId, date: d.date, type }))],
    };
    const ctxB = buildCtx(state);
    const ctxA = buildCtx(after);
    const procs = [...new Map((ctxB.empProcs.get(empId) || []).map((p) => [p.id, p])).values()];
    const rows = [];
    procs.forEach((p) => {
      dates.forEach((d) => {
        const req = required(p, d, ctxB);
        if (!req) return;
        if (getStatus(empId, d, ctxB, roster) !== 'W') return;
        const wb = workingFor(p, d, ctxB, roster).filter((x) => x.status === 'W').length;
        const wa = workingFor(p, d, ctxA, roster).filter((x) => x.status === 'W').length;
        rows.push({
          key: p.id + d.date, date: d.date, req, wb, wa, ok: wa >= req,
          label: `${(ctxB.brandById.get(p.brandId) || {}).name} – ${p.name}`,
        });
      });
    });
    const beforeIds = new Set(validate(state, month, roster).map((i) => i.id));
    const newIssues = validate(after, month, roster).filter((i) => !beforeIds.has(i.id) && i.type === 'coverage');
    return { fresh, rows, newIssues, after };
  }, [state, roster, empId, from, to, type, month]);

  if (!roster) return <div className="banner">Generate a roster for this month first (Roster tab).</div>;

  const approve = (withCover) =>
    update((s) => {
      preview.fresh.forEach((d) => s.leaves.push({ id: uid(), employeeId: empId, date: d.date, type }));
      if (withCover) {
        const ids = new Set(preview.newIssues.map((i) => i.id));
        s.covers = autoCover(s, month, s.rosters[month], ids);
      }
    });

  return (
    <div>
      <div className="card">
        <h3>Handle a change: new leave / comp-off</h3>
        <div className="toolbar">
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="L">Planned leave</option>
            <option value="CO">Comp-off</option>
          </select>
          <label>From <input type="date" value={from} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To <input type="date" value={to} min={`${month}-01`} max={`${month}-31`} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <p className="muted">The roster is NOT changed until you approve. This is a live “what-if” preview.</p>
      </div>

      {preview && (
        <div className="card">
          <h3>Impact preview</h3>
          {preview.rows.length === 0 && <p>This employee had no required working duty on these dates, so there is no coverage impact.</p>}
          {preview.rows.length > 0 && (
            <table className="tbl">
              <thead><tr><th>Date</th><th>Brand – Process</th><th>Required</th><th>Working before</th><th>Working after</th><th>Verdict</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.key}>
                    <td>{r.date}</td><td>{r.label}</td><td>{r.req}</td><td>{r.wb}</td><td>{r.wa}</td>
                    <td className={r.ok ? 'txt-good' : 'txt-bad'}>
                      {r.ok ? 'Remaining team can cover' : 'COVERAGE GAP'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {preview.newIssues.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <b className="txt-bad">{preview.newIssues.length} new coverage gap(s) would appear:</b>
              {preview.newIssues.map((i) => (
                <div key={i.id} className="issue error">
                  <div>{i.message}</div>
                  <div className="muted">{i.hint}</div>
                  <div className="muted">
                    Possible backups:{' '}
                    {suggestBackups(preview.after, month, roster, i).slice(0, 3)
                      .map((s) => `${s.name} (${s.reasons})`).join(' | ') || 'none available'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="toolbar" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => approve(false)} disabled={!preview.fresh.length}>Approve leave (leave gaps for manual fix)</button>
            <button className="btn primary" onClick={() => approve(true)} disabled={!preview.fresh.length}>Approve leave + auto-assign backup cover</button>
          </div>
        </div>
      )}
    </div>
  );
}