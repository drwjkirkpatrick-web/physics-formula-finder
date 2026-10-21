/*
 * physics-formula-finder — tests/formulas.test.js (Builder B)
 *
 * Tests for the curated 56-formula database. Runner (from repo root):
 *     node --test tests/formulas.test.js
 *
 * No sibling modules are imported: the dimension→unit map below is
 * hardcoded from §UNITS in SPEC.md, per the build rules.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PhysicsFormulas = require('../js/formulas.js');

// ---------------------------------------------------------------------
// Hardcoded expectations (independent of the module under test)
// ---------------------------------------------------------------------

// Canonical dimension order (§Dimensions, SPEC.md)
const DIM_ORDER = [
  'length', 'time', 'mass', 'velocity', 'acceleration', 'force', 'energy',
  'power', 'momentum', 'pressure', 'temperature', 'temperature-interval',
  'charge', 'current', 'voltage', 'resistance', 'capacitance', 'frequency',
  'angle', 'area', 'volume', 'density', 'amount', 'dimensionless',
  'spring-constant', 'linear-density', 'intensity', 'resistivity',
  'specific-heat', 'latent-heat', 'thermal-expansivity'
];

// Dimension → { si: SI unit string, all: every registered unit symbol }
// (§UNITS table, SPEC.md — hardcoded here, NOT imported from js/units.js)
const UNITS = {
  'length':                { si: 'm',        all: ['m', 'km', 'cm', 'mm', 'μm', 'mi', 'yd', 'ft', 'in'] },
  'time':                  { si: 's',        all: ['s', 'ms', 'μs', 'min', 'hr', 'day'] },
  'mass':                  { si: 'kg',       all: ['kg', 'g', 'mg', 't', 'lb'] },
  'velocity':              { si: 'm/s',      all: ['m/s', 'km/h', 'mph', 'ft/s', 'cm/s'] },
  'acceleration':          { si: 'm/s^2',    all: ['m/s^2', 'ft/s^2', 'g'] },
  'force':                 { si: 'N',        all: ['N', 'kN', 'mN', 'dyn', 'lbf'] },
  'energy':                { si: 'J',        all: ['J', 'kJ', 'cal', 'kcal', 'eV', 'kWh'] },
  'power':                 { si: 'W',        all: ['W', 'kW', 'MW', 'hp'] },
  'momentum':              { si: 'kg*m/s',   all: ['kg*m/s'] },
  'pressure':              { si: 'Pa',       all: ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi', 'mmHg', 'torr'] },
  'temperature':           { si: 'K',        all: ['K', '°C', '°F'] },
  'temperature-interval':  { si: 'K',        all: ['K', '°C', '°F'] },
  'charge':                { si: 'C',        all: ['C', 'mC', 'μC', 'nC'] },
  'current':               { si: 'A',        all: ['A', 'mA', 'μA'] },
  'voltage':               { si: 'V',        all: ['V', 'mV', 'kV'] },
  'resistance':            { si: 'Ω',        all: ['Ω', 'mΩ', 'kΩ', 'MΩ'] },
  'capacitance':           { si: 'F',        all: ['F', 'mF', 'μF', 'nF', 'pF'] },
  'frequency':             { si: 'Hz',       all: ['Hz', 'kHz', 'MHz', 'GHz'] },
  'angle':                 { si: 'rad',      all: ['rad', '°'] },
  'area':                  { si: 'm²',       all: ['m²', 'cm²', 'ft²', 'in²'] },
  'volume':                { si: 'm³',       all: ['m³', 'L', 'mL', 'cm³', 'gal'] },
  'density':               { si: 'kg/m³',    all: ['kg/m³', 'g/cm³'] },
  'amount':                { si: 'mol',      all: ['mol', 'kmol', 'mmol'] },
  'dimensionless':         { si: '',         all: [''] },
  'spring-constant':       { si: 'N/m',      all: ['N/m'] },
  'linear-density':        { si: 'kg/m',     all: ['kg/m'] },
  'intensity':             { si: 'W/m²',     all: ['W/m²'] },
  'resistivity':           { si: 'Ω*m',      all: ['Ω*m'] },
  'specific-heat':         { si: 'J/(kg·K)', all: ['J/(kg·K)'] },
  'latent-heat':           { si: 'J/kg',     all: ['J/kg', 'kcal/kg'] },
  'thermal-expansivity':   { si: '1/K',      all: ['1/K'] }
};

// Categories (id → display name, in SPEC order)
const EXPECTED_CATEGORIES = [
  ['kinematics', 'Kinematics'],
  ['forces', "Forces & Newton's Laws"],
  ['energy', 'Work, Energy & Power'],
  ['momentum', 'Momentum & Impulse'],
  ['circular', 'Circular Motion & Gravitation'],
  ['waves', 'Waves & Sound'],
  ['optics', 'Optics'],
  ['electricity', 'Electricity & Circuits'],
  ['fluids', 'Fluids & Pressure'],
  ['thermal', 'Thermal & Modern Physics']
];

// All 56 ids in inventory order
const EXPECTED_IDS = [
  'kinematics-01', 'kinematics-02', 'kinematics-03', 'kinematics-04', 'kinematics-05', 'kinematics-06',
  'forces-01', 'forces-02', 'forces-03', 'forces-04',
  'energy-01', 'energy-02', 'energy-03', 'energy-04', 'energy-05', 'energy-06', 'energy-07',
  'momentum-01', 'momentum-02', 'momentum-03',
  'circular-01', 'circular-02', 'circular-03', 'circular-04', 'circular-05', 'circular-06', 'circular-07',
  'waves-01', 'waves-02', 'waves-03', 'waves-04', 'waves-05',
  'optics-01', 'optics-02', 'optics-03', 'optics-04', 'optics-05',
  'electricity-01', 'electricity-02', 'electricity-03', 'electricity-04',
  'electricity-05', 'electricity-06', 'electricity-07', 'electricity-08',
  'fluids-01', 'fluids-02', 'fluids-03', 'fluids-04',
  'thermal-01', 'thermal-02', 'thermal-03', 'thermal-04', 'thermal-05', 'thermal-06', 'thermal-07'
];

const EXPECTED_CATEGORY_COUNTS = {
  kinematics: 6, forces: 4, energy: 7, momentum: 3, circular: 7, waves: 5,
  optics: 5, electricity: 8, fluids: 4, thermal: 7
};

// Physics constants per SPEC.md (checked independently of the module)
const G = 6.674e-11;
const C = 2.998e8;
const H = 6.626e-34;
const K_E = 8.988e9;
const RGAS = 8.314;

// Tolerance helper: relative 1e-9, absolute 1e-9 near zero (per §TESTS)
function approx(a, b, rel = 1e-9, abs = 1e-9) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) { return false; }
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= Math.max(abs, rel * scale);
}

// ---------------------------------------------------------------------
// categories, listing, lookup
// ---------------------------------------------------------------------
describe('categories and listing', () => {
  test('exposes exactly the 10 SPEC categories in order', () => {
    const cats = PhysicsFormulas.categories;
    assert.ok(Array.isArray(cats));
    assert.strictEqual(cats.length, 10);
    EXPECTED_CATEGORIES.forEach(([id, name], i) => {
      assert.strictEqual(cats[i].id, id, `category ${i} id`);
      assert.strictEqual(cats[i].name, name, `category ${i} name`);
    });
  });

  test('list() returns all 56 formulas in inventory order with unique ids', () => {
    const all = PhysicsFormulas.list();
    assert.strictEqual(all.length, 56);
    assert.deepStrictEqual(all.map((f) => f.id), EXPECTED_IDS);
    assert.strictEqual(new Set(all.map((f) => f.id)).size, 56);
  });

  test('list() returns a fresh array (mutating it does not corrupt the module)', () => {
    const a = PhysicsFormulas.list();
    a.pop();
    a.shift();
    assert.strictEqual(PhysicsFormulas.list().length, 56);
  });

  test('byId finds each formula (same object) and returns undefined otherwise', () => {
    for (const f of PhysicsFormulas.list()) {
      assert.strictEqual(PhysicsFormulas.byId(f.id), f);
    }
    assert.strictEqual(PhysicsFormulas.byId('does-not-exist'), undefined);
    assert.strictEqual(PhysicsFormulas.byId('kinematics-01').name, 'Velocity with constant acceleration');
  });

  test('byCategory returns exactly that category\'s formulas, in order', () => {
    const all = PhysicsFormulas.list();
    for (const [id] of EXPECTED_CATEGORIES) {
      const got = PhysicsFormulas.byCategory(id);
      assert.strictEqual(got.length, EXPECTED_CATEGORY_COUNTS[id], `category ${id} count`);
      assert.ok(got.every((f) => f.category === id));
      assert.deepStrictEqual(
        got.map((f) => f.id),
        all.filter((f) => f.category === id).map((f) => f.id)
      );
    }
    assert.deepStrictEqual(PhysicsFormulas.byCategory('nope'), []);
  });
});

// ---------------------------------------------------------------------
// schema integrity
// ---------------------------------------------------------------------
describe('schema integrity', () => {
  test('every formula has well-formed fields', () => {
    for (const f of PhysicsFormulas.list()) {
      assert.strictEqual(typeof f.id, 'string', f.id);
      assert.strictEqual(typeof f.category, 'string', f.id);
      for (const field of ['name', 'equation', 'statement', 'notes']) {
        assert.strictEqual(typeof f[field], 'string', `${f.id}.${field}`);
        assert.ok(f[field].length > 0, `${f.id}: ${field} is empty`);
      }
      assert.ok(f.id.startsWith(f.category + '-'), `${f.id}: id does not match category`);
      assert.ok(EXPECTED_CATEGORIES.some(([id]) => id === f.category), `${f.id}: unknown category`);
      assert.ok(Array.isArray(f.variables) && f.variables.length >= 2, `${f.id}: variables`);
      assert.ok(f.solveFor && typeof f.solveFor === 'object', `${f.id}: solveFor`);
    }
  });

  test('every variable record is complete with unique symbols and displays', () => {
    for (const f of PhysicsFormulas.list()) {
      const syms = new Set();
      const disp = new Set();
      for (const v of f.variables) {
        assert.strictEqual(typeof v.symbol, 'string', `${f.id}.${v.symbol}`);
        assert.strictEqual(typeof v.display, 'string', `${f.id}.${v.symbol}`);
        assert.ok(v.symbol.length > 0 && v.display.length > 0, `${f.id}: empty symbol/display`);
        assert.strictEqual(typeof v.description, 'string', `${f.id}.${v.symbol}`);
        assert.ok(v.description.length > 0, `${f.id}.${v.symbol}: empty description`);
        assert.ok(Object.prototype.hasOwnProperty.call(UNITS, v.dimension), `${f.id}.${v.symbol}: unknown dimension ${v.dimension}`);
        assert.ok(Array.isArray(v.commonUnits), `${f.id}.${v.symbol}: commonUnits`);
        assert.ok(!syms.has(v.symbol), `${f.id}: duplicate symbol ${v.symbol}`);
        assert.ok(!disp.has(v.display), `${f.id}: duplicate display ${v.display}`);
        syms.add(v.symbol);
        disp.add(v.display);
      }
    }
  });

  test('every variable has a solveFor entry and the key sets are identical', () => {
    for (const f of PhysicsFormulas.list()) {
      const varSyms = new Set(f.variables.map((v) => v.symbol));
      const solveSyms = new Set(Object.keys(f.solveFor));
      assert.strictEqual(solveSyms.size, varSyms.size, `${f.id}: solveFor/variables size`);
      for (const s of varSyms) {
        assert.ok(solveSyms.has(s), `${f.id}: missing solveFor.${s}`);
        const entry = f.solveFor[s];
        assert.strictEqual(typeof entry.rearranged, 'string', `${f.id}.${s}: rearranged`);
        assert.ok(entry.rearranged.length > 0, `${f.id}.${s}: empty rearranged`);
        assert.strictEqual(typeof entry.fn, 'function', `${f.id}.${s}: fn`);
        const target = f.variables.find((v) => v.symbol === s);
        assert.ok(
          entry.rearranged.startsWith(target.display),
          `${f.id}.${s}: rearranged "${entry.rearranged}" must start with target display "${target.display}"`
        );
      }
    }
  });

  test('siUnit is the dimension\'s SI unit; commonUnits are registered non-SI units of that dimension', () => {
    for (const f of PhysicsFormulas.list()) {
      for (const v of f.variables) {
        const u = UNITS[v.dimension];
        const where = `${f.id}.${v.symbol} (${v.dimension})`;
        assert.strictEqual(v.siUnit, u.si, `${where}: siUnit '${v.siUnit}' != '${u.si}'`);
        assert.strictEqual(new Set(v.commonUnits).size, v.commonUnits.length, `${where}: duplicate commonUnits`);
        for (const cu of v.commonUnits) {
          assert.ok(u.all.includes(cu), `${where}: '${cu}' is not a registered unit of this dimension`);
          assert.notStrictEqual(cu, u.si, `${where}: siUnit listed among commonUnits`);
        }
      }
    }
  });

  test('every variable display token appears in the equation', () => {
    for (const f of PhysicsFormulas.list()) {
      for (const v of f.variables) {
        assert.ok(
          f.equation.includes(v.display),
          `${f.id}: display '${v.display}' missing from equation '${f.equation}'`
        );
      }
    }
  });

  test('each rearranged string contains every variable display (energy-07 mass exception)', () => {
    // In energy-07 the mass cancels, so 'm' legitimately cannot appear in the
    // rearrangements that solve for the other variables.
    const EXCEPTIONS = { 'energy-07': ['m'] };
    for (const f of PhysicsFormulas.list()) {
      const skip = EXCEPTIONS[f.id] || [];
      for (const sym of Object.keys(f.solveFor)) {
        const r = f.solveFor[sym].rearranged;
        for (const v of f.variables) {
          if (skip.includes(v.symbol)) { continue; }
          assert.ok(
            r.includes(v.display),
            `${f.id} solveFor.${sym}: display '${v.display}' missing from "${r}"`
          );
        }
      }
    }
  });

  test('display strings use ASCII minus (never U+2212)', () => {
    for (const f of PhysicsFormulas.list()) {
      const strings = [f.equation].concat(Object.keys(f.solveFor).map((s) => f.solveFor[s].rearranged));
      for (const s of strings) {
        assert.ok(!s.includes('\u2212'), `${f.id}: U+2212 minus sign in "${s}"`);
      }
    }
  });
});

// ---------------------------------------------------------------------
// numeric spot checks with real physics values (per SPEC.md)
// ---------------------------------------------------------------------
describe('numeric spot checks', () => {
  test('kinematics-01: v0=10, a=2, t=3 → v=16', () => {
    const f = PhysicsFormulas.byId('kinematics-01');
    assert.strictEqual(f.solveFor.v.fn({ v0: 10, a: 2, t: 3 }), 16);
    assert.ok(approx(f.solveFor.v0.fn({ v: 16, a: 2, t: 3 }), 10));
    assert.ok(approx(f.solveFor.a.fn({ v: 16, v0: 10, t: 3 }), 2));
    assert.ok(approx(f.solveFor.t.fn({ v: 16, v0: 10, a: 2 }), 3));
  });

  test('kinematics-02 root convention: v0=0, a=2, Δx=25 → t=5; braking v0=20, a=-4, Δx=50 → t=5', () => {
    const f = PhysicsFormulas.byId('kinematics-02');
    assert.ok(approx(f.solveFor.t.fn({ v0: 0, a: 2, dx: 25 }), 5));
    assert.ok(approx(f.solveFor.t.fn({ v0: 20, a: -4, dx: 50 }), 5));
  });

  test('forces-01: m=2, a=9.81 → F=19.62', () => {
    const f = PhysicsFormulas.byId('forces-01');
    assert.ok(approx(f.solveFor.F.fn({ m: 2, a: 9.81 }), 19.62));
    assert.ok(approx(f.solveFor.m.fn({ F: 19.62, a: 9.81 }), 2));
    assert.ok(approx(f.solveFor.a.fn({ F: 19.62, m: 2 }), 9.81));
  });

  test('energy-02: m=2, v=3 → KE=9', () => {
    const f = PhysicsFormulas.byId('energy-02');
    assert.ok(approx(f.solveFor.KE.fn({ m: 2, v: 3 }), 9));
    assert.ok(approx(f.solveFor.m.fn({ KE: 9, v: 3 }), 2));
    assert.ok(approx(f.solveFor.v.fn({ KE: 9, m: 2 }), 3));
  });

  test('energy-03: m=2, g=9.81, h=10 → PE=196.2', () => {
    const f = PhysicsFormulas.byId('energy-03');
    assert.ok(approx(f.solveFor.PE.fn({ m: 2, g: 9.81, h: 10 }), 196.2));
    assert.ok(approx(f.solveFor.h.fn({ PE: 196.2, m: 2, g: 9.81 }), 10));
  });

  test('optics-05: n1=1, θ1=30° (π/6 rad), n2=1.5 → sin(θ2) = 1/3 (radians)', () => {
    const f = PhysicsFormulas.byId('optics-05');
    const th2 = f.solveFor.theta2.fn({ n1: 1, theta1: Math.PI / 6, n2: 1.5 });
    assert.ok(approx(Math.sin(th2), 1 / 3));
    assert.ok(approx(th2, Math.asin(1 / 3)));
    // Snell's law holds both ways
    const th1 = f.solveFor.theta1.fn({ n1: 1, theta2: th2, n2: 1.5 });
    assert.ok(approx(th1, Math.PI / 6));
  });

  test('thermal-04: solved T is consistent with P·V = n·R·T (R = 8.314)', () => {
    const f = PhysicsFormulas.byId('thermal-04');
    const T = f.solveFor.T.fn({ P: 101325, V: 0.001, n: 0.04 });
    assert.ok(approx(T, (101325 * 0.001) / (0.04 * RGAS)));
    assert.ok(approx(101325 * 0.001, 0.04 * RGAS * T, 1e-9, 1e-6));
    // round-trip through the other variables
    assert.ok(approx(f.solveFor.P.fn({ V: 0.001, n: 0.04, T }), 101325));
    assert.ok(approx(f.solveFor.V.fn({ P: 101325, n: 0.04, T }), 0.001));
    assert.ok(approx(f.solveFor.n.fn({ P: 101325, V: 0.001, T }), 0.04));
  });

  test('waves-03 beats: |60 - 50| = 10, and both solving directions', () => {
    const f = PhysicsFormulas.byId('waves-03');
    assert.strictEqual(f.solveFor.fbeat.fn({ f1: 60, f2: 50 }), 10);
    assert.strictEqual(f.solveFor.f1.fn({ f2: 50, fbeat: 10 }), 60);
    assert.strictEqual(f.solveFor.f2.fn({ f1: 60, fbeat: 10 }), 50);
  });
});

// ---------------------------------------------------------------------
// embedded constants, checked against independently hardcoded values
// ---------------------------------------------------------------------
describe('embedded constants', () => {
  test('circular-04 Earth–Moon force uses G = 6.674e-11', () => {
    const f = PhysicsFormulas.byId('circular-04');
    const m1 = 5.972e24, m2 = 7.348e22, r = 3.844e8;
    const expected = (G * m1 * m2) / (r * r);
    assert.ok(approx(f.solveFor.Fg.fn({ m1, m2, r }), expected, 1e-12));
    assert.ok(approx(f.solveFor.Fg.fn({ m1, m2, r }), 1.982e20, 1e-3)); // ≈ 1.98 × 10²⁰ N
    assert.ok(approx(f.solveFor.r.fn({ m1, m2, Fg: expected }), r, 1e-12));
  });

  test('circular-05 Earth surface gravity uses G = 6.674e-11 (g ≈ 9.81 m/s^2)', () => {
    const g = PhysicsFormulas.byId('circular-05').solveFor.g.fn({ M: 5.972e24, r: 6.371e6 });
    assert.ok(approx(g, (G * 5.972e24) / (6.371e6 * 6.371e6), 1e-12));
    assert.ok(approx(g, 9.812, 1e-3));
  });

  test('electricity-07 Coulomb force uses k_e = 8.988e9', () => {
    const f = PhysicsFormulas.byId('electricity-07');
    const F = f.solveFor.F.fn({ q1: 1e-6, q2: 2e-6, r: 0.5 });
    assert.ok(approx(F, (K_E * 1e-6 * 2e-6) / 0.25, 1e-12));
    assert.ok(approx(f.solveFor.q1.fn({ F, q2: 2e-6, r: 0.5 }), 1e-6, 1e-12));
  });

  test('optics-04 uses c = 2.998e8', () => {
    const f = PhysicsFormulas.byId('optics-04');
    assert.ok(approx(f.solveFor.n.fn({ v: 2.25e8 }), C / 2.25e8, 1e-12));
    assert.ok(approx(f.solveFor.v.fn({ n: 1.5 }), C / 1.5, 1e-12));
  });

  test('thermal-05 photon energy uses h = 6.626e-34', () => {
    const f = PhysicsFormulas.byId('thermal-05');
    const E = f.solveFor.E.fn({ f: 5.0e14 });
    assert.ok(approx(E, H * 5.0e14, 1e-12));
    assert.ok(approx(E, 3.313e-19, 1e-3));
    assert.ok(approx(f.solveFor.f.fn({ E }), 5.0e14, 1e-12));
  });

  test('thermal-06 mass-energy equivalence uses c = 2.998e8', () => {
    const f = PhysicsFormulas.byId('thermal-06');
    assert.ok(approx(f.solveFor.E.fn({ m: 1e-3 }), 1e-3 * C * C, 1e-12));
    assert.ok(approx(f.solveFor.m.fn({ E: 1e-3 * C * C }), 1e-3, 1e-12));
  });

  test('thermal-07 de Broglie wavelength uses h = 6.626e-34', () => {
    const f = PhysicsFormulas.byId('thermal-07');
    const lam = f.solveFor.lambda.fn({ m: 9.109e-31, v: 2.0e6 });
    assert.ok(approx(lam, H / (9.109e-31 * 2.0e6), 1e-12));
    assert.ok(approx(lam, 3.647e-10, 1e-3)); // ≈ 0.36 nm
    assert.ok(approx(f.solveFor.m.fn({ lambda: lam, v: 2.0e6 }), 9.109e-31, 1e-9));
  });
});

// ---------------------------------------------------------------------
// generic round-trip sweep over every formula and every variable
// ---------------------------------------------------------------------
describe('generic round-trip sweep', () => {
  // Per-dimension sample SI values used to build knowns.
  const SAMPLES = {
    'length': 25,
    'time': 5,
    'mass': 2,
    'velocity': 6,
    'acceleration': 9.81,
    'force': 20,
    'energy': 50,
    'power': 100,
    'momentum': 12,
    'pressure': 101325,
    'temperature': 293,
    'temperature-interval': 20,
    'charge': 0.01,
    'current': 2,
    'voltage': 12,
    'resistance': 100,
    'capacitance': 0.01,
    'frequency': 60,
    'angle': 0.5,
    'area': 4,
    'volume': 0.002,
    'density': 1000,
    'amount': 1,
    'dimensionless': 1.5,
    'spring-constant': 200,
    'linear-density': 0.01,
    'intensity': 0.5,
    'resistivity': 0.1,
    'specific-heat': 100,
    'latent-heat': 5000,
    'thermal-expansivity': 0.01
  };

  // Per-formula overrides so the raw per-dimension samples satisfy each
  // equation (avoiding degenerate cases like v = v0 or 1/f - 1/do = 0).
  const OVERRIDES = {
    'kinematics-01': { v0: 4 },
    'kinematics-02': { v0: 4 },
    'kinematics-03': { v0: 4 },
    'waves-03': { fbeat: 10, f1: 60, f2: 50 },   // avoid f1 = f2 degenerate case
    'energy-07': { v1: 3, h1: 5, h2: 2 },        // make the energies balance
    'optics-01': { f: 10 },                      // avoid 1/f - 1/do = 0
    'optics-02': { m: -0.5 },                    // inverted image, do > 0
    'thermal-04': { V: 0.024 }                   // n·R·T ≈ P·V at room temperature
  };

  // Build a consistent value set for a formula: every variable gets its
  // per-dimension sample (or override); the LAST variable is computed from
  // the others through its own solveFor fn, which guarantees the set
  // satisfies the equation exactly.
  function consistentValues(f) {
    const ov = OVERRIDES[f.id] || {};
    const values = {};
    const pivot = f.variables[f.variables.length - 1];
    for (const v of f.variables) {
      if (Object.prototype.hasOwnProperty.call(ov, v.symbol)) {
        values[v.symbol] = ov[v.symbol];
      } else if (v.symbol === pivot.symbol) {
        values[v.symbol] = f.solveFor[v.symbol].fn(values);
      } else {
        values[v.symbol] = SAMPLES[v.dimension];
      }
    }
    return values;
  }

  test('for every formula and every variable: solve for it, then chain to a second variable', () => {
    let direct = 0;
    let chained = 0;
    let formulas = 0;
    for (const f of PhysicsFormulas.list()) {
      formulas += 1;
      const values = consistentValues(f);
      // energy-07's mass cancels out of the conservation equation, so its
      // solveFor.m cannot recover the sample (it returns NaN by design);
      // every other fn in energy-07 correctly ignores m.
      const skip = f.id === 'energy-07' ? ['m'] : [];
      for (const x of f.variables) {
        const knowns = {};
        for (const v of f.variables) {
          if (v.symbol !== x.symbol) { knowns[v.symbol] = values[v.symbol]; }
        }
        const rx = f.solveFor[x.symbol].fn(knowns);
        if (!skip.includes(x.symbol)) {
          assert.ok(Number.isFinite(rx), `${f.id}: solveFor.${x.symbol} returned ${rx}`);
          assert.ok(
            approx(rx, values[x.symbol]),
            `${f.id}: solving ${x.symbol} gave ${rx}, expected ${values[x.symbol]}`
          );
          direct += 1;
        }
        // Chain: solve for a different variable y using x's result.
        const y = f.variables.find((v) => v.symbol !== x.symbol && !skip.includes(v.symbol));
        if (!y) { continue; }
        const knowns2 = Object.assign({}, knowns);
        knowns2[x.symbol] = rx;
        delete knowns2[y.symbol];
        const ry = f.solveFor[y.symbol].fn(knowns2);
        assert.ok(Number.isFinite(ry), `${f.id}: chained solveFor.${y.symbol} returned ${ry}`);
        assert.ok(
          approx(ry, values[y.symbol]),
          `${f.id}: chained solve for ${y.symbol} (after solving ${x.symbol}) gave ${ry}, expected ${values[y.symbol]}`
        );
        chained += 1;
      }
    }
    // Completeness proof: 56 formulas, 183 variables total; only energy-07's
    // degenerate 'm' direct check is skipped, and every x chains to some y.
    assert.strictEqual(formulas, 56);
    assert.strictEqual(direct, 182);
    assert.strictEqual(chained, 183);
  });
});

// ---------------------------------------------------------------------
// allSymbols()
// ---------------------------------------------------------------------
describe('allSymbols()', () => {
  test('one entry per unique (symbol, dimension) pair, correctly sorted and merged', () => {
    // Expected pairs and commonUnits unions, computed from the database.
    const expected = new Map();
    for (const f of PhysicsFormulas.list()) {
      for (const v of f.variables) {
        const key = v.symbol + '|' + v.dimension;
        if (!expected.has(key)) { expected.set(key, new Set()); }
        v.commonUnits.forEach((u) => expected.get(key).add(u));
      }
    }

    const syms = PhysicsFormulas.allSymbols();
    assert.strictEqual(syms.length, expected.size);

    const seen = new Set();
    for (const s of syms) {
      const key = s.symbol + '|' + s.dimension;
      assert.ok(!seen.has(key), `duplicate pair ${key}`);
      seen.add(key);
      assert.strictEqual(typeof s.symbol, 'string');
      assert.ok(s.symbol.length > 0);
      assert.strictEqual(typeof s.description, 'string');
      assert.ok(s.description.length > 0, `${key}: empty description`);
      assert.ok(Object.prototype.hasOwnProperty.call(UNITS, s.dimension), `${key}: unknown dimension`);
      assert.strictEqual(s.siUnit, UNITS[s.dimension].si, `${key}: siUnit`);
      // merged commonUnits: exactly the union across the DB, no duplicates,
      // every unit valid for the dimension
      const union = expected.get(key);
      assert.strictEqual(new Set(s.commonUnits).size, s.commonUnits.length, `${key}: duplicate commonUnits`);
      assert.strictEqual(s.commonUnits.length, union.size, `${key}: merged commonUnits incomplete`);
      for (const u of s.commonUnits) {
        assert.ok(union.has(u), `${key}: unexpected unit ${u}`);
        assert.ok(UNITS[s.dimension].all.includes(u), `${key}: '${u}' not a ${s.dimension} unit`);
      }
    }

    // Sorted by canonical dimension order, then symbol.
    for (let i = 1; i < syms.length; i++) {
      const a = syms[i - 1];
      const b = syms[i];
      const da = DIM_ORDER.indexOf(a.dimension);
      const db = DIM_ORDER.indexOf(b.dimension);
      assert.ok(da !== -1 && db !== -1, 'dimension missing from DIM_ORDER');
      assert.ok(
        da < db || (da === db && a.symbol < b.symbol),
        `bad sort order: ${a.symbol}|${a.dimension} before ${b.symbol}|${b.dimension}`
      );
    }
  });

  test('multi-meaning symbols each get their own entry', () => {
    const syms = PhysicsFormulas.allSymbols();
    const has = (sym, dim) => syms.some((s) => s.symbol === sym && s.dimension === dim);
    // T: time and temperature
    assert.ok(has('T', 'time'), 'T as time');
    assert.ok(has('T', 'temperature'), 'T as temperature');
    // V: voltage and volume
    assert.ok(has('V', 'voltage'), 'V as voltage');
    assert.ok(has('V', 'volume'), 'V as volume');
    // Q: charge and heat
    assert.ok(has('Q', 'charge'), 'Q as charge');
    assert.ok(has('Q', 'energy'), 'Q as heat (energy)');
    // m: mass and magnification
    assert.ok(has('m', 'mass'), 'm as mass');
    assert.ok(has('m', 'dimensionless'), 'm as magnification');
    // f: frequency, friction force and focal length
    assert.ok(has('f', 'frequency'), 'f as frequency');
    assert.ok(has('f', 'force'), 'f as friction force');
    assert.ok(has('f', 'length'), 'f as focal length');
    // I: current and intensity
    assert.ok(has('I', 'current'), 'I as current');
    assert.ok(has('I', 'intensity'), 'I as intensity');
    // W: weight (force) and work (energy)
    assert.ok(has('W', 'force'), 'W as weight');
    assert.ok(has('W', 'energy'), 'W as work');
    // P: power and pressure
    assert.ok(has('P', 'power'), 'P as power');
    assert.ok(has('P', 'pressure'), 'P as pressure');
    // n: index of refraction and moles
    assert.ok(has('n', 'dimensionless'), 'n as index of refraction');
    assert.ok(has('n', 'amount'), 'n as moles');
    // rho: resistivity and density
    assert.ok(has('rho', 'resistivity'), 'rho as resistivity');
    assert.ok(has('rho', 'density'), 'rho as density');
  });
});

// ---------------------------------------------------------------------
// module loading (UMD-lite)
// ---------------------------------------------------------------------
describe('module loading (UMD-lite)', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'formulas.js'), 'utf8');

  test('attaches PhysicsFormulas to window when loaded as a plain script', () => {
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    const api = sandbox.window.PhysicsFormulas;
    assert.ok(api, 'window.PhysicsFormulas was not set');
    assert.strictEqual(typeof api.list, 'function');
    assert.strictEqual(typeof api.byId, 'function');
    assert.strictEqual(typeof api.byCategory, 'function');
    assert.strictEqual(typeof api.allSymbols, 'function');
    assert.ok(Array.isArray(api.categories));
    assert.strictEqual(api.list().length, 56);
    assert.strictEqual(api.byId('kinematics-01').solveFor.v.fn({ v0: 10, a: 2, t: 3 }), 16);
  });

  test('falls back to globalThis when window is absent', () => {
    const sandbox = {};
    vm.runInNewContext(source, sandbox);
    assert.ok(sandbox.PhysicsFormulas, 'globalThis.PhysicsFormulas was not set');
    assert.strictEqual(sandbox.PhysicsFormulas.list().length, 56);
  });

  test('CommonJS export exposes the full public API', () => {
    assert.ok(Array.isArray(PhysicsFormulas.categories));
    assert.strictEqual(typeof PhysicsFormulas.list, 'function');
    assert.strictEqual(typeof PhysicsFormulas.byId, 'function');
    assert.strictEqual(typeof PhysicsFormulas.byCategory, 'function');
    assert.strictEqual(typeof PhysicsFormulas.allSymbols, 'function');
  });
});