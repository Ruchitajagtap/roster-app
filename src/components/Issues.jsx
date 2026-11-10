import { useState } from 'react';
import { suggestBackups, autoCover, uid } from '../logic/engine';

export default function Issues({ state, update, month, roster, issues }) {
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  if (!roster) return <div className="banner">Generate a roster for this month first (Roster tab).</div>;

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const list = issues.filter((i) => filter === 'all' || i.severity === filter).slice(0, 300);

  const assign = (issue, empId) =>
    update((s) => { s.covers.push({ id: uid(), employeeId: empId, processId: issue.processId, date: issue.date }); });

  const resolveAll = () =>
    update((s) => { s.covers = autoCover(s, month, s.rosters[month]); });

  return (
    <div>
      <div className="card toolbar">
        <b>{errors} errors</b> · <b>{warnings} warnings</b>
        <span className="spacer" />
        <div className="seg">
          {['all', 'error', 'warning'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
        <button className="btn primary" onClick={resolveAll}>Auto-cover all coverage gaps</button>
      </div>
      <p className="muted">
        Errors = mandatory rules (client coverage, weekly off). Warnings = preferences / soft rules.
        “Auto-cover” only adds temporary backup cover; the manager can review or remove it under Data → Leaves &amp; Covers.
      </p>

      {list.length === 0 && <div className="banner good">No issues. The roster is valid.</div>}

      {list.map((i) => (
        <div key={i.id} className={'issue ' + i.severity}>
          <div className="issue-head">
            <span className={'badge ' + i.severity}>{i.severity}</span>
            <span className="badge">{i.type}</span>
            <span>{i.message}</span>
            {i.type === 'coverage' && (
              <button className="btn small" onClick={() => setOpen(open === i.id ? null : i.id)}>
                {open === i.id ? 'Hide backups' : 'Find backup'}
              </button>
            )}
          </div>
          <div className="muted">{i.hint}</div>
          {open === i.id && i.type === 'coverage' && (
            <div className="suggest">
              {suggestBackups(state, month, roster, i).map((s) => (
                <div key={s.empId} className="sug-row">
                  <b>{s.name}</b> <span className="muted">{s.reasons}</span>
                  <button className="btn small primary" onClick={() => assign(i, s.empId)}>Assign cover</button>
                </div>
              ))}
              {suggestBackups(state, month, roster, i).length === 0 && <span className="txt-bad">No available backup found.</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}