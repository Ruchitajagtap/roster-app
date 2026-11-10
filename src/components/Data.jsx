import { useState } from 'react';
import { RULES, uid } from '../logic/engine';
import { WEEKDAYS } from '../logic/dates';

const TABS = ['Employees', 'Pods', 'Brands & Processes', 'Assignments', 'Holidays', 'Leaves & Covers'];

export default function Data({ state, update }) {
  const [tab, setTab] = useState(TABS[0]);
  return (
    <div>
      <div className="seg" style={{ marginBottom: 12 }}>
        {TABS.map((t) => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'Employees' && <Employees state={state} update={update} />}
      {tab === 'Pods' && <Pods state={state} update={update} />}
      {tab === 'Brands & Processes' && <Brands state={state} update={update} />}
      {tab === 'Assignments' && <Assignments state={state} update={update} />}
      {tab === 'Holidays' && <Holidays state={state} update={update} />}
      {tab === 'Leaves & Covers' && <LeavesCovers state={state} update={update} />}
    </div>
  );
}

const empName = (state, id) => (state.employees.find((e) => e.id === id) || {}).name || id;
const procLabel = (state, p) => {
  const b = state.brands.find((x) => x.id === p.brandId);
  return `${b ? b.name : '?'} – ${p.name}`;
};

/* ---------------- Employees ---------------- */
function Employees({ state, update }) {
  const [name, setName] = useState('');
  const [podId, setPodId] = useState(state.pods[0] ? state.pods[0].id : '');

  const add = () => {
    if (!name.trim()) return;
    update((s) => { s.employees.push({ id: uid(), name: name.trim(), podId: podId || (s.pods[0] && s.pods[0].id) || '', prefOff: [] }); });
    setName('');
  };
  const set = (id, patch) => update((s) => { Object.assign(s.employees.find((e) => e.id === id), patch); });
  const remove = (id) => {
    if (!window.confirm('Delete this employee with their assignments, leaves and covers?')) return;
    update((s) => {
      s.employees = s.employees.filter((e) => e.id !== id);
      s.assignments = s.assignments.filter((a) => a.employeeId !== id);
      s.leaves = s.leaves.filter((l) => l.employeeId !== id);
      s.covers = s.covers.filter((c) => c.employeeId !== id);
      s.pods.forEach((p) => { if (p.leadId === id) p.leadId = ''; });
    });
  };
  const togglePref = (e, wd) =>
    set(e.id, { prefOff: (e.prefOff || []).includes(wd) ? e.prefOff.filter((x) => x !== wd) : [...(e.prefOff || []), wd] });

  return (
    <div className="card">
      <h3>Employees ({state.employees.length})</h3>
      <div className="toolbar">
        <input placeholder="New employee name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={podId} onChange={(e) => setPodId(e.target.value)}>
          {state.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn primary" onClick={add}>Add employee</button>
      </div>
      <div className="scroll" style={{ maxHeight: 520 }}>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Pod</th><th>Preferred weekly-off days (soft)</th><th></th></tr></thead>
          <tbody>
            {state.employees.map((e) => (
              <tr key={e.id}>
                <td><input value={e.name} onChange={(ev) => set(e.id, { name: ev.target.value })} /></td>
                <td>
                  <select value={e.podId} onChange={(ev) => set(e.id, { podId: ev.target.value })}>
                    {state.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td>
                  {WEEKDAYS.map((w, i) => (
                    <label key={w} className="chk">
                      <input type="checkbox" checked={(e.prefOff || []).includes(i)} onChange={() => togglePref(e, i)} />{w}
                    </label>
                  ))}
                </td>
                <td><button className="btn small danger" onClick={() => remove(e.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Pods ---------------- */
function Pods({ state, update }) {
  const [name, setName] = useState('');
  const set = (id, patch) => update((s) => { Object.assign(s.pods.find((p) => p.id === id), patch); });
  const remove = (id) => {
    if (state.employees.some((e) => e.podId === id) || state.brands.some((b) => b.podId === id)) {
      window.alert('Move the employees and brands of this pod elsewhere first.');
      return;
    }
    update((s) => { s.pods = s.pods.filter((p) => p.id !== id); });
  };
  return (
    <div className="card">
      <h3>Pods &amp; pod leads</h3>
      <div className="toolbar">
        <input placeholder="New pod name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" onClick={() => { if (name.trim()) { update((s) => { s.pods.push({ id: uid(), name: name.trim(), leadId: '' }); }); setName(''); } }}>Add pod</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Pod</th><th>Lead</th><th></th></tr></thead>
        <tbody>
          {state.pods.map((p) => (
            <tr key={p.id}>
              <td><input value={p.name} onChange={(e) => set(p.id, { name: e.target.value })} /></td>
              <td>
                <select value={p.leadId} onChange={(e) => set(p.id, { leadId: e.target.value })}>
                  <option value="">— none —</option>
                  {state.employees.filter((e) => e.podId === p.id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </td>
              <td><button className="btn small danger" onClick={() => remove(p.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Brands & Processes ---------------- */
function Brands({ state, update }) {
  const [name, setName] = useState('');
  const [podId, setPodId] = useState(state.pods[0] ? state.pods[0].id : '');

  const setBrand = (id, patch) => update((s) => { Object.assign(s.brands.find((b) => b.id === id), patch); });
  const removeBrand = (id) => {
    if (!window.confirm('Delete this brand and all its processes?')) return;
    update((s) => {
      const ids = s.processes.filter((p) => p.brandId === id).map((p) => p.id);
      s.processes = s.processes.filter((p) => p.brandId !== id);
      s.assignments = s.assignments.filter((a) => !ids.includes(a.processId));
      s.covers = s.covers.filter((c) => !ids.includes(c.processId));
      s.brands = s.brands.filter((b) => b.id !== id);
    });
  };
  const addProcess = (brandId) =>
    update((s) => { s.processes.push({ id: uid(), brandId, name: 'Customer Support', rule: 'NO_SUN_HOL', minStaff: 1, minOverrides: {} }); });
  const setProc = (id, patch) => update((s) => { Object.assign(s.processes.find((p) => p.id === id), patch); });
  const setOverride = (id, wd, val) =>
    update((s) => {
      const p = s.processes.find((x) => x.id === id);
      if (!p.minOverrides) p.minOverrides = {};
      if (val === '') delete p.minOverrides[wd]; else p.minOverrides[wd] = Number(val);
    });
  const removeProc = (id) =>
    update((s) => {
      s.processes = s.processes.filter((p) => p.id !== id);
      s.assignments = s.assignments.filter((a) => a.processId !== id);
      s.covers = s.covers.filter((c) => c.processId !== id);
    });

  return (
    <div>
      <div className="card">
        <h3>Add brand</h3>
        <div className="toolbar">
          <input placeholder="Brand name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={podId} onChange={(e) => setPodId(e.target.value)}>
            {state.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn primary" onClick={() => { if (name.trim()) { update((s) => { s.brands.push({ id: uid(), name: name.trim(), podId: podId || (s.pods[0] && s.pods[0].id) || '' }); }); setName(''); } }}>Add brand</button>
        </div>
        <p className="muted">
          Calendar rule = the BRAND/PROCESS operating days. “Day overrides” = minimum staff on a specific weekday
          (blank = use default min; 0 = no coverage needed that weekday).
        </p>
      </div>

      <datalist id="ptypes">
        <option value="Customer Support" /><option value="Abandoned Cart" /><option value="NDR" /><option value="Retention" />
      </datalist>

      {state.brands.map((b) => (
        <div className="card" key={b.id}>
          <div className="toolbar">
            <input value={b.name} onChange={(e) => setBrand(b.id, { name: e.target.value })} />
            <select value={b.podId} onChange={(e) => setBrand(b.id, { podId: e.target.value })}>
              {state.pods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="btn small" onClick={() => addProcess(b.id)}>+ Process</button>
            <button className="btn small danger" onClick={() => removeBrand(b.id)}>Delete brand</button>
          </div>
          <div className="scroll">
            <table className="tbl">
              <thead>
                <tr><th>Process</th><th>Calendar rule</th><th>Min staff</th><th>Day overrides (Sun…Sat)</th><th></th></tr>
              </thead>
              <tbody>
                {state.processes.filter((p) => p.brandId === b.id).map((p) => (
                  <tr key={p.id}>
                    <td><input list="ptypes" value={p.name} onChange={(e) => setProc(p.id, { name: e.target.value })} /></td>
                    <td>
                      <select value={p.rule} onChange={(e) => setProc(p.id, { rule: e.target.value })}>
                        {Object.entries(RULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="0" style={{ width: 60 }} value={p.minStaff}
                      onChange={(e) => setProc(p.id, { minStaff: e.target.value === '' ? '' : Number(e.target.value) })} /></td>
                    <td>
                      {WEEKDAYS.map((w, i) => (
                        <input key={w} type="number" min="0" placeholder={w} title={w} style={{ width: 44, marginRight: 2 }}
                          value={p.minOverrides && p.minOverrides[i] !== undefined ? p.minOverrides[i] : ''}
                          onChange={(e) => setOverride(p.id, i, e.target.value)} />
                      ))}
                    </td>
                    <td><button className="btn small danger" onClick={() => removeProc(p.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Assignments ---------------- */
function Assignments({ state, update }) {
  const add = (processId, employeeId) => {
    if (!employeeId) return;
    update((s) => {
      if (!s.assignments.some((a) => a.processId === processId && a.employeeId === employeeId)) {
        s.assignments.push({ id: uid(), employeeId, processId });
      }
    });
  };
  const remove = (id) => update((s) => { s.assignments = s.assignments.filter((a) => a.id !== id); });

  return (
    <div className="card">
      <h3>Who handles which process</h3>
      <p className="muted">One employee can handle many processes/brands; one process can have many employees.</p>
      <div className="scroll" style={{ maxHeight: 560 }}>
        <table className="tbl">
          <thead><tr><th>Brand – Process</th><th>Assigned employees</th><th>Add</th></tr></thead>
          <tbody>
            {state.processes.map((p) => (
              <tr key={p.id}>
                <td>{procLabel(state, p)}</td>
                <td>
                  {state.assignments.filter((a) => a.processId === p.id).map((a) => (
                    <span key={a.id} className="chip">{empName(state, a.employeeId)}
                      <button onClick={() => remove(a.id)}>×</button></span>
                  ))}
                </td>
                <td>
                  <select value="" onChange={(e) => add(p.id, e.target.value)}>
                    <option value="">+ add employee</option>
                    {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Holidays ---------------- */
function Holidays({ state, update }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="card">
      <h3>Public holidays</h3>
      <div className="toolbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn primary" onClick={() => {
          if (!date) return;
          update((s) => { if (!s.holidays.some((h) => h.date === date)) s.holidays.push({ date, name: name || 'Holiday' }); });
          setDate(''); setName('');
        }}>Add holiday</button>
      </div>
      <table className="tbl">
        <thead><tr><th>Date</th><th>Name</th><th></th></tr></thead>
        <tbody>
          {[...state.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
            <tr key={h.date}>
              <td>{h.date}</td><td>{h.name}</td>
              <td><button className="btn small danger" onClick={() => update((s) => { s.holidays = s.holidays.filter((x) => x.date !== h.date); })}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Leaves & Covers ---------------- */
function LeavesCovers({ state, update }) {
  const [empId, setEmpId] = useState(state.employees[0] ? state.employees[0].id : '');
  const [date, setDate] = useState('');
  const [type, setType] = useState('L');
  const sortedLeaves = [...state.leaves].sort((a, b) => a.date.localeCompare(b.date));
  const sortedCovers = [...state.covers].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="card">
        <h3>Leaves &amp; comp-offs</h3>
        <div className="toolbar">
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            {state.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="L">Planned leave</option><option value="CO">Comp-off</option>
          </select>
          <button className="btn primary" onClick={() => {
            if (!date || !empId) return;
            update((s) => { if (!s.leaves.some((l) => l.employeeId === empId && l.date === date)) s.leaves.push({ id: uid(), employeeId: empId, date, type }); });
          }}>Add</button>
        </div>
        <div className="scroll" style={{ maxHeight: 300 }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Employee</th><th>Type</th><th></th></tr></thead>
            <tbody>
              {sortedLeaves.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td><td>{empName(state, l.employeeId)}</td><td>{l.type === 'CO' ? 'Comp-off' : 'Leave'}</td>
                  <td><button className="btn small danger" onClick={() => update((s) => { s.leaves = s.leaves.filter((x) => x.id !== l.id); })}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Temporary backup covers</h3>
        {sortedCovers.length === 0 && <p className="muted">None yet. They are created from the Conflicts / Leave Impact pages.</p>}
        <table className="tbl">
          <tbody>
            {sortedCovers.map((c) => {
              const p = state.processes.find((x) => x.id === c.processId);
              return (
                <tr key={c.id}>
                  <td>{c.date}</td><td>{empName(state, c.employeeId)}</td><td>covers {p ? procLabel(state, p) : '?'}</td>
                  <td><button className="btn small danger" onClick={() => update((s) => { s.covers = s.covers.filter((x) => x.id !== c.id); })}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}