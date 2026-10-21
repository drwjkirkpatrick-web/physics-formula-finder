'use strict';

// tests/finder.test.js — Builder D (finder).
// Mock formula objects follow the §FORMULAS schema of SPEC.md exactly
// (ids, categories, equations, variables, solveFor with rearranged + fn).
// No sibling modules are imported: js/finder.js is standalone.
// Run: node --test tests/finder.test.js   (from the repo root, Node v22)

const { test } = require('node:test');
const assert = require('node:assert');
const PhysicsFinder = require('../js/finder.js');

const find = PhysicsFinder.find;
const describeMatch = PhysicsFinder.describeMatch;

// ---------------------------------------------------------------------------
// Mock formulas (§FORMULAS schema). Variable counts span 2, 3, 4, 5, 6.
// ---------------------------------------------------------------------------

const G_EARTH = 9.80665; // embedded constant for the 5-variable energy clone

// 4 variables — kinematics (spec's own worked example).
const KIN01 = {
  id: 'mock-kin-01',
  category: 'kinematics',
  name: 'Velocity with constant acceleration',
  equation: 'v = v₀ + a·t',
  statement: 'Final velocity equals initial velocity plus acceleration times time.',
  notes: 'Valid only for constant acceleration.',
  variables: [
    { symbol: 'v',  display: 'v',  description: 'final velocity',   dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h', 'mph', 'ft/s'] },
    { symbol: 'v0', display: 'v₀', description: 'initial velocity', dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h', 'mph', 'ft/s'] },
    { symbol: 'a',  display: 'a',  description: 'acceleration',     dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: ['ft/s^2'] },
    { symbol: 't',  display: 't',  description: 'elapsed time',      dimension: 'time',         siUnit: 's',     commonUnits: ['min', 'hr'] }
  ],
  solveFor: {
    v:  { rearranged: 'v = v₀ + a·t',      fn: (k) => k.v0 + k.a * k.t },
    v0: { rearranged: 'v₀ = v - a·t',      fn: (k) => k.v - k.a * k.t },
    a:  { rearranged: 'a = (v - v₀) / t',  fn: (k) => (k.v - k.v0) / k.t },
    t:  { rearranged: 't = (v - v₀) / a',  fn: (k) => (k.v - k.v0) / k.a }
  }
};

// 3 variables — kinematics (kinematics-06 style).
const KIN02 = {
  id: 'mock-kin-02',
  category: 'kinematics',
  name: 'Displacement at constant velocity',
  equation: 'Δx = v·t',
  statement: 'Displacement equals constant velocity times elapsed time.',
  notes: 'Valid only when velocity is constant.',
  variables: [
    { symbol: 'dx', display: 'Δx', description: 'displacement',       dimension: 'length',   siUnit: 'm',   commonUnits: ['km', 'cm', 'ft'] },
    { symbol: 'v',  display: 'v',  description: 'constant velocity',  dimension: 'velocity', siUnit: 'm/s', commonUnits: ['km/h', 'mph'] },
    { symbol: 't',  display: 't',  description: 'elapsed time',       dimension: 'time',     siUnit: 's',   commonUnits: ['min', 'hr'] }
  ],
  solveFor: {
    dx: { rearranged: 'Δx = v·t',   fn: (k) => k.v * k.t },
    v:  { rearranged: 'v = Δx / t', fn: (k) => k.dx / k.t },
    t:  { rearranged: 't = Δx / v', fn: (k) => k.dx / k.v }
  }
};

// 3 variables — forces (forces-02 style).
const FORCE01 = {
  id: 'mock-force-01',
  category: 'forces',
  name: 'Weight',
  equation: 'W = m·g',
  statement: 'Weight equals mass times gravitational acceleration.',
  notes: "Use g = 9.80665 m/s^2 near Earth's surface unless another value is given.",
  variables: [
    { symbol: 'W', display: 'W', description: 'weight force',            dimension: 'force',        siUnit: 'N',     commonUnits: ['kN', 'lbf'] },
    { symbol: 'm', display: 'm', description: 'mass',                    dimension: 'mass',         siUnit: 'kg',    commonUnits: ['g', 'lb'] },
    { symbol: 'g', display: 'g', description: 'gravitational acceleration', dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: ['ft/s^2'] }
  ],
  solveFor: {
    W: { rearranged: 'W = m·g', fn: (k) => k.m * k.g },
    m: { rearranged: 'm = W / g', fn: (k) => k.W / k.g },
    g: { rearranged: 'g = W / m', fn: (k) => k.W / k.m }
  }
};

// 5 variables — energy: conservation clone with g embedded as a constant.
// (Solving for m is physically degenerate — m factors out of the balance —
// so that solveFor entry is a placeholder; the finder never calls fn.)
const ENERGY01 = {
  id: 'mock-energy-01',
  category: 'energy',
  name: 'Conservation of mechanical energy (g as constant)',
  equation: '½·m·v₁² + m·g·h₁ = ½·m·v₂² + m·g·h₂',
  statement: 'Total mechanical energy (kinetic plus gravitational potential) is the same at two points.',
  notes: 'g = 9.80665 m/s² is embedded as a constant; friction and drag are ignored. Velocity solutions take the positive root.',
  variables: [
    { symbol: 'm',  display: 'm',  description: 'mass',              dimension: 'mass',     siUnit: 'kg',   commonUnits: ['g'] },
    { symbol: 'v1', display: 'v₁', description: 'velocity at point 1', dimension: 'velocity', siUnit: 'm/s',  commonUnits: ['km/h'] },
    { symbol: 'h1', display: 'h₁', description: 'height at point 1',  dimension: 'length',   siUnit: 'm',   commonUnits: ['ft'] },
    { symbol: 'v2', display: 'v₂', description: 'velocity at point 2', dimension: 'velocity', siUnit: 'm/s',  commonUnits: ['km/h'] },
    { symbol: 'h2', display: 'h₂', description: 'height at point 2',  dimension: 'length',   siUnit: 'm',   commonUnits: ['ft'] }
  ],
  solveFor: {
    m:  { rearranged: 'm = m (mass cancels from both sides)', fn: function () { return 0; } },
    v1: { rearranged: 'v₁ = √(v₂² + 2·g·(h₂ - h₁))', fn: (k) => Math.sqrt(k.v2 * k.v2 + 2 * G_EARTH * (k.h2 - k.h1)) },
    h1: { rearranged: 'h₁ = h₂ + (v₂² - v₁²) / (2·g)', fn: (k) => k.h2 + (k.v2 * k.v2 - k.v1 * k.v1) / (2 * G_EARTH) },
    v2: { rearranged: 'v₂ = √(v₁² + 2·g·(h₁ - h₂))', fn: (k) => Math.sqrt(k.v1 * k.v1 + 2 * G_EARTH * (k.h1 - k.h2)) },
    h2: { rearranged: 'h₂ = h₁ + (v₁² - v₂²) / (2·g)', fn: (k) => k.h1 + (k.v1 * k.v1 - k.v2 * k.v2) / (2 * G_EARTH) }
  }
};

// 6 variables — energy: full conservation clone with g as a variable
// (exercises the 4+ unknown skip).
const ENERGY02 = {
  id: 'mock-energy-02',
  category: 'energy',
  name: 'Conservation of mechanical energy',
  equation: '½·m·v₁² + m·g·h₁ = ½·m·v₂² + m·g·h₂',
  statement: 'Total mechanical energy (kinetic plus gravitational potential) is the same at two points.',
  notes: 'Friction and drag are ignored. Velocity solutions take the positive root. Solving for m is degenerate (placeholder fn).',
  variables: [
    { symbol: 'm',  display: 'm',  description: 'mass',               dimension: 'mass',         siUnit: 'kg',   commonUnits: ['g'] },
    { symbol: 'v1', display: 'v₁', description: 'velocity at point 1', dimension: 'velocity',      siUnit: 'm/s',  commonUnits: ['km/h'] },
    { symbol: 'h1', display: 'h₁', description: 'height at point 1',  dimension: 'length',       siUnit: 'm',   commonUnits: ['ft'] },
    { symbol: 'v2', display: 'v₂', description: 'velocity at point 2', dimension: 'velocity',      siUnit: 'm/s',  commonUnits: ['km/h'] },
    { symbol: 'h2', display: 'h₂', description: 'height at point 2',  dimension: 'length',       siUnit: 'm',   commonUnits: ['ft'] },
    { symbol: 'g',  display: 'g',  description: 'gravitational acceleration', dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: ['ft/s^2'] }
  ],
  solveFor: {
    m:  { rearranged: 'm = m (mass cancels from both sides)', fn: function () { return 0; } },
    v1: { rearranged: 'v₁ = √(v₂² + 2·g·(h₂ - h₁))', fn: (k) => Math.sqrt(k.v2 * k.v2 + 2 * k.g * (k.h2 - k.h1)) },
    h1: { rearranged: 'h₁ = h₂ + (v₂² - v₁²) / (2·g)', fn: (k) => k.h2 + (k.v2 * k.v2 - k.v1 * k.v1) / (2 * k.g) },
    v2: { rearranged: 'v₂ = √(v₁² + 2·g·(h₁ - h₂))', fn: (k) => Math.sqrt(k.v1 * k.v1 + 2 * k.g * (k.h1 - k.h2)) },
    h2: { rearranged: 'h₂ = h₁ + (v₁² - v₂²) / (2·g)', fn: (k) => k.h1 + (k.v1 * k.v1 - k.v2 * k.v2) / (2 * k.g) },
    g:  { rearranged: 'g = (v₂² - v₁²) / (2·(h₁ - h₂))', fn: (k) => (k.v2 * k.v2 - k.v1 * k.v1) / (2 * (k.h1 - k.h2)) }
  }
};

// 2 variables — waves (waves-02 style).
const WAVE01 = {
  id: 'mock-wave-01',
  category: 'waves',
  name: 'Period and frequency',
  equation: 'T = 1/f',
  statement: 'Period is the reciprocal of frequency.',
  notes: 'T and f describe the same oscillation.',
  variables: [
    { symbol: 'T', display: 'T', description: 'period',    dimension: 'time',      siUnit: 's',  commonUnits: ['ms', 'min'] },
    { symbol: 'f', display: 'f', description: 'frequency', dimension: 'frequency', siUnit: 'Hz', commonUnits: ['kHz', 'MHz'] }
  ],
  solveFor: {
    T: { rearranged: 'T = 1/f', fn: (k) => 1 / k.f },
    f: { rearranged: 'f = 1/T', fn: (k) => 1 / k.T }
  }
};

const MOCKS = [KIN01, KIN02, FORCE01, ENERGY01, ENERGY02, WAVE01];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ids(result) {
  return {
    exact: result.exact.map((m) => m.formula.id),
    partial: result.partial.map((m) => m.formula.id)
  };
}

// ---------------------------------------------------------------------------
// Module surface
// ---------------------------------------------------------------------------

test('exports exactly find and describeMatch', () => {
  assert.deepStrictEqual(Object.keys(PhysicsFinder).sort(), ['describeMatch', 'find']);
  assert.strictEqual(typeof find, 'function');
  assert.strictEqual(typeof describeMatch, 'function');
});

// ---------------------------------------------------------------------------
// find — classification
// ---------------------------------------------------------------------------

test('exact match: one unknown, solvedFor set, missing empty', () => {
  const r = find(MOCKS, ['v0', 'a', 't']);
  assert.deepStrictEqual(r, {
    exact: [{ formula: KIN01, solvedFor: 'v', missing: [] }],
    partial: [
      { formula: KIN02, solvedFor: 'dx', missing: ['dx', 'v'] },
      { formula: WAVE01, solvedFor: 'T', missing: ['T', 'f'] },
      { formula: FORCE01, solvedFor: 'W', missing: ['W', 'm', 'g'] }
    ]
  });
  assert.strictEqual(r.exact[0].formula, KIN01); // same object, not a copy
});

test('exact detection picks whichever single variable is unknown', () => {
  const symbols = ['v', 'v0', 'a', 't'];
  for (const s of symbols) {
    const knowns = symbols.filter((x) => x !== s);
    const r = find([KIN01], knowns);
    assert.strictEqual(r.exact.length, 1, 'expected one exact match for ' + s);
    assert.strictEqual(r.exact[0].solvedFor, s);
    assert.deepStrictEqual(r.exact[0].missing, []);
    assert.strictEqual(r.partial.length, 0);
  }
});

test('exact works on the 6-variable mock when five symbols are known', () => {
  const all = ['m', 'v1', 'h1', 'v2', 'h2', 'g'];
  for (const s of all) {
    const knowns = all.filter((x) => x !== s);
    const r = find([ENERGY02], knowns);
    assert.strictEqual(r.exact.length, 1, 'expected one exact match for ' + s);
    assert.strictEqual(r.exact[0].solvedFor, s);
    assert.deepStrictEqual(r.exact[0].missing, []);
  }
});

test('partial match with exactly 2 missing symbols', () => {
  const r = find(MOCKS, ['v0', 'a']);
  assert.strictEqual(r.exact.length, 0);
  const kin = r.partial.find((m) => m.formula.id === 'mock-kin-01');
  assert.ok(kin, 'KIN01 should be a partial match here');
  assert.deepStrictEqual(kin, { formula: KIN01, solvedFor: 'v', missing: ['v', 't'] });
});

test('partial match with exactly 3 missing symbols', () => {
  const r = find(MOCKS, ['t']);
  assert.strictEqual(r.exact.length, 0);
  const kin = r.partial.find((m) => m.formula.id === 'mock-kin-01');
  assert.deepStrictEqual(kin, { formula: KIN01, solvedFor: 'v', missing: ['v', 'v0', 'a'] });
});

test('skip: 0 unknowns (fully determined formula)', () => {
  const r = find(MOCKS, ['v', 'v0', 'a', 't']);
  const lists = ids(r);
  assert.strictEqual(lists.exact.indexOf('mock-kin-01'), -1);
  assert.strictEqual(lists.partial.indexOf('mock-kin-01'), -1);
});

test('skip: 4+ unknowns (4-, 5- and 6-variable formulas with empty knowns)', () => {
  const r = find(MOCKS, []);
  const lists = ids(r);
  for (const id of ['mock-kin-01', 'mock-energy-01', 'mock-energy-02']) {
    assert.strictEqual(lists.exact.indexOf(id), -1, id + ' must be skipped (exact)');
    assert.strictEqual(lists.partial.indexOf(id), -1, id + ' must be skipped (partial)');
  }
});

test('skip boundary: exactly 4 unknowns skipped, 3 unknowns partial', () => {
  const four = find([ENERGY02], ['m', 'v1']); // unknowns: h1, v2, h2, g
  assert.deepStrictEqual(four, { exact: [], partial: [] });
  const three = find([ENERGY02], ['m', 'v1', 'h1']); // unknowns: v2, h2, g
  assert.strictEqual(three.exact.length, 0);
  assert.deepStrictEqual(three.partial, [
    { formula: ENERGY02, solvedFor: 'v2', missing: ['v2', 'h2', 'g'] }
  ]);
  const five = find([ENERGY01], ['m', 'v1']); // unknowns: h1, v2, h2
  assert.deepStrictEqual(five.partial, [
    { formula: ENERGY01, solvedFor: 'h1', missing: ['h1', 'v2', 'h2'] }
  ]);
});

// ---------------------------------------------------------------------------
// find — opts.target and opts.category
// ---------------------------------------------------------------------------

test('opts.target filters exact to solvedFor === target', () => {
  const hit = find(MOCKS, ['v0', 'a', 't'], { target: 'v' });
  assert.deepStrictEqual(ids(hit).exact, ['mock-kin-01']);
  // kin01 solves for v, not a; it must vanish entirely (not drop into partial).
  const miss = find(MOCKS, ['v0', 'a', 't'], { target: 'a' });
  assert.deepStrictEqual(miss, { exact: [], partial: [] });
});

test('opts.target filters partial to matches whose missing includes target', () => {
  const r = find(MOCKS, ['v0', 't'], { target: 'a' }); // kin01 missing [v, a]
  assert.deepStrictEqual(ids(r), { exact: [], partial: ['mock-kin-01'] });
  const r2 = find(MOCKS, ['v0', 't'], { target: 'dx' }); // kin02 missing [dx, v]
  assert.deepStrictEqual(ids(r2), { exact: [], partial: ['mock-kin-02'] });
});

test('opts.target matching nothing yields empty lists', () => {
  const r = find(MOCKS, ['v0', 'a', 't'], { target: 'nope' });
  assert.deepStrictEqual(r, { exact: [], partial: [] });
});

test('opts.category filters by formula category', () => {
  const waves = find(MOCKS, [], { category: 'waves' });
  assert.deepStrictEqual(ids(waves), { exact: [], partial: ['mock-wave-01'] });
  const kin = find(MOCKS, [], { category: 'kinematics' });
  assert.deepStrictEqual(ids(kin), { exact: [], partial: ['mock-kin-02'] }); // kin01 skipped: 4 unknowns
  const energy = find(MOCKS, [], { category: 'energy' });
  assert.deepStrictEqual(energy, { exact: [], partial: [] }); // 5- and 6-variable clones skipped
  const bogus = find(MOCKS, [], { category: 'not-a-category' });
  assert.deepStrictEqual(bogus, { exact: [], partial: [] });
});

test('opts.category and opts.target combine (AND)', () => {
  const r = find(MOCKS, ['v0', 'a', 't'], { category: 'kinematics', target: 'v' });
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-01']);
  assert.deepStrictEqual(ids(r).partial, ['mock-kin-02']); // missing [dx, v] includes v
  const r2 = find(MOCKS, ['v0', 'a', 't'], { category: 'forces', target: 'v' });
  assert.deepStrictEqual(r2, { exact: [], partial: [] });
});

// ---------------------------------------------------------------------------
// find — ordering (stable, deterministic)
// ---------------------------------------------------------------------------

test('ordering: fewest unknowns first, then original array order', () => {
  // 2-missing: kin02 [dx, v] (idx 1), force01 [W, g] (idx 2), wave01 [T, f] (idx 5)
  // 3-missing: kin01 [v, v0, a] (idx 0) — must come LAST despite lowest index.
  const r = find(MOCKS, ['m', 't']);
  assert.deepStrictEqual(ids(r).partial, [
    'mock-kin-02', 'mock-force-01', 'mock-wave-01', 'mock-kin-01'
  ]);
});

test('ordering: equal missing counts keep original array order', () => {
  // All three 2-missing partials (kin01 idx0, kin02 idx1, wave01 idx5) before force01 (3).
  const r = find(MOCKS, ['v0', 't']);
  assert.deepStrictEqual(ids(r).partial, [
    'mock-kin-01', 'mock-kin-02', 'mock-wave-01', 'mock-force-01'
  ]);
});

test('ordering: exact list follows original array order', () => {
  const r = find(MOCKS, ['v0', 'a', 't', 'dx']); // kin01 and kin02 both solve for v
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-01', 'mock-kin-02']);
  assert.deepStrictEqual(ids(r).partial, ['mock-wave-01', 'mock-force-01']);
});

test('ordering: follows the given array, not ids or categories', () => {
  const r = find([KIN02, KIN01], ['v0', 'a', 't', 'dx']);
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-02', 'mock-kin-01']);
});

test('ordering: deterministic across repeated calls', () => {
  const a = find(MOCKS, ['m', 't'], { category: 'kinematics' });
  const b = find(MOCKS, ['m', 't'], { category: 'kinematics' });
  assert.deepStrictEqual(a, b);
  // Category filter keeps the fewest-unknowns-first order within the category.
  assert.deepStrictEqual(ids(a).partial, ['mock-kin-02', 'mock-kin-01']);
});

// ---------------------------------------------------------------------------
// find — dedupe (at most once overall, never in both lists)
// ---------------------------------------------------------------------------

test('dedupe: the same formula object twice appears once', () => {
  const r = find([KIN01, KIN01, KIN02], ['v0', 'a', 't']);
  assert.strictEqual(r.exact.length, 1);
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-01']);
});

test('dedupe: a distinct object with the same id appears once (first wins)', () => {
  const clone = Object.assign({}, KIN01);
  const r = find([KIN01, clone], ['v0', 'a', 't']);
  assert.strictEqual(r.exact.length, 1);
  assert.strictEqual(r.exact[0].formula, KIN01);
});

test('dedupe: no formula in both lists and no repeats, across scenarios', () => {
  const scenarios = [
    [],
    ['v0'],
    ['v0', 'a'],
    ['v0', 'a', 't'],
    ['m', 't'],
    ['v', 'v0', 'a', 't'],
    ['v0', 't', 'm']
  ];
  for (const knowns of scenarios) {
    const r = find(MOCKS, knowns);
    const all = r.exact.concat(r.partial).map((m) => m.formula.id);
    assert.strictEqual(
      new Set(all).size, all.length,
      'repeated formula for knowns ' + JSON.stringify(knowns)
    );
    const exactIds = new Set(r.exact.map((m) => m.formula.id));
    for (const m of r.partial) {
      assert.ok(
        !exactIds.has(m.formula.id),
        'formula in both lists for knowns ' + JSON.stringify(knowns)
      );
    }
  }
});

// ---------------------------------------------------------------------------
// describeMatch
// ---------------------------------------------------------------------------

test('describeMatch: exact string resolves the solvedFor display form', () => {
  const r = find(MOCKS, ['v', 'a', 't']); // kin01 unknown v0; kin02 unknown dx
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-01', 'mock-kin-02']);
  assert.strictEqual(describeMatch(r.exact[0]), 'Solves for v₀: v = v₀ + a·t');
  const r2 = find(MOCKS, ['v0', 'a', 't']); // kin01's only unknown is v
  assert.strictEqual(describeMatch(r2.exact[0]), 'Solves for v: v = v₀ + a·t');
});

test('describeMatch: partial strings list missing displays', () => {
  const two = find(MOCKS, ['v0', 'a']);
  const kin = two.partial.find((m) => m.formula.id === 'mock-kin-01');
  assert.strictEqual(describeMatch(kin), 'Add v, t to use v = v₀ + a·t');
  const three = find(MOCKS, ['t']);
  const kin3 = three.partial.find((m) => m.formula.id === 'mock-kin-01');
  assert.strictEqual(describeMatch(kin3), 'Add v, v₀, a to use v = v₀ + a·t');
});

test('describeMatch: Unicode displays in missing symbols', () => {
  const r = find([KIN02], ['v']); // unknowns dx, t
  assert.strictEqual(describeMatch(r.partial[0]), 'Add Δx, t to use Δx = v·t');
  const w = find([WAVE01], []);
  assert.strictEqual(describeMatch(w.partial[0]), 'Add T, f to use T = 1/f');
});

test('describeMatch: falls back to raw symbols missing from formula.variables', () => {
  assert.strictEqual(
    describeMatch({ formula: KIN01, solvedFor: 'zzz', missing: [] }),
    'Solves for zzz: v = v₀ + a·t'
  );
  assert.strictEqual(
    describeMatch({ formula: KIN01, solvedFor: 'v', missing: ['M1', 'm2'] }),
    'Add M1, m2 to use v = v₀ + a·t'
  );
});

test('describeMatch: missing omitted or empty counts as exact', () => {
  assert.strictEqual(
    describeMatch({ formula: KIN01, solvedFor: 'v0' }),
    'Solves for v₀: v = v₀ + a·t'
  );
  assert.strictEqual(
    describeMatch({ formula: KIN01, solvedFor: 'v', missing: [] }),
    'Solves for v: v = v₀ + a·t'
  );
});

test('describeMatch: throws TypeError without a usable formula', () => {
  assert.throws(() => describeMatch(null), TypeError);
  assert.throws(() => describeMatch(undefined), TypeError);
  assert.throws(() => describeMatch({ solvedFor: 'v', missing: [] }), TypeError);
  assert.throws(() => describeMatch({ formula: null, solvedFor: 'v' }), TypeError);
});

// ---------------------------------------------------------------------------
// Empty knowns and omitted opts
// ---------------------------------------------------------------------------

test('empty knownSymbols: 2-3 variable formulas partial, 4+ skipped, nothing crashes', () => {
  const r = find(MOCKS, []);
  assert.deepStrictEqual(r.exact, []);
  assert.deepStrictEqual(ids(r).partial, ['mock-wave-01', 'mock-kin-02', 'mock-force-01']);
  // A list of only 2-3 variable formulas: everything partial.
  const allSmall = find([KIN02, FORCE01, WAVE01], []);
  assert.strictEqual(allSmall.exact.length, 0);
  assert.strictEqual(allSmall.partial.length, 3);
  assert.deepStrictEqual(ids(allSmall).partial, ['mock-wave-01', 'mock-kin-02', 'mock-force-01']);
});

test('opts omitted entirely behaves the same as opts {}', () => {
  assert.deepStrictEqual(find(MOCKS, ['v0', 'a', 't']), find(MOCKS, ['v0', 'a', 't'], {}));
  assert.deepStrictEqual(find(MOCKS, []), find(MOCKS, [], {}));
});

test('opts null is tolerated (treated as no filters)', () => {
  assert.deepStrictEqual(find(MOCKS, ['v0', 'a', 't'], null), find(MOCKS, ['v0', 'a', 't'], {}));
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

test('non-array formulas input degrades to empty results', () => {
  assert.deepStrictEqual(find(null, ['v']), { exact: [], partial: [] });
  assert.deepStrictEqual(find(undefined, ['v']), { exact: [], partial: [] });
  assert.deepStrictEqual(find([], ['v']), { exact: [], partial: [] });
  assert.deepStrictEqual(find('nope', ['v']), { exact: [], partial: [] });
});

test('null knownSymbols behaves like empty knownSymbols', () => {
  assert.deepStrictEqual(find(MOCKS, null), find(MOCKS, []));
});

test('unknown or duplicate known symbols are harmless', () => {
  assert.deepStrictEqual(find(MOCKS, ['zzz']), find(MOCKS, []));
  assert.deepStrictEqual(find(MOCKS, ['v', 'v', 'v0', 'v0']), find(MOCKS, ['v', 'v0']));
});

test('known symbols match case-sensitively', () => {
  const lower = find([FORCE01], ['w']); // 'w' does not satisfy the symbol 'W'
  assert.deepStrictEqual(lower.partial[0].missing, ['W', 'm', 'g']);
  const upper = find([FORCE01], ['W']);
  assert.deepStrictEqual(upper.partial[0].missing, ['m', 'g']);
});

test('malformed formula entries are skipped without crashing', () => {
  const bad = [null, { id: 'no-vars' }, { id: 'bad-vars', variables: 'nope' }, KIN01];
  const r = find(bad, ['v0', 'a', 't']);
  assert.deepStrictEqual(ids(r).exact, ['mock-kin-01']);
  assert.strictEqual(r.partial.length, 0);
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

test('find returns fresh objects each call and never mutates its inputs', () => {
  const snapshot = JSON.stringify(MOCKS);
  const knowns = ['v0', 'a', 't'];
  const r1 = find(MOCKS, knowns);
  assert.strictEqual(r1.exact[0].formula, KIN01);
  // Corrupt the first result, then re-run: the new result must be unaffected.
  r1.exact.push({ junk: true });
  r1.partial[0].missing.push('junk');
  const r2 = find(MOCKS, knowns);
  assert.notStrictEqual(r1.exact[0], r2.exact[0]);
  assert.notStrictEqual(r1.partial[0].missing, r2.partial[0].missing);
  assert.strictEqual(r2.exact.length, 1);
  assert.deepStrictEqual(r2.exact[0], { formula: KIN01, solvedFor: 'v', missing: [] });
  assert.deepStrictEqual(ids(r2).partial, ['mock-kin-02', 'mock-wave-01', 'mock-force-01']);
  assert.deepStrictEqual(r2.partial[0].missing, ['dx', 'v']);
  // Inputs untouched.
  assert.strictEqual(JSON.stringify(MOCKS), snapshot);
  assert.deepStrictEqual(knowns, ['v0', 'a', 't']);
});