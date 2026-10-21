'use strict';

// Tests for js/solver.js — Builder C (step-by-step missing-variable solver).
// Uses ONLY a mock units engine and mock formula objects built to the
// §FORMULAS schema; never imports sibling modules (js/units.js, js/formulas.js).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PhysicsSolverFactory = require('../js/solver.js');

const NON_FINITE_MESSAGE =
  "The calculation didn't produce a finite number — a value may be zero in a denominator. Check your knowns.";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function approx(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale < 1e-9) return Math.abs(a - b) <= 1e-9; // absolute near zero
  return Math.abs(a - b) <= 1e-9 * scale;           // relative 1e-9
}

function assertApprox(actual, expected, message) {
  assert.ok(approx(actual, expected),
    (message ? message + ': ' : '') + 'expected ~' + expected + ', got ' + actual);
}

// ---------------------------------------------------------------------------
// Mock units engine — implements the §SOLVER injection interface:
// toSI, fromSI, convert, dimensionOf, listUnits, normalize, formatValue.
// si = (value + add) * mul ; inverse: value = si / mul - add.
// ---------------------------------------------------------------------------

function formatValue(value, sigFigs) {
  const sig = Math.max(1, Math.round(sigFigs) || 4);
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';
  const negative = value < 0;
  const abs = negative ? -value : value;
  const sign = negative ? '-' : '';
  if (abs >= 1e5 || abs < 1e-3) {
    let exp = Math.floor(Math.log10(abs));
    let mantissa = abs / Math.pow(10, exp);
    mantissa = Number(mantissa.toPrecision(sig));
    if (mantissa >= 10) { mantissa /= 10; exp += 1; }
    let text = String(mantissa);
    if (text.indexOf('.') !== -1) text = text.replace(/0+$/, '').replace(/\.$/, '');
    return sign + text + ' × 10^' + exp;
  }
  const rounded = Number(abs.toPrecision(sig));
  if (Number.isInteger(rounded)) return sign + String(rounded);
  const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
  let text = rounded.toFixed(decimals);
  if (text.indexOf('.') !== -1) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return sign + text;
}

// Dual-registered records, mirroring the real units engine: the same symbol
// belongs to a second dimension with different conversion factors.
const DUALS = {
  'temperature-interval': [
    { symbol: 'K',  name: 'kelvin interval',             mul: 1,      add: 0 },
    { symbol: '°C', name: 'degree Celsius interval',    mul: 1,      add: 0 },
    { symbol: '°F', name: 'degree Fahrenheit interval',  mul: 5 / 9,  add: 0 }
  ],
  'acceleration': [
    { symbol: 'g', name: 'standard gravity', mul: 9.80665, add: 0 }
  ]
};

function createMockUnits() {
  const table = {
    'm/s':   { dim: 'velocity', mul: 1, name: 'meters per second' },
    'km/h':  { dim: 'velocity', mul: 1000 / 3600, name: 'kilometers per hour' },
    'm/s^2': { dim: 'acceleration', mul: 1, name: 'meters per second squared' },
    's':     { dim: 'time', mul: 1, name: 'second' },
    'min':   { dim: 'time', mul: 60, name: 'minute' },
    'kg':    { dim: 'mass', mul: 1, name: 'kilogram' },
    'N':     { dim: 'force', mul: 1, name: 'newton' },
    'W':     { dim: 'power', mul: 1, name: 'watt' },
    'A':     { dim: 'current', mul: 1, name: 'ampere' },
    'mA':    { dim: 'current', mul: 0.001, name: 'milliampere' },
    'V':     { dim: 'voltage', mul: 1, name: 'volt' },
    'K':     { dim: 'temperature', mul: 1, add: 0, name: 'kelvin' },
    '°C':    { dim: 'temperature', mul: 1, add: 273.15, name: 'degree Celsius' },
    'Δ°C':   { dim: 'temperature-interval', mul: 1, name: 'degree Celsius interval' },
    'Δ°F':   { dim: 'temperature-interval', mul: 5 / 9, name: 'degree Fahrenheit interval' },
    'Pa':    { dim: 'pressure', mul: 1, name: 'pascal' },
    'm³':    { dim: 'volume', mul: 1, name: 'cubic meter' },
    'L':     { dim: 'volume', mul: 0.001, name: 'liter' },
    'mol':   { dim: 'amount', mul: 1, name: 'mole' },
    'J':     { dim: 'energy', mul: 1, name: 'joule' },
    'J/(kg·K)': { dim: 'specific-heat', mul: 1, name: 'joule per kilogram-kelvin' },
    '':      { dim: 'dimensionless', mul: 1, name: 'dimensionless' },
    // Mock-only trap unit: known velocity dimension, but toSI blows up, to
    // exercise the solver's outer catch (unexpected throw -> non-finite).
    'bad':   { dim: 'velocity', mul: 1, name: 'broken mock unit', broken: true, hidden: true }
  };
  const aliases = {
    'kph': 'km/h',
    'kmh': 'km/h',
    'sec': 's',
    'mps': 'm/s',
    'milliamp': 'mA',
    'degC': '°C',
    'celsius': '°C'
  };
  function unitError(message) {
    const err = new Error(message);
    err.name = 'UnitError';
    return err;
  }
  function lookup(unit) {
    if (typeof unit !== 'string') return null;
    const canonical = Object.prototype.hasOwnProperty.call(aliases, unit) ? aliases[unit] : unit;
    if (!Object.prototype.hasOwnProperty.call(table, canonical)) return null;
    return { symbol: canonical, record: table[canonical] };
  }
  return {
    toSI: function (value, unit) {
      const found = lookup(unit);
      if (!found) throw unitError('Unknown unit: ' + unit);
      if (found.record.broken) throw new Error('mock toSI exploded');
      const add = found.record.add || 0;
      return (value + add) * found.record.mul;
    },
    fromSI: function (value, unit) {
      const found = lookup(unit);
      if (!found) throw unitError('Unknown unit: ' + unit);
      const add = found.record.add || 0;
      return value / found.record.mul - add;
    },
    convert: function (value, fromUnit, toUnit) {
      const a = lookup(fromUnit);
      const b = lookup(toUnit);
      if (!a) throw unitError('Unknown unit: ' + fromUnit);
      if (!b) throw unitError('Unknown unit: ' + toUnit);
      if (a.record.dim !== b.record.dim) {
        throw unitError('Cannot convert ' + fromUnit + ' (' + a.record.dim + ') to ' + toUnit + ' (' + b.record.dim + ')');
      }
      return this.fromSI(this.toSI(value, fromUnit), toUnit);
    },
    dimensionOf: function (unit) {
      const found = lookup(unit);
      return found ? found.record.dim : null;
    },
    listUnits: function (dimension) {
      const symbols = Object.keys(table).filter(function (u) {
        return table[u].dim === dimension && !table[u].hidden;
      });
      if (symbols.length === 0 && !DUALS[dimension]) {
        throw unitError('Unknown dimension: ' + dimension);
      }
      // Expose mul/add like the real engine so dimension-aware consumers work.
      const out = symbols.map(function (u) {
        return { symbol: u, name: table[u].name, mul: table[u].mul, add: table[u].add || 0 };
      });
      (DUALS[dimension] || []).forEach(function (d) {
        if (!out.some(function (u) { return u.symbol === d.symbol; })) out.push(d);
      });
      return out;
    },
    normalize: function (unit) {
      const found = lookup(unit);
      if (!found) throw unitError('Unknown unit: ' + unit);
      return found.symbol;
    },
    formatValue: formatValue
  };
}

const mockUnits = createMockUnits();

// ---------------------------------------------------------------------------
// Mock formulas — built EXACTLY to the §FORMULAS object schema.
// ---------------------------------------------------------------------------

// Clone of kinematics-01 with all four solveFor entries.
const kin01 = {
  id: 'kinematics-01',
  category: 'kinematics',
  name: 'Velocity with constant acceleration',
  equation: 'v = v₀ + a·t',
  statement: 'Final velocity equals initial velocity plus acceleration times time.',
  notes: 'Valid only for constant acceleration.',
  variables: [
    { symbol: 'v',  display: 'v',  description: 'final velocity',   dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h'] },
    { symbol: 'v0', display: 'v₀', description: 'initial velocity', dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h'] },
    { symbol: 'a',  display: 'a',  description: 'acceleration',     dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: [] },
    { symbol: 't',  display: 't',  description: 'elapsed time',     dimension: 'time',         siUnit: 's',     commonUnits: ['min'] }
  ],
  solveFor: {
    v:  { rearranged: 'v = v₀ + a·t',     fn: function (k) { return k.v0 + k.a * k.t; } },
    v0: { rearranged: 'v₀ = v - a·t',     fn: function (k) { return k.v - k.a * k.t; } },
    a:  { rearranged: 'a = (v - v₀) / t', fn: function (k) { return (k.v - k.v0) / k.t; } },
    t:  { rearranged: 't = (v - v₀) / a', fn: function (k) { return (k.v - k.v0) / k.a; } }
  }
};

// Clone of electricity-02 (P = V·I).
const pow01 = {
  id: 'electricity-02',
  category: 'electricity',
  name: 'Electrical power',
  equation: 'P = V·I',
  statement: 'Power equals voltage times current.',
  notes: 'Applies to any two-terminal element.',
  variables: [
    { symbol: 'P', display: 'P', description: 'power',   dimension: 'power',   siUnit: 'W', commonUnits: [] },
    { symbol: 'V', display: 'V', description: 'voltage', dimension: 'voltage', siUnit: 'V', commonUnits: [] },
    { symbol: 'I', display: 'I', description: 'current', dimension: 'current', siUnit: 'A', commonUnits: ['mA'] }
  ],
  solveFor: {
    P: { rearranged: 'P = V·I',   fn: function (k) { return k.V * k.I; } },
    V: { rearranged: 'V = P / I', fn: function (k) { return k.P / k.I; } },
    I: { rearranged: 'I = P / V', fn: function (k) { return k.P / k.V; } }
  }
};

// forces-03 shape — includes a dimensionless variable (μ, siUnit '').
const fric01 = {
  id: 'forces-03',
  category: 'forces',
  name: 'Friction force',
  equation: 'f = μ·N',
  statement: 'Friction equals the coefficient of friction times the normal force.',
  notes: 'μ is dimensionless.',
  variables: [
    { symbol: 'f',  display: 'f', description: 'friction force',          dimension: 'force',        siUnit: 'N', commonUnits: [] },
    { symbol: 'mu', display: 'μ', description: 'coefficient of friction', dimension: 'dimensionless', siUnit: '',  commonUnits: [] },
    { symbol: 'N',  display: 'N', description: 'normal force',             dimension: 'force',        siUnit: 'N', commonUnits: [] }
  ],
  solveFor: {
    f:  { rearranged: 'f = μ·N',   fn: function (k) { return k.mu * k.N; } },
    mu: { rearranged: 'μ = f / N', fn: function (k) { return k.f / k.N; } },
    N:  { rearranged: 'N = f / μ', fn: function (k) { return k.f / k.mu; } }
  }
};

// thermal-04 shape — ideal gas law with an absolute-temperature variable
// (exercises offset conversions and zero-denominator paths).
const gas01 = {
  id: 'thermal-04',
  category: 'thermal',
  name: 'Ideal gas law',
  equation: 'P·V = n·R·T',
  statement: 'Pressure times volume equals amount times the gas constant times absolute temperature.',
  notes: 'R = 8.314 J/(mol·K); T must be an absolute temperature.',
  variables: [
    { symbol: 'P', display: 'P', description: 'pressure',             dimension: 'pressure',    siUnit: 'Pa',  commonUnits: [] },
    { symbol: 'V', display: 'V', description: 'volume',              dimension: 'volume',      siUnit: 'm³',  commonUnits: ['L'] },
    { symbol: 'n', display: 'n', description: 'amount of gas',        dimension: 'amount',      siUnit: 'mol', commonUnits: [] },
    { symbol: 'T', display: 'T', description: 'absolute temperature', dimension: 'temperature', siUnit: 'K',   commonUnits: ['°C'] }
  ],
  solveFor: {
    P: { rearranged: 'P = n·R·T / V',   fn: function (k) { return (k.n * 8.314 * k.T) / k.V; } },
    V: { rearranged: 'V = n·R·T / P',   fn: function (k) { return (k.n * 8.314 * k.T) / k.P; } },
    n: { rearranged: 'n = P·V / (R·T)', fn: function (k) { return (k.P * k.V) / (8.314 * k.T); } },
    T: { rearranged: 'T = P·V / (n·R)', fn: function (k) { return (k.P * k.V) / (k.n * 8.314); } }
  }
};

// Test-only mock whose fn throws, to cover the "fn threw" error path.
const boom01 = {
  id: 'mock-boom',
  category: 'kinematics',
  name: 'Mock formula whose fn throws',
  equation: 'x = y',
  statement: 'A mock formula used to test error handling.',
  notes: 'Test-only mock.',
  variables: [
    { symbol: 'x', display: 'x', description: 'mock target', dimension: 'dimensionless', siUnit: '', commonUnits: [] },
    { symbol: 'y', display: 'y', description: 'mock known',  dimension: 'dimensionless', siUnit: '', commonUnits: [] }
  ],
  solveFor: {
    x: { rearranged: 'x = y', fn: function () { throw new Error('kaboom'); } },
    y: { rearranged: 'y = x', fn: function (k) { return k.x; } }
  }
};

const solver = PhysicsSolverFactory.create(mockUnits);

// ---------------------------------------------------------------------------
// Factory surface
// ---------------------------------------------------------------------------

test('factory exports exactly { create } and create(units) returns { solve }', () => {
  assert.deepStrictEqual(Object.keys(PhysicsSolverFactory).sort(), ['create']);
  assert.strictEqual(typeof PhysicsSolverFactory.create, 'function');
  const instance = PhysicsSolverFactory.create(mockUnits);
  assert.deepStrictEqual(Object.keys(instance).sort(), ['solve']);
  assert.strictEqual(typeof instance.solve, 'function');
});

test('UMD global branch sets root.PhysicsSolverFactory when module is undefined', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'solver.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context);
  assert.strictEqual(typeof context.PhysicsSolverFactory, 'object');
  assert.strictEqual(typeof context.PhysicsSolverFactory.create, 'function');
  const result = context.PhysicsSolverFactory.create(mockUnits).solve(
    kin01, 'v', { v0: { value: 10 }, a: { value: 2 }, t: { value: 3 } });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.formatted, '16 m/s');
});

// ---------------------------------------------------------------------------
// Happy path, all-SI
// ---------------------------------------------------------------------------

test('happy path with all-SI knowns returns the full SPEC success shape', () => {
  const res = solver.solve(kin01, 'v', {
    v0: { value: 10, unit: 'm/s' },
    a: { value: 2 },
    t: { value: 3 }
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(Object.keys(res).sort(),
    ['assignments', 'converted', 'formatted', 'ok', 'result', 'steps', 'substituted', 'target']);

  assert.deepStrictEqual(res.target,
    { symbol: 'v', display: 'v', dimension: 'velocity', unit: 'm/s' });

  assert.deepStrictEqual(res.steps, [
    { label: 'Formula', text: 'v = v₀ + a·t' },
    { label: 'Rearranged', text: 'v = v₀ + a·t' },
    { label: 'Convert units', text: 'All known values are already in SI units.' },
    { label: 'Substitute', text: 'v₀ = 10 m/s; a = 2 m/s^2; t = 3 s  →  ? = 10 + 2·3' },
    { label: 'Compute', text: 'v = 16 m/s' },
    { label: 'Result', text: 'v = 16 m/s (velocity)' }
  ]);

  // every known, in SI, keyed by symbol; from/to strings
  assert.deepStrictEqual(res.converted, {
    v0: { from: '10 m/s', to: '10 m/s', value: 10, unit: 'm/s' },
    a: { from: '2 m/s^2', to: '2 m/s^2', value: 2, unit: 'm/s^2' },
    t: { from: '3 s', to: '3 s', value: 3, unit: 's' }
  });

  // assignments follow the formula's variables order; missing unit defaulted to siUnit
  assert.deepStrictEqual(res.assignments, [
    { symbol: 'v0', display: 'v₀', value: 10, unit: 'm/s' },
    { symbol: 'a', display: 'a', value: 2, unit: 'm/s^2' },
    { symbol: 't', display: 't', value: 3, unit: 's' }
  ]);

  assert.strictEqual(res.substituted, '? = 10 + 2·3');
  assert.deepStrictEqual(res.result,
    { symbol: 'v', display: 'v', value: 16, unit: 'm/s', dimension: 'velocity' });
  assert.strictEqual(res.formatted, '16 m/s');
});

test('steps appear in the exact six-step order', () => {
  const res = solver.solve(kin01, 'v', { v0: { value: 10 }, a: { value: 2 }, t: { value: 3 } });
  assert.deepStrictEqual(res.steps.map((s) => s.label),
    ['Formula', 'Rearranged', 'Convert units', 'Substitute', 'Compute', 'Result']);
});

// ---------------------------------------------------------------------------
// Mixed units and the SPEC's worked example numbers
// ---------------------------------------------------------------------------

test('mixed units: km/h known converted to SI, negatives parenthesized in substituted', () => {
  const res = solver.solve(kin01, 'v', {
    v0: { value: '72', unit: 'km/h' },
    a: { value: -5, unit: 'm/s^2' },
    t: { value: 3, unit: 's' }
  });
  assert.strictEqual(res.ok, true);
  assertApprox(res.result.value, 5);
  assert.strictEqual(res.formatted, '5 m/s');

  assert.strictEqual(res.steps[2].text, 'v₀: 72 km/h → 20 m/s');
  assert.strictEqual(res.steps[3].text, 'v₀ = 20 m/s; a = -5 m/s^2; t = 3 s  →  ? = 20 + (-5)·3');
  assert.strictEqual(res.steps[4].text, 'v = 5 m/s');
  assert.strictEqual(res.steps[5].text, 'v = 5 m/s (velocity)');

  assert.strictEqual(res.substituted, '? = 20 + (-5)·3');

  assert.strictEqual(res.converted.v0.from, '72 km/h');
  assert.strictEqual(res.converted.v0.to, '20 m/s');
  assertApprox(res.converted.v0.value, 20);
  assert.strictEqual(res.converted.v0.unit, 'm/s');
  assert.deepStrictEqual(res.converted.a,
    { from: '-5 m/s^2', to: '-5 m/s^2', value: -5, unit: 'm/s^2' });
  assert.deepStrictEqual(res.converted.t,
    { from: '3 s', to: '3 s', value: 3, unit: 's' });

  assert.strictEqual(res.assignments[0].symbol, 'v0');
  assert.strictEqual(res.assignments[0].display, 'v₀');
  assert.strictEqual(res.assignments[0].unit, 'm/s');
  assertApprox(res.assignments[0].value, 20);
  assert.deepStrictEqual(res.assignments[1],
    { symbol: 'a', display: 'a', value: -5, unit: 'm/s^2' });
  assert.deepStrictEqual(res.assignments[2],
    { symbol: 't', display: 't', value: 3, unit: 's' });
});

test('unit aliases resolve through mock normalize; multiple convert lines join with "; "', () => {
  const res = solver.solve(kin01, 'v', {
    v0: { value: 72, unit: 'kph' },
    a: { value: -2 },
    t: { value: '0.1', unit: 'min' }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.converted.v0.from, '72 kph');
  assert.strictEqual(res.converted.v0.to, '20 m/s');
  assertApprox(res.converted.v0.value, 20);
  assert.strictEqual(res.converted.t.from, '0.1 min');
  assert.strictEqual(res.converted.t.to, '6 s');
  assertApprox(res.converted.t.value, 6);
  assert.strictEqual(res.steps[2].text, 'v₀: 72 kph → 20 m/s; t: 0.1 min → 6 s');
  assert.strictEqual(res.substituted, '? = 20 + (-2)·6');
  assertApprox(res.result.value, 8);
  assert.strictEqual(res.formatted, '8 m/s');
});

test('string values parse via parseFloat; explicit siUnit stays out of the convert lines', () => {
  const res = solver.solve(kin01, 'v', {
    v0: { value: '16 m/s' },   // parseFloat prefix rule -> 16; unit defaults to siUnit
    a: { value: '2', unit: 'm/s^2' },
    t: { value: ' 3 ', unit: 's' }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.result.value, 22);
  assert.strictEqual(res.converted.v0.from, '16 m/s');
  assert.strictEqual(res.converted.v0.unit, 'm/s');
  assert.strictEqual(res.steps[2].text, 'All known values are already in SI units.');
  assert.strictEqual(res.formatted, '22 m/s');
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

test('bad-target: symbol not among the formula variables (or without solveFor entry)', () => {
  const knowns = { v0: { value: 10 }, a: { value: 2 }, t: { value: 3 } };
  const res = solver.solve(kin01, 'x', knowns);
  assert.deepStrictEqual(Object.keys(res).sort(), ['error', 'message', 'ok']);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'bad-target');
  assert.ok(res.message.indexOf("'x'") !== -1, 'message mentions the bad symbol');

  assert.strictEqual(solver.solve(kin01, 'Q', knowns).error, 'bad-target');
  assert.strictEqual(solver.solve(kin01, undefined, knowns).error, 'bad-target');

  const noSolveFor = { id: kin01.id, category: kin01.category, name: kin01.name,
    equation: kin01.equation, statement: kin01.statement, notes: kin01.notes,
    variables: kin01.variables, solveFor: { v: kin01.solveFor.v } };
  assert.strictEqual(solver.solve(noSolveFor, 't', knowns).error, 'bad-target');
});

test('missing: message lists ALL missing variables with descriptions', () => {
  const res = solver.solve(kin01, 'v', { a: { value: 2 } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'missing');
  assert.strictEqual(res.message,
    'Missing values for: v₀ (initial velocity), t (elapsed time). Go back to Step 2 and add them.');

  const all = solver.solve(kin01, 'v', {});
  assert.strictEqual(all.error, 'missing');
  assert.strictEqual(all.message,
    'Missing values for: v₀ (initial velocity), a (acceleration), t (elapsed time). Go back to Step 2 and add them.');

  // null/undefined entries count as missing too
  const nulls = solver.solve(kin01, 'v', { v0: null, a: { value: 2 }, t: { value: 3 } });
  assert.strictEqual(nulls.error, 'missing');
  assert.strictEqual(nulls.message,
    'Missing values for: v₀ (initial velocity). Go back to Step 2 and add them.');

  // knowns itself null behaves like {}
  assert.strictEqual(solver.solve(kin01, 'v', null).error, 'missing');
});

test('invalid-value: non-finite or unparsable values', () => {
  const badValues = ['abc', '', '   ', NaN, Infinity, -Infinity, null, true, {}, ['5']];
  for (const bad of badValues) {
    const res = solver.solve(kin01, 'v', {
      v0: { value: bad }, a: { value: 2 }, t: { value: 3 }
    });
    assert.strictEqual(res.ok, false, 'value ' + String(bad) + ' must fail');
    assert.strictEqual(res.error, 'invalid-value');
    assert.strictEqual(res.message, 'The value for v₀ is not a number.');
  }
  // entry without a value at all
  const noValue = solver.solve(kin01, 'v', { v0: { unit: 'm/s' }, a: { value: 2 }, t: { value: 3 } });
  assert.strictEqual(noValue.error, 'invalid-value');
  assert.strictEqual(noValue.message, 'The value for v₀ is not a number.');
});

test('dimension-mismatch: unit dimension differs from the variable dimension', () => {
  const kgForV0 = solver.solve(kin01, 'v', {
    v0: { value: 10, unit: 'kg' }, a: { value: 2 }, t: { value: 3 }
  });
  assert.strictEqual(kgForV0.ok, false);
  assert.strictEqual(kgForV0.error, 'dimension-mismatch');
  assert.strictEqual(kgForV0.message,
    "The unit 'kg' entered for v₀ (velocity) doesn't fit — expected a velocity unit.");

  const kgForT = solver.solve(kin01, 'v', {
    v0: { value: 10 }, a: { value: 2 }, t: { value: 3, unit: 'kg' }
  });
  assert.strictEqual(kgForT.error, 'dimension-mismatch');
  assert.strictEqual(kgForT.message,
    "The unit 'kg' entered for t (time) doesn't fit — expected a time unit.");

  // wrong-dimension alias
  const aliasWrong = solver.solve(kin01, 'v', {
    v0: { value: 10, unit: 'mA' }, a: { value: 2 }, t: { value: 3 }
  });
  assert.strictEqual(aliasWrong.error, 'dimension-mismatch');
  assert.strictEqual(aliasWrong.message,
    "The unit 'mA' entered for v₀ (velocity) doesn't fit — expected a velocity unit.");

  // unknown unit: normalize fails, dimension check fails -> dimension-mismatch (never a throw)
  const unknown = solver.solve(kin01, 'v', {
    v0: { value: 10, unit: 'xyz' }, a: { value: 2 }, t: { value: 3 }
  });
  assert.strictEqual(unknown.ok, false);
  assert.strictEqual(unknown.error, 'dimension-mismatch');
  assert.strictEqual(unknown.message,
    "The unit 'xyz' entered for v₀ (velocity) doesn't fit — expected a velocity unit.");
});

test('non-finite: zero denominators (NaN and Infinity) get the student message', () => {
  const zeroOverZero = solver.solve(kin01, 't', {
    v: { value: 10 }, v0: { value: 10 }, a: { value: 0 }
  });
  assert.strictEqual(zeroOverZero.ok, false);
  assert.strictEqual(zeroOverZero.error, 'non-finite');
  assert.strictEqual(zeroOverZero.message, NON_FINITE_MESSAGE);

  const sixOverZero = solver.solve(kin01, 't', {
    v: { value: 16 }, v0: { value: 10 }, a: { value: 0 }
  });
  assert.strictEqual(sixOverZero.error, 'non-finite');
  assert.strictEqual(sixOverZero.message, NON_FINITE_MESSAGE);

  const powerZero = solver.solve(pow01, 'V', { P: { value: 6 }, I: { value: 0 } });
  assert.strictEqual(powerZero.error, 'non-finite');
  assert.strictEqual(powerZero.message, NON_FINITE_MESSAGE);

  const gasZeroT = solver.solve(gas01, 'n', {
    P: { value: 1000 }, V: { value: 0.001 }, T: { value: 0 }
  });
  assert.strictEqual(gasZeroT.error, 'non-finite');
  assert.strictEqual(gasZeroT.message, NON_FINITE_MESSAGE);
});

test('non-finite: a throwing fn also gets the student message', () => {
  const res = solver.solve(boom01, 'x', { y: { value: 2 } });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'non-finite');
  assert.strictEqual(res.message, NON_FINITE_MESSAGE);
});

test('unexpected throws (e.g. units engine) become non-finite with the caught message', () => {
  const res = solver.solve(kin01, 'v', {
    v0: { value: 10, unit: 'bad' }, a: { value: 2 }, t: { value: 3 }
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'non-finite');
  assert.strictEqual(res.message, 'mock toSI exploded');
});

// ---------------------------------------------------------------------------
// Knowns edge cases
// ---------------------------------------------------------------------------

test('target and extra symbols present in knowns are ignored safely', () => {
  const res = solver.solve(kin01, 'v', {
    v: { value: 999, unit: 'kg' },        // target present with junk — ignored
    v0: { value: 10 },
    a: { value: 2 },
    t: { value: 3 },
    zz: { value: 1, unit: 'kg' }          // not a variable of the formula — ignored
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.result.value, 16);
  assert.deepStrictEqual(Object.keys(res.converted).sort(), ['a', 't', 'v0']);
  assert.strictEqual(res.assignments.length, 3);
  assert.strictEqual(res.steps[2].text, 'All known values are already in SI units.');
  assert.strictEqual(res.substituted, '? = 10 + 2·3');
});

test('solving for v₀ does not let the known "v" corrupt the longer target display', () => {
  const res = solver.solve(kin01, 'v0', {
    v: { value: 16 }, a: { value: -2 }, t: { value: 3 }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.substituted, '? = 16 - (-2)·3');
  assert.strictEqual(res.result.value, 22);
  assert.strictEqual(res.steps[3].text, 'v = 16 m/s; a = -2 m/s^2; t = 3 s  →  ? = 16 - (-2)·3');
  assert.strictEqual(res.steps[4].text, 'v₀ = 22 m/s');
  assert.strictEqual(res.steps[5].text, 'v₀ = 22 m/s (velocity)');
  assert.strictEqual(res.formatted, '22 m/s');
});

// ---------------------------------------------------------------------------
// Dimensionless variables
// ---------------------------------------------------------------------------

test('dimensionless variable: formatted has no trailing space; steps stay clean', () => {
  const res = solver.solve(fric01, 'mu', {
    f: { value: 10, unit: 'N' }, N: { value: 20, unit: 'N' }
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.result,
    { symbol: 'mu', display: 'μ', value: 0.5, unit: '', dimension: 'dimensionless' });
  assert.strictEqual(res.formatted, '0.5'); // no trailing space for dimensionless
  assert.deepStrictEqual(res.steps, [
    { label: 'Formula', text: 'f = μ·N' },
    { label: 'Rearranged', text: 'μ = f / N' },
    { label: 'Convert units', text: 'All known values are already in SI units.' },
    { label: 'Substitute', text: 'f = 10 N; N = 20 N  →  ? = 10 / 20' },
    { label: 'Compute', text: 'μ = 0.5' },
    { label: 'Result', text: 'μ = 0.5 (dimensionless)' }
  ]);
  assert.strictEqual(res.substituted, '? = 10 / 20');
  assert.deepStrictEqual(res.converted, {
    f: { from: '10 N', to: '10 N', value: 10, unit: 'N' },
    N: { from: '20 N', to: '20 N', value: 20, unit: 'N' }
  });

  // dimensionless KNOWN without a unit defaults to siUnit ''
  const solveN = solver.solve(fric01, 'N', { f: { value: 10 }, mu: { value: 0.5 } });
  assert.strictEqual(solveN.ok, true);
  assert.deepStrictEqual(solveN.converted.mu,
    { from: '0.5', to: '0.5', value: 0.5, unit: '' });
  assert.strictEqual(solveN.steps[3].text, 'f = 10 N; μ = 0.5  →  ? = 10 / 0.5');
  assert.strictEqual(solveN.result.value, 20);
  assert.strictEqual(solveN.formatted, '20 N');
});

// ---------------------------------------------------------------------------
// Current conversion (mA → A)
// ---------------------------------------------------------------------------

test('P = V·I with I given in mA converts to SI before substituting', () => {
  const res = solver.solve(pow01, 'P', { V: { value: 12 }, I: { value: 250, unit: 'mA' } });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.converted.I.from, '250 mA');
  assert.strictEqual(res.converted.I.to, '0.25 A');
  assertApprox(res.converted.I.value, 0.25);
  assert.strictEqual(res.converted.I.unit, 'A');
  assert.deepStrictEqual(res.converted.V,
    { from: '12 V', to: '12 V', value: 12, unit: 'V' });
  assert.strictEqual(res.steps[2].text, 'I: 250 mA → 0.25 A');
  assert.strictEqual(res.steps[3].text, 'V = 12 V; I = 0.25 A  →  ? = 12·0.25');
  assert.strictEqual(res.steps[4].text, 'P = 3 W');
  assert.strictEqual(res.steps[5].text, 'P = 3 W (power)');
  assert.strictEqual(res.substituted, '? = 12·0.25');
  assertApprox(res.result.value, 3);
  assert.strictEqual(res.formatted, '3 W');
});

// ---------------------------------------------------------------------------
// Temperature offsets through the mock engine
// ---------------------------------------------------------------------------

test('temperature known in °C converts with the offset (25 °C -> 298.15 K)', () => {
  const res = solver.solve(gas01, 'P', {
    V: { value: 0.001, unit: 'm³' },
    n: { value: 0.04 },
    T: { value: 25, unit: '°C' }
  });
  assert.strictEqual(res.ok, true);
  assertApprox(res.converted.T.value, 298.15);
  assert.strictEqual(res.converted.T.from, '25 °C');
  assert.strictEqual(res.converted.T.to, mockUnits.formatValue(25 + 273.15) + ' K');
  assert.strictEqual(res.converted.T.unit, 'K');
  assert.strictEqual(res.steps[2].text,
    'T: 25 °C → ' + mockUnits.formatValue(25 + 273.15) + ' K');

  const expectedP = 0.04 * 8.314 * (25 + 273.15) / 0.001;
  assertApprox(res.result.value, expectedP);
  assert.strictEqual(res.substituted,
    '? = ' + mockUnits.formatValue(0.04) + '·R·' + mockUnits.formatValue(25 + 273.15) +
    ' / ' + mockUnits.formatValue(0.001));
  assert.strictEqual(res.steps[4].text, 'P = ' + mockUnits.formatValue(expectedP) + ' Pa');
  assert.strictEqual(res.steps[5].text, 'P = ' + mockUnits.formatValue(expectedP) + ' Pa (pressure)');
  assert.strictEqual(res.formatted, mockUnits.formatValue(expectedP) + ' Pa');
});

test('temperature alias degC resolves via normalize in a solve', () => {
  const res = solver.solve(gas01, 'V', {
    P: { value: 2000 },
    n: { value: 0.04 },
    T: { value: 25, unit: 'degC' }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.converted.T.from, '25 degC');
  assert.strictEqual(res.converted.T.to, mockUnits.formatValue(25 + 273.15) + ' K');
  const expectedV = 0.04 * 8.314 * (25 + 273.15) / 2000;
  assertApprox(res.result.value, expectedV);
  assert.strictEqual(res.formatted, mockUnits.formatValue(expectedV) + ' m³');
  assert.strictEqual(res.steps[2].text,
    'T: 25 degC → ' + mockUnits.formatValue(25 + 273.15) + ' K');
});

// ---------------------------------------------------------------------------
// Dual-registered symbols — dimension-aware resolution (°C as an interval,
// g as standard gravity), mirroring the real units engine.
// ---------------------------------------------------------------------------

const heat01 = {
  id: 'thermal-01',
  category: 'thermal',
  name: 'Heat needed for a temperature change',
  equation: 'Q = m·c·ΔT',
  statement: 'Heat equals mass times specific heat times the temperature change.',
  notes: 'ΔT is a temperature interval, not an absolute temperature.',
  variables: [
    { symbol: 'Q',  display: 'Q',  description: 'heat added',         dimension: 'energy',               siUnit: 'J',        commonUnits: [] },
    { symbol: 'm',  display: 'm',  description: 'mass',               dimension: 'mass',                 siUnit: 'kg',       commonUnits: [] },
    { symbol: 'c',  display: 'c',  description: 'specific heat',      dimension: 'specific-heat',        siUnit: 'J/(kg·K)', commonUnits: [] },
    { symbol: 'dT', display: 'ΔT', description: 'temperature change', dimension: 'temperature-interval', siUnit: 'K',        commonUnits: ['°C'] }
  ],
  solveFor: {
    Q:  { rearranged: 'Q = m·c·ΔT',     fn: function (k) { return k.m * k.c * k.dT; } },
    m:  { rearranged: 'm = Q / (c·ΔT)', fn: function (k) { return k.Q / (k.c * k.dT); } },
    c:  { rearranged: 'c = Q / (m·ΔT)', fn: function (k) { return k.Q / (k.m * k.dT); } },
    dT: { rearranged: 'ΔT = Q / (m·c)', fn: function (k) { return k.Q / (k.m * k.c); } }
  }
};

const wt01 = {
  id: 'forces-02',
  category: 'forces',
  name: 'Weight',
  equation: 'W = m·g',
  statement: 'Weight equals mass times gravitational acceleration.',
  notes: 'Near Earth, g ≈ 9.81 m/s^2.',
  variables: [
    { symbol: 'W', display: 'W', description: 'weight',                   dimension: 'force',       siUnit: 'N',     commonUnits: [] },
    { symbol: 'm', display: 'm', description: 'mass',                     dimension: 'mass',        siUnit: 'kg',    commonUnits: [] },
    { symbol: 'g', display: 'g', description: 'gravitational acceleration', dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: ['g'] }
  ],
  solveFor: {
    W: { rearranged: 'W = m·g', fn: function (k) { return k.m * k.g; } },
    m: { rearranged: 'm = W / g', fn: function (k) { return k.W / k.g; } },
    g: { rearranged: 'g = W / m', fn: function (k) { return k.W / k.m; } }
  }
};

test('temperature-interval known in plain °C converts as an interval (25 °C -> 25 K, no offset)', () => {
  const res = solver.solve(heat01, 'Q', {
    m: { value: 0.5 },
    c: { value: 4184 },
    dT: { value: 25, unit: '°C' }
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.converted.dT,
    { from: '25 °C', to: '25 K', value: 25, unit: 'K' });
  assert.strictEqual(res.steps[2].text, 'ΔT: 25 °C → 25 K');
  assert.strictEqual(res.substituted, '? = 0.5·4184·25');
  assert.strictEqual(res.result.value, 52300);
  assert.strictEqual(res.formatted, '52300 J');
});

test('solving back for the interval recovers 25 K from Q = 52300 J', () => {
  const res = solver.solve(heat01, 'dT', {
    Q: { value: 52300 },
    m: { value: 0.5 },
    c: { value: 4184 }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.result.value, 25);
  assert.strictEqual(res.formatted, '25 K');
});

test("acceleration known in standard-gravity 'g' resolves via the dimension record (1 g -> 9.80665 m/s^2)", () => {
  const res = solver.solve(wt01, 'W', {
    m: { value: 2 },
    g: { value: 1, unit: 'g' }
  });
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.converted.g,
    { from: '1 g', to: '9.807 m/s^2', value: 9.80665, unit: 'm/s^2' });
  assert.strictEqual(res.steps[2].text, 'g: 1 g → 9.807 m/s^2');
  assertApprox(res.result.value, 19.6133);
  assert.strictEqual(res.formatted, '19.61 N');
});

test('interval Δ°F converts by its factor (180 Δ°F -> 100 K), not by an absolute offset', () => {
  const res = solver.solve(heat01, 'Q', {
    m: { value: 1 },
    c: { value: 4184 },
    dT: { value: 180, unit: 'Δ°F' }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.converted.dT.value, 100);
  assert.strictEqual(res.result.value, 418400);
  assert.strictEqual(res.formatted, '4.184 × 10^5 J');
});