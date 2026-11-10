import { useMemo } from 'react';
import { buildCtx, coverageStats } from '../logic/engine';

export default function Dashboard({ state, month, roster, issues, goTo }) {
  const ctx = useMemo(() => buildCtx(state), [state]);
  const stats = useMemo(() => (roster ? coverageStats(state, month, roster) : null), [state, month, roster]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  let req = 0, ok = 0;
  if (stats) Object.values(stats).forEach((s) => { req += s.req; ok += s.ok; });
  const pct = req ? Math.round((ok / req) * 100) : 0;

  const brandRows = state.brands.map((b) => {
    const ps = state.processes.filter((p) => p.brandId === b.id);
    const emps = new Set();
    ps.forEach((p) => (ctx.procEmps.get(p.id) || []).forEach((e) => emps.add(e)));
    let r = 0, o = 0;
    ps.forEach((p) => { if (stats && stats[p.id]) { r += stats[p.id].req; o += stats[p.id].ok; } });
    const pod = state.pods.find((x) => x.id === b.podId);
    return { b, pod: pod ? pod.name : '-', procs: ps.length, emps: emps.size, req: r, ok: o, gaps: r - o };
  }).sort((a, b) => b.gaps - a.gaps);

  const podRows = state.pods.map((p) => {
    const lead = state.employees.find((e) => e.id === p.leadId);
    return {
      p, lead: lead ? lead.name : '-',
      emps: state.employees.filter((e) => e.podId === p.id).length,
      brands: state.brands.filter((b) => b.podId === p.id).length,
      gaps: brandRows.filter((r) => r.b.podId === p.id).reduce((s, r) => s + r.gaps, 0),
    };
  });

  const leaves = state.leaves.filter((l) => l.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  const empName = (id) => (state.employees.find((e) => e.id === id) || {}).name;
  const singles = brandRows.filter((r) => r.emps === 1).length;

  return (
    <div>
      {!roster && (
        <div className="banner">
          No roster generated for this month yet.{' '}
          <button className="btn" onClick={() => goTo('roster')}>Go to Roster &amp; generate</button>
        </div>
      )}
      <div className="cards">
        <div className="stat"><b>{state.employees.length}</b><span>Employees</span></div>
        <div className="stat"><b>{state.pods.length}</b><span>Pods</span></div>
        <div className="stat"><b>{state.brands.length}</b><span>Brands ({singles} single-resource)</span></div>
        <div className="stat"><b>{state.processes.length}</b><span>Processes</span></div>
        <div className={'stat ' + (errors ? 'bad' : 'good')}><b>{roster ? errors : '-'}</b><span>Errors</span></div>
        <div className="stat warn"><b>{roster ? warnings : '-'}</b><span>Warnings</span></div>
        <div className={'stat ' + (pct === 100 ? 'good' : 'bad')}><b>{roster ? pct + '%' : '-'}</b><span>Coverage met</span></div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Brand coverage (worst first)</h3>
          <div className="scroll" style={{ maxHeight: 420 }}>
            <table className="tbl">
              <thead><tr><th>Brand</th><th>Pod</th><th>Type</th><th>Procs</th><th>Coverage</th><th>Gap days</th></tr></thead>
              <tbody>
                {brandRows.map((r) => (
                  <tr key={r.b.id}>
                    <td>{r.b.name}</td><td>{r.pod}</td>
                    <td>{r.emps === 1 ? 'Single' : r.emps + ' staff'}</td>
                    <td>{r.procs}</td>
                    <td>{roster && r.req ? Math.round((r.ok / r.req) * 100) + '%' : '-'}</td>
                    <td className={roster && r.gaps ? 'txt-bad' : ''}>{roster ? r.gaps : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="card">
            <h3>Pods</h3>
            <table className="tbl">
              <thead><tr><th>Pod</th><th>Lead</th><th>Staff</th><th>Brands</th><th>Gaps</th></tr></thead>
              <tbody>
                {podRows.map((r) => (
                  <tr key={r.p.id}><td>{r.p.name}</td><td>{r.lead}</td><td>{r.emps}</td><td>{r.brands}</td>
                    <td className={roster && r.gaps ? 'txt-bad' : ''}>{roster ? r.gaps : '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Leaves &amp; comp-offs this month</h3>
            {leaves.length === 0 && <p className="muted">None.</p>}
            <ul className="plain">
              {leaves.map((l) => (
                <li key={l.id}>{l.date} – {empName(l.employeeId)} ({l.type === 'CO' ? 'Comp-off' : 'Leave'})</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}