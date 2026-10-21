/**
 * physics-formula-finder — tests/units.test.js (Builder A)
 * Tests for the detailed units & conversion engine (js/units.js).
 * Runs standalone (no sibling builder files needed):
 *   node --test tests/units.test.js
 */
const { test } = require('node:test');
const assert = require('node:assert');
const U = require('../js/units.js');

/* ------------------------------------------------------- helpers -- */

function approx(a, b, eps) {
  if (eps === undefined) { eps = 1e-9; }
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b));
  return diff <= Math.max(eps, eps * scale);
}

function assertApprox(a, b, eps, msg) {
  assert.ok(
    approx(a, b, eps),
    (msg ? msg + ': ' : '') + 'expected ' + a + ' ≈ ' + b +
      ' (eps ' + (eps === undefined ? 1e-9 : eps) + ')'
  );
}

/** Run fn, require a UnitError, optionally containing messageIncludes. */
function expectUnitError(fn, messageIncludes) {
  let threw = null;
  try { fn(); } catch (err) { threw = err; }
  assert.ok(threw !== null, 'expected the call to throw');
  assert.ok(threw instanceof Error, 'thrown value should be an Error');
  assert.strictEqual(threw.name, 'UnitError', 'error .name should be UnitError');
  if (messageIncludes !== undefined) {
    assert.ok(
      String(threw.message).indexOf(messageIncludes) !== -1,
      'message ' + JSON.stringify(String(threw.message)) + ' should contain ' +
        JSON.stringify(messageIncludes)
    );
  }
  return threw;
}

/* The exact unit lists from §UNITS of SPEC.md (SI first). */
const EXPECTED_ORDER = {
  length: ['m', 'km', 'cm', 'mm', 'μm', 'mi', 'yd', 'ft', 'in'],
  time: ['s', 'ms', 'μs', 'min', 'hr', 'day'],
  mass: ['kg', 'g', 'mg', 't', 'lb'],
  velocity: ['m/s', 'km/h', 'mph', 'ft/s', 'cm/s'],
  acceleration: ['m/s^2', 'ft/s^2', 'g'],
  force: ['N', 'kN', 'mN', 'dyn', 'lbf'],
  energy: ['J', 'kJ', 'cal', 'kcal', 'eV', 'kWh'],
  power: ['W', 'kW', 'MW', 'hp'],
  momentum: ['kg*m/s'],
  pressure: ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi', 'mmHg', 'torr'],
  temperature: ['K', '°C', '°F'],
  'temperature-interval': ['K', '°C', '°F'],
  charge: ['C', 'mC', 'μC', 'nC'],
  current: ['A', 'mA', 'μA'],
  voltage: ['V', 'mV', 'kV'],
  resistance: ['Ω', 'mΩ', 'kΩ', 'MΩ'],
  capacitance: ['F', 'mF', 'μF', 'nF', 'pF'],
  frequency: ['Hz', 'kHz', 'MHz', 'GHz'],
  angle: ['rad', '°'],
  area: ['m²', 'cm²', 'ft²', 'in²'],
  volume: ['m³', 'L', 'mL', 'cm³', 'gal'],
  density: ['kg/m³', 'g/cm³'],
  amount: ['mol', 'kmol', 'mmol'],
  dimensionless: [''],
  'spring-constant': ['N/m'],
  'linear-density': ['kg/m'],
  intensity: ['W/m²'],
  resistivity: ['Ω*m'],
  'specific-heat': ['J/(kg·K)'],
  'latent-heat': ['J/kg', 'kcal/kg'],
  'thermal-expansivity': ['1/K']
};

/* --------------------------------------------------------- tests -- */

test('exports exactly the nine SPEC API functions', () => {
  assert.deepStrictEqual(Object.keys(U).sort(), [
    'allUnitSymbols', 'convert', 'dimensionOf', 'formatValue', 'fromSI',
    'isTemperature', 'listUnits', 'normalize', 'toSI'
  ]);
  Object.keys(U).forEach(k => {
    assert.strictEqual(typeof U[k], 'function', k + ' should be a function');
  });
});

test('listUnits returns exactly the SPEC units per dimension, SI first', () => {
  assert.strictEqual(Object.keys(EXPECTED_ORDER).length, 31,
    'the SPEC defines 31 dimensions');
  Object.keys(EXPECTED_ORDER).forEach(dim => {
    const units = U.listUnits(dim);
    assert.ok(Array.isArray(units), dim);
    assert.deepStrictEqual(units.map(r => r.symbol), EXPECTED_ORDER[dim], dim);
    units.forEach(r => {
      assert.strictEqual(typeof r.symbol, 'string', dim);
      assert.strictEqual(typeof r.name, 'string', dim);
      assert.ok(r.name.length > 0, dim + ' ' + JSON.stringify(r.symbol));
      assert.strictEqual(typeof r.mul, 'number', dim);
      assert.strictEqual(typeof r.add, 'number', dim);
    });
  });
  // SI unit first everywhere
  assert.strictEqual(U.listUnits('length')[0].symbol, 'm');
  assert.strictEqual(U.listUnits('temperature')[0].symbol, 'K');
  assert.strictEqual(U.listUnits('angle')[0].symbol, 'rad');
  // unknown dimensions throw
  expectUnitError(() => U.listUnits('energy2'), "Unknown dimension: 'energy2'");
  expectUnitError(() => U.listUnits(''));
  expectUnitError(() => U.listUnits(undefined));
  expectUnitError(() => U.listUnits('constructor'));
});

test('every unit round-trips fromSI(toSI(x, u)) within relative 1e-12', () => {
  Object.keys(EXPECTED_ORDER).forEach(dim => {
    EXPECTED_ORDER[dim].forEach(sym => {
      [7.5, -3.25].forEach(x => {
        const si = U.toSI(x, sym);
        const back = U.fromSI(si, sym);
        assert.ok(approx(back, x, 1e-12),
          dim + ' ' + JSON.stringify(sym) + ': ' + back + ' vs ' + x);
        const self = U.convert(x, sym, sym);
        assert.ok(approx(self, x, 1e-12),
          dim + ' ' + JSON.stringify(sym) + ' self-convert: ' + self);
      });
    });
  });
});

test('registry factors match the SPEC table exactly', () => {
  const f = (dim, sym) => U.listUnits(dim).filter(r => r.symbol === sym)[0];
  assert.strictEqual(f('length', 'mi').mul, 1609.344);
  assert.strictEqual(f('length', 'ft').mul, 0.3048);
  assert.strictEqual(f('length', 'μm').mul, 1e-6);
  assert.strictEqual(f('mass', 'lb').mul, 0.45359237);
  assert.strictEqual(f('acceleration', 'g').mul, 9.80665); // standard gravity
  assert.strictEqual(f('force', 'lbf').mul, 4.4482216152605);
  assert.strictEqual(f('energy', 'cal').mul, 4.184);
  assert.strictEqual(f('energy', 'kWh').mul, 3.6e6);
  assert.strictEqual(f('power', 'hp').mul, 745.699872);
  assert.strictEqual(f('pressure', 'psi').mul, 6894.757293168);
  assert.strictEqual(f('pressure', 'mmHg').mul, 133.32239);
  assert.strictEqual(f('pressure', 'torr').mul, 101325 / 760);
  assert.strictEqual(f('angle', '°').mul, Math.PI / 180);
  assert.strictEqual(f('area', 'ft²').mul, 0.09290304);
  assert.strictEqual(f('volume', 'gal').mul, 0.003785411784);
  assert.strictEqual(f('latent-heat', 'kcal/kg').mul, 4184);
  assert.strictEqual(f('temperature', '°F').mul, 5 / 9);
  // every record outside 'temperature' has add === 0
  Object.keys(EXPECTED_ORDER).forEach(dim => {
    U.listUnits(dim).forEach(r => {
      if (dim !== 'temperature') {
        assert.strictEqual(r.add, 0, dim + ' ' + JSON.stringify(r.symbol));
      }
    });
  });
  // single-factor lookups are exact
  assert.strictEqual(U.toSI(1, 'ft'), 0.3048);
  assert.strictEqual(U.toSI(1, 'mi'), 1609.344);
  assert.strictEqual(U.toSI(1, 'atm'), 101325);
  assert.strictEqual(U.toSI(1, 'eV'), 1.602176634e-19);
  assert.strictEqual(U.toSI(1, 'g'), 0.001);
  assert.strictEqual(U.fromSI(1, 'km'), 0.001);
  assertApprox(U.toSI(30, '°'), Math.PI / 6);
  // dimensionless '' is a real unit
  assert.strictEqual(U.toSI(3.14, ''), 3.14);
  assert.strictEqual(U.fromSI(2, ''), 2);
});

test('temperature units convert with offsets (SPEC checks)', () => {
  assertApprox(U.toSI(0, '°C'), 273.15);
  assertApprox(U.toSI(100, '°C'), 373.15);
  assertApprox(U.toSI(32, '°F'), 273.15);
  assertApprox(U.toSI(212, '°F'), 373.15);
  assertApprox(U.toSI(-40, '°F'), 233.15);
  assertApprox(U.toSI(-40, '°C'), 233.15); // the famous coincidence point
  assertApprox(U.fromSI(373.15, '°C'), 100);
  assertApprox(U.fromSI(273.15, '°C'), 0);
  assertApprox(U.fromSI(233.15, '°F'), -40);
  assertApprox(U.fromSI(373.15, '°F'), 212);
  assertApprox(U.convert(100, '°C', '°F'), 212);
  assertApprox(U.convert(0, '°C', 'K'), 273.15);
  // records carry the SPEC offsets
  const temp = U.listUnits('temperature');
  assert.strictEqual(temp[1].add, 273.15); // °C
  assert.strictEqual(temp[1].mul, 1);
  assert.strictEqual(temp[2].mul, 5 / 9);
  assert.strictEqual(temp[2].add, 459.67); // °F
  assert.strictEqual(U.dimensionOf('°C'), 'temperature');
  assert.strictEqual(U.dimensionOf('K'), 'temperature');
});

test('temperature-INTERVAL units are factor-only (100 Δ°C = 100 K = 180 Δ°F)', () => {
  const iv = U.listUnits('temperature-interval');
  assert.deepStrictEqual(iv.map(r => r.symbol), ['K', '°C', '°F']);
  const kRec = iv[0], cRec = iv[1], fRec = iv[2];
  assert.strictEqual(kRec.mul, 1);
  assert.strictEqual(kRec.add, 0);
  assert.strictEqual(cRec.mul, 1);
  assert.strictEqual(cRec.add, 0);
  assert.strictEqual(fRec.mul, 5 / 9);
  assert.strictEqual(fRec.add, 0);
  // documented record math: si = (v + add) * mul
  const cToSI = (100 + cRec.add) * cRec.mul;   // 100 interval-°C → SI
  assertApprox(cToSI, 100);
  const fFromSI = 100 / fRec.mul - fRec.add;   // 100 K → interval-°F
  assertApprox(fFromSI, 180);
  const fToSI = (180 + fRec.add) * fRec.mul;    // 180 Δ°F × 5/9 = 100 K
  assertApprox(fToSI, 100);
  // so 100 interval-°C and 180 interval-°F are the same SI interval
  assertApprox(cToSI, fToSI);
  // unlike the temperature dimension, intervals carry NO offsets
  const tempC = U.listUnits('temperature')[1];
  assert.strictEqual(tempC.add, 273.15);
  assert.strictEqual(tempC.mul, 1);
});

test('velocity conversions: 72 km/h → 20 m/s', () => {
  assertApprox(U.toSI(72, 'km/h'), 20);
  assertApprox(U.convert(72, 'km/h', 'm/s'), 20);
  assertApprox(U.convert(20, 'm/s', 'km/h'), 72);
  assertApprox(U.toSI(60, 'mph'), 26.8224);
  assert.strictEqual(U.toSI(1, 'ft/s'), 0.3048);
  assert.strictEqual(U.toSI(1, 'cm/s'), 0.01);
  assert.strictEqual(U.toSI(1, 'mph'), 0.44704);
  assert.strictEqual(U.toSI(1, 'km/h'), 1000 / 3600);
});

test('normalize resolves every required SPEC alias', () => {
  const required = {
    kph: 'km/h', kmh: 'km/h',
    'm/s2': 'm/s^2', ms2: 'm/s^2',
    ohm: 'Ω', kohm: 'kΩ', Mohm: 'MΩ',
    uF: 'μF', uC: 'μC', uA: 'μA', um: 'μm', us: 'μs',
    degC: '°C', celsius: '°C',
    degF: '°F', fahrenheit: '°F',
    deg: '°', degrees: '°',
    sec: 's', secs: 's',
    meter: 'm', meters: 'm',
    foot: 'ft', feet: 'ft',
    inch: 'in', inches: 'in',
    mile: 'mi', miles: 'mi',
    gram: 'g', grams: 'g',
    pound: 'lb', pounds: 'lb',
    hour: 'hr', hours: 'hr',
    radian: 'rad', radians: 'rad',
    mole: 'mol'
  };
  Object.keys(required).forEach(alias => {
    assert.strictEqual(U.normalize(alias), required[alias], 'alias ' + alias);
  });
  // canonical symbols are returned unchanged (idempotent)
  ['m', 'm/s^2', '°C', '°', 'Ω', 'μF', 'J/(kg·K)', 'Ω*m', 'g/cm³', '',
    '1/K', 'm³'].forEach(sym => {
    assert.strictEqual(U.normalize(sym), sym, 'canonical ' + JSON.stringify(sym));
  });
  // friendly extras resolve too
  assert.strictEqual(U.normalize('µF'), 'μF');   // MICRO SIGN spelling
  assert.strictEqual(U.normalize('m2'), 'm²');
  assert.strictEqual(U.normalize('kg/m3'), 'kg/m³');
  assert.strictEqual(U.normalize('dimensionless'), '');
});

test('normalize falls back case-insensitively; unknown/ambiguous throw', () => {
  assert.strictEqual(U.normalize('KPH'), 'km/h');
  assert.strictEqual(U.normalize('CELSIUS'), '°C');
  assert.strictEqual(U.normalize('DEGC'), '°C');
  assert.strictEqual(U.normalize('M'), 'm');
  assert.strictEqual(U.normalize('HR'), 'hr');
  assert.strictEqual(U.normalize('EV'), 'eV');
  assert.strictEqual(U.normalize('PA'), 'Pa');
  assert.strictEqual(U.normalize('°c'), '°C');
  assert.strictEqual(U.normalize('°f'), '°F');
  expectUnitError(() => U.normalize('wibble'), "Unknown unit: 'wibble'");
  expectUnitError(() => U.normalize(42));
  expectUnitError(() => U.normalize(undefined));
  expectUnitError(() => U.normalize(null));
  // mΩ vs MΩ differ only by case: a lowercased 'mω' is ambiguous
  expectUnitError(() => U.normalize('mω'), 'Ambiguous');
});

test('aliases work end-to-end (toSI, convert, dimensionOf)', () => {
  assertApprox(U.toSI(72, 'kph'), 20);
  assert.strictEqual(U.toSI(5, 'sec'), 5);
  assert.strictEqual(U.toSI(1, 'foot'), 0.3048);
  assertApprox(U.convert(72, 'kph', 'm/s'), 20);
  assert.strictEqual(U.dimensionOf('celsius'), 'temperature');
  assert.strictEqual(U.dimensionOf('ohm'), 'resistance');
  assert.strictEqual(U.dimensionOf('m/s2'), 'acceleration');
  assertApprox(U.toSI(2.2, 'pounds'), 0.997903214);
  assertApprox(U.toSI(1, 'm2'), 1);
});

test('dimensionOf maps symbols and aliases to dimensions; unknown -> null', () => {
  assert.strictEqual(U.dimensionOf('m'), 'length');
  assert.strictEqual(U.dimensionOf('kg'), 'mass');
  assert.strictEqual(U.dimensionOf('kg*m/s'), 'momentum');
  assert.strictEqual(U.dimensionOf('N/m'), 'spring-constant');
  assert.strictEqual(U.dimensionOf('kg/m'), 'linear-density');
  assert.strictEqual(U.dimensionOf('W/m²'), 'intensity');
  assert.strictEqual(U.dimensionOf('Ω*m'), 'resistivity');
  assert.strictEqual(U.dimensionOf('J/(kg·K)'), 'specific-heat');
  assert.strictEqual(U.dimensionOf('J/kg'), 'latent-heat');
  assert.strictEqual(U.dimensionOf('1/K'), 'thermal-expansivity');
  assert.strictEqual(U.dimensionOf(''), 'dimensionless');
  // dual-registered symbols resolve to the first-registered dimension
  assert.strictEqual(U.dimensionOf('g'), 'mass');
  assert.strictEqual(U.dimensionOf('°C'), 'temperature');
  assert.strictEqual(U.dimensionOf('K'), 'temperature');
  // unknowns return null without throwing
  assert.strictEqual(U.dimensionOf('bogus'), null);
  assert.strictEqual(U.dimensionOf('wibble'), null);
  assert.strictEqual(U.dimensionOf(undefined), null);
  assert.strictEqual(U.dimensionOf(123), null);
});

test('convert stays inside a dimension; mismatch throws the exact SPEC message', () => {
  assertApprox(U.convert(1, 'm', 'ft'), 3.2808398950131);
  assertApprox(U.convert(2.5, 'm', 'cm'), 250);
  assertApprox(U.convert(1, 'gal', 'L'), 3.785411784);
  assertApprox(U.convert(1, 'hr', 'min'), 60);
  assertApprox(U.convert(1, 'eV', 'J'), 1.602176634e-19);
  assert.strictEqual(U.convert(5, 'm', 'm'), 5);
  assert.strictEqual(U.convert(5, '', ''), 5);
  assertApprox(U.convert(0, '°C', 'K'), 273.15);

  const err = expectUnitError(() => U.convert(5, 'm', 's'));
  assert.strictEqual(err.message, 'Cannot convert m (length) to s (time)');
  // the message shows the symbols as passed (aliases included)
  const err2 = expectUnitError(() => U.convert(1, 'meter', 's'));
  assert.strictEqual(err2.message, 'Cannot convert meter (length) to s (time)');
  expectUnitError(() => U.convert(1, 'kg', 'm/s'),
    'Cannot convert kg (mass) to m/s (velocity)');
  // unknown units throw before any conversion happens
  expectUnitError(() => U.convert(1, 'm', 'wibble'), "Unknown unit: 'wibble'");
  expectUnitError(() => U.convert(1, 'wibble', 'm'), "Unknown unit: 'wibble'");
});

test('toSI and fromSI throw UnitError for unknown units and bad values', () => {
  expectUnitError(() => U.toSI(1, 'wibble'), "Unknown unit: 'wibble'");
  expectUnitError(() => U.fromSI(1, 'wibble'), "Unknown unit: 'wibble'");
  expectUnitError(() => U.toSI(1, undefined), 'Unknown unit');
  expectUnitError(() => U.toSI(1, null), 'Unknown unit');
  expectUnitError(() => U.toSI(NaN, 'm'), 'Invalid value');
  expectUnitError(() => U.toSI(Infinity, 'm'), 'Invalid value');
  expectUnitError(() => U.toSI('abc', 'm'), 'Invalid value');
  expectUnitError(() => U.fromSI(NaN, 'kg'), 'Invalid value');
});

test('formatValue follows the SPEC formatting rules', () => {
  // zero
  assert.strictEqual(U.formatValue(0), '0');
  assert.strictEqual(U.formatValue(-0), '0');
  // integers in range render bare
  assert.strictEqual(U.formatValue(26), '26');
  assert.strictEqual(U.formatValue(5), '5');
  assert.strictEqual(U.formatValue(20), '20');
  assert.strictEqual(U.formatValue(1500), '1500');
  assert.strictEqual(U.formatValue(9999), '9999');
  assert.strictEqual(U.formatValue(-26), '-26');
  // rounding + trailing-zero stripping
  assert.strictEqual(U.formatValue(9.81), '9.81');
  assert.strictEqual(U.formatValue(9.810), '9.81');
  assert.strictEqual(U.formatValue(19.62), '19.62');
  assert.strictEqual(U.formatValue(-9.81), '-9.81');
  assert.strictEqual(U.formatValue(0.001), '0.001');
  assert.strictEqual(U.formatValue(0.5235988), '0.5236');
  // scientific notation: |v| >= 1e5 or (|v| < 1e-3 and v !== 0)
  assert.strictEqual(U.formatValue(2.998e8), '2.998 × 10^8');
  assert.strictEqual(U.formatValue(1.602176634e-19), '1.602 × 10^-19');
  assert.strictEqual(U.formatValue(-2.998e8), '-2.998 × 10^8');
  assert.strictEqual(U.formatValue(1e5), '1 × 10^5');
  assert.strictEqual(U.formatValue(123456), '1.235 × 10^5');
  assert.strictEqual(U.formatValue(6.022e23), '6.022 × 10^23');
  assert.strictEqual(U.formatValue(0.0005), '5 × 10^-4');
  assert.strictEqual(U.formatValue(-0.00025), '-2.5 × 10^-4');
  // sigFigs parameter
  assert.strictEqual(U.formatValue(3.14159, 3), '3.14');
  assert.strictEqual(U.formatValue(3.14159, 5), '3.1416');
  assert.strictEqual(U.formatValue(1234.5, 6), '1234.5');
  assert.strictEqual(U.formatValue(2.998e8, 3), '3 × 10^8');
  assert.strictEqual(U.formatValue(2.998e8, 6), '2.998 × 10^8');
  assert.strictEqual(U.formatValue(0.123456, 2), '0.12');
  assert.strictEqual(U.formatValue(26, 2), '26');
  // error paths
  expectUnitError(() => U.formatValue(NaN), 'Invalid value');
  expectUnitError(() => U.formatValue(Infinity), 'Invalid value');
  expectUnitError(() => U.formatValue('x'), 'Invalid value');
  expectUnitError(() => U.formatValue(5, 0), 'Invalid sigFigs');
  expectUnitError(() => U.formatValue(5, 2.5), 'Invalid sigFigs');
});

test('isTemperature is true only for the temperature dimension', () => {
  assert.strictEqual(U.isTemperature('temperature'), true);
  assert.strictEqual(U.isTemperature('temperature-interval'), false);
  assert.strictEqual(U.isTemperature('length'), false);
  assert.strictEqual(U.isTemperature(''), false);
  assert.strictEqual(U.isTemperature('bogus'), false);
  assert.strictEqual(U.isTemperature(undefined), false);
  assert.strictEqual(U.isTemperature(42), false);
});

test('allUnitSymbols maps canonical symbols to dimensions (aliases excluded)', () => {
  const all = U.allUnitSymbols();
  const expectedUnique = [];
  Object.keys(EXPECTED_ORDER).forEach(dim => {
    EXPECTED_ORDER[dim].forEach(sym => {
      if (expectedUnique.indexOf(sym) === -1) { expectedUnique.push(sym); }
    });
  });
  assert.deepStrictEqual(Object.keys(all).sort(), expectedUnique.slice().sort());
  // 106 registrations minus the four dual-registered symbols (g, K, °C, °F)
  assert.strictEqual(Object.keys(all).length, 102);
  assert.strictEqual(all['m'], 'length');
  assert.strictEqual(all[''], 'dimensionless');
  assert.strictEqual(all['g'], 'mass');                 // dual 'g': mass first
  assert.strictEqual(all['°C'], 'temperature');        // duals: temperature first
  assert.strictEqual(all['K'], 'temperature');
  assert.strictEqual(all['Ω*m'], 'resistivity');
  assert.strictEqual(all['J/(kg·K)'], 'specific-heat');
  assert.strictEqual(all['g/cm³'], 'density');
  assert.strictEqual(all['m/s^2'], 'acceleration');
  // aliases are not canonical keys
  assert.strictEqual(all['kph'], undefined);
  assert.strictEqual(all['meter'], undefined);
  // every value is a known dimension key
  Object.keys(all).forEach(sym => {
    assert.ok(Object.hasOwn(EXPECTED_ORDER, all[sym]), sym + ' -> ' + all[sym]);
  });
});

test('UMD-lite: sets window.PhysicsUnits when module is absent (browser path)', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'units.js'), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'units.js' });
  const G = sandbox.window.PhysicsUnits;
  assert.ok(G, 'window.PhysicsUnits should be set');
  assert.strictEqual(typeof G.toSI, 'function');
  assertApprox(G.toSI(72, 'km/h'), 20);
  assert.strictEqual(G.formatValue(2.998e8), '2.998 × 10^8');
  // errors thrown in the vm realm still carry the UnitError contract
  // (cross-realm instanceof is not reliable, so check the observable fields)
  let threw = null;
  try { G.toSI(1, 'wibble'); } catch (e) { threw = e; }
  assert.ok(threw !== null, 'browser-global toSI should throw for unknown unit');
  assert.strictEqual(threw.name, 'UnitError');
  assert.ok(String(threw.message).indexOf("Unknown unit: 'wibble'") !== -1,
    'message should name the unknown unit');
  // the Node branch must not attach a global
  assert.strictEqual(typeof globalThis.PhysicsUnits, 'undefined');
});