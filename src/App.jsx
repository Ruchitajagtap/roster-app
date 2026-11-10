import { useMemo, useState } from 'react';
import { useStore } from './store';
import { validate } from './logic/engine';
import { monthLabel } from './logic/dates';
import Dashboard from './components/Dashboard';
import Roster from './components/Roster';
import Issues from './components/Issues';
import LeaveImpact from './components/LeaveImpact';
import Data from './components/Data';

export default function App() {
  const { state, update, reset, ready } = useStore();
  const [tab, setTab] = useState('dashboard');
  const [month, setMonth] = useState('2026-11');

  const roster = state.rosters[month];
  const issues = useMemo(() => validate(state, month, roster), [state, month]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  if (!ready) return <div style={{ padding: 24 }}>Loading data from database…</div>;

  const props = { state, update, month, roster, issues, goTo: setTab };

  const tabs = [
    ['dashboard', 'Dashboard'],
    ['roster', 'Roster'],
    ['issues', 'Conflicts'],
    ['impact', 'Leave Impact'],
    ['data', 'Data & Rules'],
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Roster<br />Manager</h1>
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? 'nav active' : 'nav'} onClick={() => setTab(id)}>
            {label}
            {id === 'issues' && errors > 0 && <span className="pill">{errors}</span>}
          </button>
        ))}
        <button
          className="nav danger"
          onClick={() => {
            if (window.confirm('Reset ALL data back to the sample dataset?')) reset();
          }}
        >
          Reset sample data
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <h2>{monthLabel(month)}</h2>
          <label>
            Month:{' '}
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
        </div>
        {tab === 'dashboard' && <Dashboard {...props} />}
        {tab === 'roster' && <Roster {...props} />}
        {tab === 'issues' && <Issues {...props} />}
        {tab === 'impact' && <LeaveImpact {...props} />}
        {tab === 'data' && <Data {...props} />}
      </main>
    </div>
  );
}