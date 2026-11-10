const pad = (n) => String(n).padStart(2, '0');
const E = (n) => 'E' + pad(n);

const NAMES = [
  'Aarav Mehta', 'Riya Sharma', 'Kabir Singh', 'Ananya Iyer', 'Vihaan Gupta', 'Isha Patel', 'Rohan Desai',
  'Meera Nair', 'Arjun Reddy', 'Diya Kapoor', 'Kunal Joshi', 'Sneha Rao', 'Rahul Verma', 'Pooja Menon',
  'Neha Kulkarni', 'Aditya Bose', 'Tanvi Shah', 'Siddharth Jain', 'Priya Chawla', 'Varun Malhotra', 'Kavya Pillai',
  'Manish Tiwari', 'Aisha Khan', 'Dev Patil', 'Simran Kaur', 'Yash Agarwal', 'Nikita Bhat', 'Harsh Vora',
  'Lakshmi Iyer', 'Omkar Kale', 'Zoya Ansari', 'Pranav Naik', 'Ritu Saxena', 'Mohit Bansal', 'Tara Dutta',
];

const CS = 'Customer Support', ACC = 'Abandoned Cart', NDR = 'NDR', RET = 'Retention';
const S = (type, rule, min, emps, minOverrides) => ({ type, rule, min, emps, minOverrides: minOverrides || {} });
const NS = 'NO_SUN_HOL', EH = 'EXCEPT_HOLIDAYS', A365 = 'ALL_365';

// [brand name, pod, processes]  (numbers = employee numbers)
const BRANDS = [
  ['Glowbar Cosmetics', 'P1', [S(CS, A365, 1, [2, 3]), S(ACC, NS, 1, [3]), S(NDR, NS, 1, [4])]],
  ['Veda Organics', 'P1', [S(CS, NS, 1, [5]), S(ACC, NS, 1, [5])]],
  ['PetPals', 'P1', [S(CS, NS, 1, [6])]],
  ['Kidoro Toys', 'P1', [S(CS, EH, 1, [7])]],
  ['UrbanNest Living', 'P2', [S(CS, A365, 2, [9, 10, 11]), S(RET, EH, 1, [10, 11])]],
  ['Bloom Skincare', 'P2', [S(CS, NS, 1, [12]), S(ACC, NS, 1, [12])]],
  ['TechTonic Gadgets', 'P2', [S(CS, NS, 1, [13]), S(NDR, NS, 1, [13])]],
  ['Spice Route Foods', 'P2', [S(CS, A365, 1, [14])]],
  ['FitNova Wellness', 'P3', [S(CS, A365, 1, [16, 17]), S(ACC, NS, 1, [16]), S(NDR, NS, 1, [17])]],
  ['Aura Jewels', 'P3', [S(CS, NS, 1, [18]), S(ACC, NS, 1, [18])]],
  ['Mojo Fashion', 'P3', [S(CS, NS, 1, [19]), S(RET, NS, 1, [19])]],
  ['GreenLeaf Tea', 'P3', [S(CS, NS, 1, [20])]],
  ['Pure Pets', 'P3', [S(CS, NS, 1, [20]), S(NDR, NS, 1, [20])]],
  ['Zenith Watches', 'P3', [S(CS, NS, 1, [21]), S(ACC, NS, 1, [21])]],
  ['Kiddo Kart', 'P4', [S(CS, EH, 1, [23, 24]), S(RET, NS, 1, [24])]],
  ['Urban Threads', 'P4', [S(CS, NS, 1, [25]), S(ACC, NS, 1, [25])]],
  ['Nutri Crate', 'P4', [S(CS, NS, 1, [26]), S(NDR, NS, 1, [26])]],
  ['Luma Lamps', 'P4', [S(CS, A365, 1, [27])]],
  ['Brewmaster Coffee', 'P4', [S(CS, NS, 1, [28]), S(ACC, NS, 1, [28])]],
  ['Bean There', 'P4', [S(CS, NS, 1, [28])]],
  ['Vastra Home', 'P5', [S(CS, NS, 2, [30, 31], { 6: 1 }), S(RET, NS, 1, [31])]],
  ['Drift Sneakers', 'P5', [S(CS, NS, 1, [32]), S(ACC, NS, 1, [32])]],
  ['Bolt Mobility', 'P5', [S(CS, NS, 1, [33]), S(NDR, NS, 1, [33])]],
  ['Aqua Wellness', 'P5', [S(CS, NS, 1, [34]), S(ACC, NS, 1, [34])]],
  ['Craftly Decor', 'P5', [S(CS, NS, 1, [35]), S(RET, NS, 1, [35])]],
];

export function seed() {
  const pods = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].map((n, k) => ({
    id: 'P' + (k + 1), name: 'Pod ' + n, leadId: E(7 * k + 1),
  }));

  const employees = NAMES.map((name, i) => {
    const n = i + 1;
    return {
      id: E(n), name,
      podId: 'P' + (Math.floor((n - 1) / 7) + 1),
      prefOff: n % 4 === 0 ? [0] : n % 6 === 0 ? [3] : [],
    };
  });

  const brands = [];
  const processes = [];
  const assignments = [];
  let pc = 0, ac = 0;
  BRANDS.forEach(([name, pod, procs], i) => {
    const brandId = 'B' + pad(i + 1);
    brands.push({ id: brandId, name, podId: pod });
    procs.forEach((pr) => {
      pc++;
      const processId = 'PR' + pad(pc);
      processes.push({
        id: processId, brandId, name: pr.type, rule: pr.rule, minStaff: pr.min, minOverrides: pr.minOverrides,
      });
      pr.emps.forEach((n) => {
        ac++;
        assignments.push({ id: 'A' + ac, employeeId: E(n), processId });
      });
    });
  });

  const holidays = [
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
    { date: '2026-12-25', name: 'Christmas' },
    { date: '2027-01-01', name: "New Year's Day" },
    { date: '2027-01-26', name: 'Republic Day' },
  ];

  const leaves = [
    { id: 'L1', employeeId: E(2), date: '2026-11-12', type: 'L' },
    { id: 'L2', employeeId: E(9), date: '2026-11-16', type: 'L' },
    { id: 'L3', employeeId: E(12), date: '2026-11-20', type: 'CO' },
    { id: 'L4', employeeId: E(18), date: '2026-11-25', type: 'L' },
    { id: 'L5', employeeId: E(2), date: '2026-12-07', type: 'L' },
  ];

  return { pods, employees, brands, processes, assignments, holidays, leaves, covers: [], rosters: {} };
}