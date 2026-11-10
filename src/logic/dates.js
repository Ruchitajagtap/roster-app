export const pad = (n) => String(n).padStart(2, '0');
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// month = 'YYYY-MM'
export function daysInMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    return {
      date: `${y}-${pad(m)}-${pad(day)}`,
      day,
      weekday: new Date(y, m - 1, day).getDay(),
    };
  });
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Monday-start week blocks inside the month
export function weekBlocks(days) {
  const blocks = [];
  let cur = [];
  days.forEach((d) => {
    if (d.weekday === 1 && cur.length) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(d);
  });
  if (cur.length) blocks.push(cur);
  return blocks;
}