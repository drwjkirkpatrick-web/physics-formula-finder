// ---------------------------------------------------------------------------
// Integration tests — real modules wired together (parent-owned).
// End-to-end problems through finder + solver, the dual-registered-unit fix,
// a cross-module unit/dimension consistency audit, a solve-every-formula
// round-trip sweep, and a browser-style UMD wiring check.
// ---------------------------------------------------------------------------
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const Units = require('../js/units.js');
const Formulas = require('../js/formulas.js');
const Finder = require('../js/finder.js');
const SolverFactory = require('../js/solver.js');
const Solver = SolverFactory.create(Units);

function approx(actual, expected, tol) {
  tol = tol === undefined ? 1e-6 : tol;
  const ok = Math.abs(actual - expected) <= tol * Math.max(Math.abs(actual), Math.abs(expected), 1e-12);
  assert.ok(ok, 'expected ~' + expected + ', got ' + actual);
}

// ---------------------------------------------------------------------------
// Finder + solver end-to-end
// ---------------------------------------------------------------------------

test('finder surfaces v = v₀ + a·t as an exact match for knowns {v0, a, t}', () => {
  const m = Finder.find(Formulas.list(), ['v0', 'a', 't']);
  const hit = m.exact.find((x) => x.formula.id === 'kinematics-01');
  assert.ok(hit, 'kinematics-01 should be an exact match');
  assert.strictEqual(hit.solvedFor, 'v');
  assert.strictEqual(Finder.describeMatch(hit), 'Solves for v: v = v₀ + a·t');
  assert.strictEqual(hit.missing.length, 0);
});

test('finder partial matches describe exactly what is missing', () => {
  const m = Finder.find(Formulas.list(), ['v0', 'a', 't'], { target: 'dx' });
  const hit = m.exact.find((x) => x.formula.id === 'kinematics-02');
  assert.ok(hit, 'kinematics-02 should be an exact match solving for Δx');
  assert.strictEqual(hit.solvedFor, 'dx');
});

test('end-to-end braking car: 72 km/h, -5 m/s², solve for t', () => {
  const res = Solver.solve(Formulas.byId('kinematics-01'), 't', {
    v0: { value: 72, unit: 'km/h' },
    v: { value: 0, unit: 'm/s' },
    a: { value: -5, unit: 'm/s^2' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, 4);
  assert.strictEqual(res.formatted, '4 s');
  assert.strictEqual(res.result.unit, 's');
  assert.strictEqual(res.result.dimension, 'time');
  assert.deepStrictEqual(res.steps.map((s) => s.label),
    ['Formula', 'Rearranged', 'Convert units', 'Substitute', 'Compute', 'Result']);
  assert.strictEqual(res.steps[2].text, 'v₀: 72 km/h → 20 m/s');
  assert.strictEqual(res.substituted, '? = (0 - 20) / (-5)');
});

test("end-to-end Ohm's law: 50 mA through 2.2 kΩ → 110 V", () => {
  const res = Solver.solve(Formulas.byId('electricity-01'), 'V', {
    I: { value: 50, unit: 'mA' },
    R: { value: 2.2, unit: 'kΩ' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, 110);
  assert.strictEqual(res.formatted, '110 V');
  assert.strictEqual(res.converted.I.to, '0.05 A');
  assert.strictEqual(res.converted.R.to, '2200 Ω');
  assert.strictEqual(res.steps[2].text, 'I: 50 mA → 0.05 A; R: 2.2 kΩ → 2200 Ω');
});

test('end-to-end free fall: v² = v₀² + 2·a·Δx from a 45 m roof', () => {
  const res = Solver.solve(Formulas.byId('kinematics-03'), 'v', {
    v0: { value: 0, unit: 'm/s' },
    a: { value: 9.81, unit: 'm/s^2' },
    dx: { value: 45, unit: 'm' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, Math.sqrt(2 * 9.81 * 45));
  assert.strictEqual(res.formatted, '29.71 m/s');
});

test('end-to-end hydrostatic pressure at 10 m depth', () => {
  const res = Solver.solve(Formulas.byId('fluids-02'), 'P', {
    rho: { value: 1000, unit: 'kg/m³' },
    g: { value: 9.81, unit: 'm/s^2' },
    h: { value: 10, unit: 'm' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, 98100);
  assert.strictEqual(res.formatted, '98100 Pa');
});

test("end-to-end Snell's law with the angle entered in degrees", () => {
  const res = Solver.solve(Formulas.byId('optics-05'), 'theta2', {
    n1: { value: 1, unit: '' },
    theta1: { value: 30, unit: '°' },
    n2: { value: 1.5, unit: '' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, Math.asin(Math.sin((30 * Math.PI) / 180) / 1.5));
  assert.strictEqual(res.result.unit, 'rad');
  assert.strictEqual(res.formatted, '0.3398 rad');
});

// ---------------------------------------------------------------------------
// Dual-registered units through the REAL units engine
// ---------------------------------------------------------------------------

test('temperature INTERVAL entered as plain °C converts by factor, not offset', () => {
  const res = Solver.solve(Formulas.byId('thermal-01'), 'Q', {
    m: { value: 0.5, unit: 'kg' },
    c: { value: 4184, unit: 'J/(kg·K)' },
    dT: { value: 25, unit: '°C' }
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.converted.dT.value, 25); // 25 K, NOT 298.15 K
  assert.strictEqual(res.converted.dT.to, '25 K');
  assert.strictEqual(res.steps[2].text, 'ΔT: 25 °C → 25 K');
  approx(res.result.value, 52300);
  assert.strictEqual(res.formatted, '52300 J');

  const back = Solver.solve(Formulas.byId('thermal-01'), 'dT', {
    Q: { value: 52300, unit: 'J' },
    m: { value: 0.5, unit: 'kg' },
    c: { value: 4184, unit: 'J/(kg·K)' }
  });
  assert.strictEqual(back.ok, true);
  assert.strictEqual(back.result.value, 25);
  assert.strictEqual(back.formatted, '25 K');
});

test('ABSOLUTE temperature entered as °C still converts with the offset', () => {
  const res = Solver.solve(Formulas.byId('thermal-04'), 'P', {
    V: { value: 0.01, unit: 'm³' },
    n: { value: 2, unit: 'mol' },
    T: { value: 25, unit: '°C' }
  });
  assert.strictEqual(res.ok, true);
  const expected = (2 * 8.314 * (25 + 273.15)) / 0.01;
  approx(res.converted.T.value, 298.15);
  approx(res.result.value, expected);
  assert.strictEqual(res.formatted, Units.formatValue(expected) + ' Pa');
});

test("standard-gravity 'g' unit (1 g) resolves via the acceleration dimension", () => {
  const res = Solver.solve(Formulas.byId('forces-02'), 'W', {
    m: { value: 2, unit: 'kg' },
    g: { value: 1, unit: 'g' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.converted.g.value, 9.80665);
  approx(res.result.value, 19.6133);
  assert.strictEqual(res.formatted, '19.61 N');
});

// ---------------------------------------------------------------------------
// Documented error behavior
// ---------------------------------------------------------------------------

test('energy-07 solving for m reports the documented non-finite result', () => {
  const res = Solver.solve(Formulas.byId('energy-07'), 'm', {
    v1: { value: 3, unit: 'm/s' }, h1: { value: 2, unit: 'm' },
    v2: { value: 4, unit: 'm/s' }, h2: { value: 1, unit: 'm' },
    g: { value: 9.81, unit: 'm/s^2' }
  });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'non-finite');
});

test('dimension mismatch and missing values produce student-friendly errors', () => {
  const bad = Solver.solve(Formulas.byId('kinematics-01'), 'v', {
    v0: { value: 10, unit: 'kg' }, a: { value: 2, unit: 'm/s^2' }, t: { value: 3, unit: 's' }
  });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.error, 'dimension-mismatch');
  assert.ok(bad.message.indexOf('kg') !== -1 && bad.message.indexOf('velocity') !== -1);

  const missing = Solver.solve(Formulas.byId('kinematics-01'), 'v', {
    v0: { value: 10, unit: 'm/s' }, a: { value: 2, unit: 'm/s^2' }
  });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.error, 'missing');
  assert.ok(missing.message.indexOf('t (') !== -1, 'missing message names the variable: ' + missing.message);
});

// ---------------------------------------------------------------------------
// Cross-module consistency audit
// ---------------------------------------------------------------------------

test('every formula unit is registered under its declared dimension', () => {
  const problems = [];
  Formulas.list().forEach((f) => {
    f.variables.forEach((v) => {
      let list = null;
      try { list = Units.listUnits(v.dimension); } catch (e) { list = null; }
      const symbols = list ? list.map((u) => u.symbol) : [];
      if (symbols.indexOf(v.siUnit) === -1) {
        problems.push(f.id + ' ' + v.symbol + ' siUnit ' + v.siUnit +
          ' not in dimension ' + v.dimension);
      }
      v.commonUnits.forEach((cu) => {
        if (symbols.indexOf(cu) === -1) {
          problems.push(f.id + ' ' + v.symbol + ' commonUnit ' + cu +
            ' not in dimension ' + v.dimension);
        }
      });
    });
  });
  assert.deepStrictEqual(problems, []);
});

test('allSymbols() entries are consistent with the units engine too', () => {
  Formulas.allSymbols().forEach((s) => {
    const list = Units.listUnits(s.dimension);
    const symbols = list.map((u) => u.symbol);
    assert.ok(symbols.indexOf(s.siUnit) !== -1,
      s.symbol + ' siUnit ' + s.siUnit + ' missing from ' + s.dimension);
    s.commonUnits.forEach((cu) => {
      assert.ok(symbols.indexOf(cu) !== -1,
        s.symbol + ' commonUnit ' + cu + ' missing from ' + s.dimension);
    });
  });
});

test('every formula is findable from its own variable set minus one', () => {
  Formulas.list().forEach((f) => {
    f.variables.forEach((targetVar) => {
      const knowns = f.variables
        .map((v) => v.symbol)
        .filter((sym) => sym !== targetVar.symbol);
      const m = Finder.find(Formulas.list(), knowns);
      const hit = m.exact.find((x) => x.formula.id === f.id);
      assert.ok(hit, f.id + ' should be findable when solving for ' + targetVar.symbol);
      assert.strictEqual(hit.solvedFor, targetVar.symbol);
    });
  });
});

// ---------------------------------------------------------------------------
// Solve-every-formula round-trip sweep through the real solver
// ---------------------------------------------------------------------------

const SAMPLES = {
  length: 3, time: 2, mass: 5, velocity: 10, acceleration: 2, force: 50,
  energy: 100, power: 200, momentum: 15, pressure: 1000, temperature: 300,
  'temperature-interval': 20, charge: 0.01, current: 0.5, voltage: 100,
  resistance: 1000, capacitance: 0.001, frequency: 50, angle: 0.5, area: 0.02,
  volume: 0.005, density: 1000, amount: 2, dimensionless: 0.5,
  'spring-constant': 200, 'linear-density': 0.01, intensity: 5,
  resistivity: 1.7e-8, 'specific-heat': 4184, 'latent-heat': 334000,
  'thermal-expansivity': 2.4e-5
};
// Per-formula sample overrides where dimension-default samples are degenerate:
// beats with equal frequencies, energy conservation with equal states (g -> 0/0),
// thin lens with equal object/image distances (do/di -> 1/0).
const FORMULA_SAMPLES = {
  'waves-03': { f1: 60, f2: 50 },
  'energy-07': { v1: 10, v2: 4, h1: 2, h2: 1 },
  'optics-01': { f: 2, do: 3, di: 6 }
};
// Variables whose solveFor is a documented non-finite (mass cancels in
// energy-07): never used as the inversion verifier.
const SKIP_VERIFY = { 'energy-07': ['m'] };

function sampleFor(formula, variable) {
  const o = FORMULA_SAMPLES[formula.id];
  if (o && Object.prototype.hasOwnProperty.call(o, variable.symbol)) {
    return o[variable.symbol];
  }
  return SAMPLES[variable.dimension];
}

test('round-trip sweep: all 56 formulas × every target solve and invert', () => {
  const failures = [];
  let solved = 0;
  Formulas.list().forEach((f) => {
    f.variables.forEach((targetVar) => {
      if (f.id === 'energy-07' && targetVar.symbol === 'm') return; // documented: m cancels
      const knowns = {};
      f.variables.forEach((v) => {
        if (v.symbol === targetVar.symbol) return;
        knowns[v.symbol] = { value: sampleFor(f, v), unit: v.siUnit };
      });
      const res = Solver.solve(f, targetVar.symbol, knowns);
      if (!res.ok) {
        failures.push(f.id + ' solve ' + targetVar.symbol + ' -> ' + res.error);
        return;
      }
      solved += 1;

      // Invert through a different variable: substituting the result back
      // must recover that variable's sample value. Skip documented-NaN
      // verifiers (energy-07 mass).
      const skip = SKIP_VERIFY[f.id] || [];
      const other = f.variables.find(
        (v) => v.symbol !== targetVar.symbol && skip.indexOf(v.symbol) === -1);
      if (!other) return;
      const knowns2 = {};
      f.variables.forEach((v) => {
        if (v.symbol === other.symbol) return;
        knowns2[v.symbol] = (v.symbol === targetVar.symbol)
          ? { value: res.result.value, unit: v.siUnit }
          : { value: sampleFor(f, v), unit: v.siUnit };
      });
      const back = Solver.solve(f, other.symbol, knowns2);
      if (!back.ok) {
        failures.push(f.id + ' invert via ' + other.symbol + ' -> ' + back.error);
        return;
      }
      const want = sampleFor(f, other);
      if (!(Math.abs(back.result.value - want) <= 1e-6 * Math.max(Math.abs(back.result.value), Math.abs(want), 1e-12))) {
        failures.push(f.id + ' invert ' + other.symbol + ': got ' +
          back.result.value + ', wanted ' + want);
      }
    });
  });
  assert.strictEqual(failures.length, 0, 'sweep failures: ' + failures.join(' | '));
  assert.ok(solved >= 180, 'expected ~182 direct solves, got ' + solved);
});

// ---------------------------------------------------------------------------
// Browser-style wiring: all four modules as plain <script> globals
// ---------------------------------------------------------------------------

test('UMD globals wire together in a browser-like context', () => {
  const sandbox = { console: console };
  vm.createContext(sandbox);
  ['units.js', 'formulas.js', 'solver.js', 'finder.js'].forEach((file) => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    vm.runInContext(src, sandbox, { filename: file });
  });
  assert.ok(sandbox.PhysicsUnits, 'window.PhysicsUnits');
  assert.ok(sandbox.PhysicsFormulas, 'window.PhysicsFormulas');
  assert.ok(sandbox.PhysicsSolverFactory, 'window.PhysicsSolverFactory');
  assert.ok(sandbox.PhysicsFinder, 'window.PhysicsFinder');

  const browserSolver = sandbox.PhysicsSolverFactory.create(sandbox.PhysicsUnits);
  const res = browserSolver.solve(sandbox.PhysicsFormulas.byId('electricity-01'), 'V', {
    I: { value: 50, unit: 'mA' },
    R: { value: 2.2, unit: 'kΩ' }
  });
  assert.strictEqual(res.ok, true);
  approx(res.result.value, 110);

  const m = sandbox.PhysicsFinder.find(sandbox.PhysicsFormulas.list(), ['v0', 'a', 't']);
  assert.ok(m.exact.some((x) => x.formula.id === 'kinematics-01'));
});