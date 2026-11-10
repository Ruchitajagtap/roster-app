import { useMemo, useState } from 'react';
import { daysInMonth, WEEKDAYS } from '../logic/dates';
import { buildCtx, getStatus, workingFor, required, generateRoster, STATUS_LABEL } from '../logic/engine';

const SHORT = { W: 'W', WO: 'OFF', PH: 'PH', L: 'L', CO: 'CO' };
const VIEWS = [
  ['company', 'Company'], ['pod', 'Pod'], ['brand', 'Brand'], ['process', 'Process'], ['employee', 'Employee'],
];

export default function Roster({ state, update, month, roster }) {
  const [view, setView] = useState('company');
  const [sel, setSel] = useState({});
  const [keepManual, setKeepManual] = useState(true);
  const days = useMemo(() => daysInMonth(month), [month]);
  const ctx = useMemo(() => buildCtx(state), [state]);

  const options = useMemo(() => {
    if (view === 'pod') return state.pods.map((p) => ({ id: p.id, label: p.name }));
    if (view === 'brand') return state.brands.map((b) => ({ id: b.id, label: b.name }));
    if (view === 'process') {
      return state.processes.map((p) => ({
        id: p.id, label: `${ctx.brandById.get(p.brandId) ? ctx.brandById.get(p.brandId).name : ''} – ${p.name}`,
      }));
    }
    if (view === 'employee') return state.employees.map((e) => ({ id: e.id, label: e.name }));
    return [];
  }, [view, state, ctx]);

  const selected = sel[view] && options.some((o) => o.id === sel[view]) ? sel[view] : options[0] && options[0].id;

  const { emps, procs } = useMemo(() => {
    const monthCovers = state.covers.filter((c) => c.date.startsWith(month));
    const empsOf = (ps) => {
      const ids = new Set();
      ps.forEach((p) => {
        (ctx.procEmps.get(p.id) || []).forEach((e) => ids.add(e));
        monthCovers.filter((c) => c.processId === p.id).forEach((c) => ids.add(c.employeeId));
      });
      return state.employees.filter((e) => ids.has(e.id));
    };
    if (view === 'pod') {
      return {
        emps: state.employees.filter((e) => e.podId === selected),
        procs: state.processes.filter((p) => (ctx.brandById.get(p.brandId) || {}).podId === selected),
      };
    }
    if (view === 'brand') {
      const ps = state.processes.filter((p) => p.brandId === selected);
      return { emps: empsOf(ps), procs: ps };
    }
    if (view === 'process') {
      const ps = state.processes.filter((p) => p.id === selected);
      return { emps: empsOf(ps), procs: ps };
    }
    if (view === 'employee') {
      const ps = [...new Map((ctx.empProcs.get(selected) || []).map((p) => [p.id, p])).values()];
      return { emps: state.employees.filter((e) => e.id === selected), procs: ps };
    }
    return { emps: state.employees, procs: state.processes };
  }, [view, selected, state, ctx, month]);

  const podName = (id) => (state.pods.find((p) => p.id === id) || {}).name || '';

  const generate = () =>
    update((s) => {
      const prev = s.rosters[month];
      s.rosters[month] = generateRoster(s, month, keepManual && prev ? prev : null);
    });

  const resetManual = () => update((s) => { if (s.rosters[month]) s.rosters[month].manual = {}; });

  const toggle = (empId, d) => {
    if (!roster) return;
    const cur = getStatus(empId, d, ctx, roster);
    if (cur === 'L' || cur === 'CO') return; // approved leave can't be edited here
    const key = empId + '|' + d.date;
    update((s) => { s.rosters[month].manual[key] = cur === 'W' ? 'WO' : 'W'; });
  };

  const exportCsv = () => {
    const head = ['Employee', 'Pod', ...days.map((d) => d.date)];
    const rows = emps.map((e) => [e.name, podName(e.podId), ...days.map((d) => getStatus(e.id, d, ctx, roster))]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `roster-${month}.csv`;
    a.click();
  };

  const hdr = (d) => (ctx.holidaySet.has(d.date) ? 'hol' : d.weekday === 0 ? 'sun' : '');

  const counts = (empId) => {
    const c = { W: 0, WO: 0, PH: 0, L: 0, CO: 0 };
    days.forEach((d) => { c[getStatus(empId, d, ctx, roster)]++; });
    return c;
  };

  return (
    <div>
      <div className="card toolbar">
        <button className="btn primary" onClick={generate}>{roster ? 'Regenerate roster' : 'Generate roster'}</button>
        <label><input type="checkbox" checked={keepManual} onChange={(e) => setKeepManual(e.target.checked)} /> keep manual edits</label>
        <button className="btn" onClick={resetManual} disabled={!roster}>Clear manual edits</button>
        <button className="btn" onClick={exportCsv} disabled={!roster}>Export CSV</button>
        <span className="spacer" />
        <div className="seg">
          {VIEWS.map(([id, label]) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        {view !== 'company' && (
          <select value={selected || ''} onChange={(e) => setSel({ ...sel, [view]: e.target.value })}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        )}
      </div>

      {!roster && <div className="banner">No roster for this month. Click “Generate roster”.</div>}

      {roster && (
        <>
          <div className="legend">
            <span className="cell st-W">W</span> Working
            <span className="cell st-WO">OFF</span> Weekly off
            <span className="cell st-PH">PH</span> Public holiday
            <span className="cell st-L">L</span> Leave
            <span className="cell st-CO">CO</span> Comp-off
            <span className="muted"> — click a cell to toggle Working / Off (manual edit). Conflicts update instantly.</span>
          </div>

          {view === 'employee' && emps[0] && (() => {
            const c = counts(emps[0].id);
            return (
              <div className="card">
                <b>{emps[0].name}</b> ({podName(emps[0].podId)}) — Working {c.W}, Weekly offs {c.WO}, Holidays {c.PH},
                Leaves {c.L}, Comp-offs {c.CO}. Handles: {procs.map((p) => `${(ctx.brandById.get(p.brandId) || {}).name} – ${p.name}`).join('; ') || 'nothing'}
              </div>
            );
          })()}

          <div className="card scroll">
            <h3>Employee schedule</h3>
            <table className="grid">
              <thead>
                <tr>
                  <th className="first">Employee</th>
                  {days.map((d) => (
                    <th key={d.date} className={hdr(d)}>{d.day}<br />{WEEKDAYS[d.weekday][0]}</th>
                  ))}
                  <th>Work</th>
                </tr>
              </thead>
              <tbody>
                {emps.map((e) => {
                  let work = 0;
                  const cells = days.map((d) => {
                    const s = getStatus(e.id, d, ctx, roster);
                    if (s === 'W') work++;
                    return (
                      <td key={d.date} className={'cell st-' + s}
                        title={`${e.name} • ${d.date} • ${STATUS_LABEL[s]}`}
                        onClick={() => toggle(e.id, d)}>
                        {SHORT[s]}
                      </td>
                    );
                  });
                  return (
                    <tr key={e.id}>
                      <td className="first">{e.name}<small>{podName(e.podId)}</small></td>
                      {cells}
                      <td>{work}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card scroll">
            <h3>Coverage (working / required)</h3>
            <table className="grid">
              <thead>
                <tr>
                  <th className="first">Brand – Process</th>
                  {days.map((d) => (
                    <th key={d.date} className={hdr(d)}>{d.day}<br />{WEEKDAYS[d.weekday][0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.id}>
                    <td className="first">
                      {(ctx.brandById.get(p.brandId) || {}).name} – {p.name}
                      <small>{p.rule}, min {p.minStaff}</small>
                    </td>
                    {days.map((d) => {
                      const req = required(p, d, ctx);
                      if (!req) return <td key={d.date} className="cell cv-na">–</td>;
                      const list = workingFor(p, d, ctx, roster);
                      const w = list.filter((x) => x.status === 'W');
                      const names = w.map((x) => (ctx.empById.get(x.empId) || {}).name).join(', ');
                      return (
                        <td key={d.date} className={'cell ' + (w.length >= req ? 'cv-ok' : 'cv-bad')}
                          title={`${d.date}: ${w.length}/${req} working${names ? ' (' + names + ')' : ''}`}>
                          {w.length}/{req}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}