/*
 * physics-formula-finder — js/formulas.js
 * Builder B: the curated physics formula database (56 formulas).
 *
 * UMD-lite module (no imports, no dependencies); browser global:
 * PhysicsFormulas. Ids, equations, dimensions, constants and text
 * conventions follow §FORMULAS of SPEC.md exactly. File is UTF-8.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsFormulas = api; }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // ------------------------------------------------------------------
  // Physical constants (embedded in solveFor fns; values per SPEC.md)
  // ------------------------------------------------------------------
  const GRAV = 6.674e-11;      // G, gravitational constant (N·m²/kg²)
  const C_LIGHT = 2.998e8;     // c, speed of light in vacuum (m/s)
  const H_PLANCK = 6.626e-34;  // h, Planck's constant (J·s)
  const K_E = 8.988e9;         // k_e, Coulomb's constant (N·m²/C²)
  const R_GAS = 8.314;         // R, universal gas constant (J/(mol·K))

  // ------------------------------------------------------------------
  // Per-dimension SI unit and common units (§UNITS table, SPEC.md).
  // siUnit is the SI unit string; commonUnits are the non-SI units
  // registered for that dimension.
  // ------------------------------------------------------------------
  const DIMENSIONS = {
    'length':               { si: 'm',         common: ['km', 'cm', 'mm', 'ft', 'in', 'mi'] },
    'time':                 { si: 's',         common: ['min', 'hr', 'ms'] },
    'mass':                 { si: 'kg',        common: ['g', 'mg', 'lb'] },
    'velocity':             { si: 'm/s',       common: ['km/h', 'mph', 'ft/s', 'cm/s'] },
    'acceleration':         { si: 'm/s^2',     common: ['ft/s^2', 'g'] },
    'force':                { si: 'N',         common: ['kN', 'mN', 'dyn', 'lbf'] },
    'energy':               { si: 'J',         common: ['kJ', 'cal', 'kcal', 'eV', 'kWh'] },
    'power':                { si: 'W',         common: ['kW', 'MW', 'hp'] },
    'momentum':             { si: 'kg*m/s',    common: [] },
    'pressure':             { si: 'Pa',        common: ['kPa', 'MPa', 'bar', 'atm', 'psi', 'mmHg', 'torr'] },
    'temperature':          { si: 'K',         common: ['°C', '°F'] },
    'temperature-interval': { si: 'K',         common: ['°C', '°F'] },
    'charge':               { si: 'C',         common: ['mC', 'μC', 'nC'] },
    'current':              { si: 'A',         common: ['mA', 'μA'] },
    'voltage':              { si: 'V',         common: ['mV', 'kV'] },
    'resistance':           { si: 'Ω',         common: ['mΩ', 'kΩ', 'MΩ'] },
    'capacitance':          { si: 'F',         common: ['mF', 'μF', 'nF', 'pF'] },
    'frequency':            { si: 'Hz',        common: ['kHz', 'MHz', 'GHz'] },
    'angle':                { si: 'rad',       common: ['°'] },
    'area':                 { si: 'm²',        common: ['cm²', 'ft²', 'in²'] },
    'volume':               { si: 'm³',        common: ['L', 'mL', 'cm³', 'gal'] },
    'density':              { si: 'kg/m³',     common: ['g/cm³'] },
    'amount':               { si: 'mol',       common: ['kmol', 'mmol'] },
    'dimensionless':        { si: '',          common: [] },
    'spring-constant':      { si: 'N/m',       common: [] },
    'linear-density':       { si: 'kg/m',      common: [] },
    'intensity':            { si: 'W/m²',      common: [] },
    'resistivity':          { si: 'Ω*m',       common: [] },
    'specific-heat':        { si: 'J/(kg·K)',  common: [] },
    'latent-heat':          { si: 'J/kg',      common: ['kcal/kg'] },
    'thermal-expansivity':  { si: '1/K',       common: [] }
  };

  // Canonical dimension order (§Dimensions, SPEC.md) — used by allSymbols().
  const DIMENSION_ORDER = [
    'length', 'time', 'mass', 'velocity', 'acceleration', 'force', 'energy',
    'power', 'momentum', 'pressure', 'temperature', 'temperature-interval',
    'charge', 'current', 'voltage', 'resistance', 'capacitance', 'frequency',
    'angle', 'area', 'volume', 'density', 'amount', 'dimensionless',
    'spring-constant', 'linear-density', 'intensity', 'resistivity',
    'specific-heat', 'latent-heat', 'thermal-expansivity'
  ];

  // Build one variable record (schema key order per §FORMULAS, SPEC.md).
  function V(symbol, display, description, dimension) {
    const d = DIMENSIONS[dimension];
    return {
      symbol: symbol,
      display: display,
      description: description,
      dimension: dimension,
      siUnit: d.si,
      commonUnits: d.common.slice()
    };
  }

  // ------------------------------------------------------------------
  // Categories (id → display name, in SPEC order)
  // ------------------------------------------------------------------
  const CATEGORIES = [
    { id: 'kinematics', name: 'Kinematics' },
    { id: 'forces', name: "Forces & Newton's Laws" },
    { id: 'energy', name: 'Work, Energy & Power' },
    { id: 'momentum', name: 'Momentum & Impulse' },
    { id: 'circular', name: 'Circular Motion & Gravitation' },
    { id: 'waves', name: 'Waves & Sound' },
    { id: 'optics', name: 'Optics' },
    { id: 'electricity', name: 'Electricity & Circuits' },
    { id: 'fluids', name: 'Fluids & Pressure' },
    { id: 'thermal', name: 'Thermal & Modern Physics' }
  ];

  // ------------------------------------------------------------------
  // The 56 curated formulas, in inventory order (§FORMULAS, SPEC.md)
  // ------------------------------------------------------------------
  const FORMULAS = [
    // ---------------- kinematics ----------------
    {
      id: 'kinematics-01',
      category: 'kinematics',
      name: 'Velocity with constant acceleration',
      equation: 'v = v₀ + a·t',
      statement: 'Final velocity equals initial velocity plus acceleration times elapsed time.',
      notes: 'Valid only for constant acceleration.',
      variables: [
        V('v', 'v', 'final velocity', 'velocity'),
        V('v0', 'v₀', 'initial velocity', 'velocity'),
        V('a', 'a', 'acceleration', 'acceleration'),
        V('t', 't', 'elapsed time', 'time')
      ],
      solveFor: {
        v:  { rearranged: 'v = v₀ + a·t', fn: (k) => k.v0 + k.a * k.t },
        v0: { rearranged: 'v₀ = v - a·t', fn: (k) => k.v - k.a * k.t },
        a:  { rearranged: 'a = (v - v₀) / t', fn: (k) => (k.v - k.v0) / k.t },
        t:  { rearranged: 't = (v - v₀) / a', fn: (k) => (k.v - k.v0) / k.a }
      }
    },
    {
      id: 'kinematics-02',
      category: 'kinematics',
      name: 'Position with constant acceleration',
      equation: 'Δx = v₀·t + ½·a·t²',
      statement: 'Displacement equals initial velocity times time plus half the acceleration times time squared.',
      notes: 'Valid only for constant acceleration; solving for t takes the root t = (-v₀ + √(v₀² + 2·a·Δx)) / a, the physically meaningful time for typical problems.',
      variables: [
        V('dx', 'Δx', 'displacement', 'length'),
        V('v0', 'v₀', 'initial velocity', 'velocity'),
        V('a', 'a', 'acceleration', 'acceleration'),
        V('t', 't', 'elapsed time', 'time')
      ],
      solveFor: {
        dx: { rearranged: 'Δx = v₀·t + ½·a·t²', fn: (k) => k.v0 * k.t + 0.5 * k.a * k.t * k.t },
        v0: { rearranged: 'v₀ = (Δx - ½·a·t²) / t', fn: (k) => (k.dx - 0.5 * k.a * k.t * k.t) / k.t },
        a:  { rearranged: 'a = 2·(Δx - v₀·t) / t²', fn: (k) => 2 * (k.dx - k.v0 * k.t) / (k.t * k.t) },
        t:  { rearranged: 't = (-v₀ + √(v₀² + 2·a·Δx)) / a', fn: (k) => (-k.v0 + Math.sqrt(k.v0 * k.v0 + 2 * k.a * k.dx)) / k.a }
      }
    },
    {
      id: 'kinematics-03',
      category: 'kinematics',
      name: 'Velocity-position equation',
      equation: 'v² = v₀² + 2·a·Δx',
      statement: 'Final velocity squared equals initial velocity squared plus twice the acceleration times displacement.',
      notes: 'Use when time is not given; square roots take the positive root — direction is carried by the signs of the velocities you supply.',
      variables: [
        V('v', 'v', 'final velocity', 'velocity'),
        V('v0', 'v₀', 'initial velocity', 'velocity'),
        V('a', 'a', 'acceleration', 'acceleration'),
        V('dx', 'Δx', 'displacement', 'length')
      ],
      solveFor: {
        v:  { rearranged: 'v = √(v₀² + 2·a·Δx)', fn: (k) => Math.sqrt(k.v0 * k.v0 + 2 * k.a * k.dx) },
        v0: { rearranged: 'v₀ = √(v² - 2·a·Δx)', fn: (k) => Math.sqrt(k.v * k.v - 2 * k.a * k.dx) },
        a:  { rearranged: 'a = (v² - v₀²) / (2·Δx)', fn: (k) => (k.v * k.v - k.v0 * k.v0) / (2 * k.dx) },
        dx: { rearranged: 'Δx = (v² - v₀²) / (2·a)', fn: (k) => (k.v * k.v - k.v0 * k.v0) / (2 * k.a) }
      }
    },
    {
      id: 'kinematics-04',
      category: 'kinematics',
      name: 'Displacement from average velocity',
      equation: 'Δx = ½·(v₀ + v)·t',
      statement: 'Displacement equals the average of the initial and final velocities, times the elapsed time.',
      notes: 'Valid for constant acceleration; the term ½·(v₀ + v) is the average velocity.',
      variables: [
        V('dx', 'Δx', 'displacement', 'length'),
        V('v0', 'v₀', 'initial velocity', 'velocity'),
        V('v', 'v', 'final velocity', 'velocity'),
        V('t', 't', 'elapsed time', 'time')
      ],
      solveFor: {
        dx: { rearranged: 'Δx = ½·(v₀ + v)·t', fn: (k) => 0.5 * (k.v0 + k.v) * k.t },
        v0: { rearranged: 'v₀ = 2·Δx / t - v', fn: (k) => 2 * k.dx / k.t - k.v },
        v:  { rearranged: 'v = 2·Δx / t - v₀', fn: (k) => 2 * k.dx / k.t - k.v0 },
        t:  { rearranged: 't = 2·Δx / (v₀ + v)', fn: (k) => 2 * k.dx / (k.v0 + k.v) }
      }
    },
    {
      id: 'kinematics-05',
      category: 'kinematics',
      name: 'Average velocity',
      equation: 'v_avg = Δx / t',
      statement: 'Average velocity equals displacement divided by elapsed time.',
      notes: 'This is the vector average (displacement over time), not the average speed.',
      variables: [
        V('vavg', 'v_avg', 'average velocity', 'velocity'),
        V('dx', 'Δx', 'displacement', 'length'),
        V('t', 't', 'elapsed time', 'time')
      ],
      solveFor: {
        vavg: { rearranged: 'v_avg = Δx / t', fn: (k) => k.dx / k.t },
        dx:   { rearranged: 'Δx = v_avg·t', fn: (k) => k.vavg * k.t },
        t:    { rearranged: 't = Δx / v_avg', fn: (k) => k.dx / k.vavg }
      }
    },
    {
      id: 'kinematics-06',
      category: 'kinematics',
      name: 'Displacement at constant velocity',
      equation: 'Δx = v·t',
      statement: 'Displacement equals constant velocity times elapsed time.',
      notes: 'Valid only for constant velocity (zero acceleration).',
      variables: [
        V('dx', 'Δx', 'displacement', 'length'),
        V('v', 'v', 'constant velocity', 'velocity'),
        V('t', 't', 'elapsed time', 'time')
      ],
      solveFor: {
        dx: { rearranged: 'Δx = v·t', fn: (k) => k.v * k.t },
        v:  { rearranged: 'v = Δx / t', fn: (k) => k.dx / k.t },
        t:  { rearranged: 't = Δx / v', fn: (k) => k.dx / k.v }
      }
    },

    // ---------------- forces ----------------
    {
      id: 'forces-01',
      category: 'forces',
      name: "Newton's second law",
      equation: 'F = m·a',
      statement: 'Net force equals mass times acceleration.',
      notes: 'F must be the NET force on the object; add up all forces first when more than one acts.',
      variables: [
        V('F', 'F', 'net force', 'force'),
        V('m', 'm', 'mass', 'mass'),
        V('a', 'a', 'acceleration', 'acceleration')
      ],
      solveFor: {
        F: { rearranged: 'F = m·a', fn: (k) => k.m * k.a },
        m: { rearranged: 'm = F / a', fn: (k) => k.F / k.a },
        a: { rearranged: 'a = F / m', fn: (k) => k.F / k.m }
      }
    },
    {
      id: 'forces-02',
      category: 'forces',
      name: 'Weight',
      equation: 'W = m·g',
      statement: 'Weight equals mass times gravitational acceleration.',
      notes: "Near Earth's surface use g = 9.81 m/s^2 (standard gravity is 9.80665 m/s^2).",
      variables: [
        V('W', 'W', 'weight', 'force'),
        V('m', 'm', 'mass', 'mass'),
        V('g', 'g', 'gravitational acceleration', 'acceleration')
      ],
      solveFor: {
        W: { rearranged: 'W = m·g', fn: (k) => k.m * k.g },
        m: { rearranged: 'm = W / g', fn: (k) => k.W / k.g },
        g: { rearranged: 'g = W / m', fn: (k) => k.W / k.m }
      }
    },
    {
      id: 'forces-03',
      category: 'forces',
      name: 'Friction force',
      equation: 'f = μ·N',
      statement: 'Friction force equals the coefficient of friction times the normal force.',
      notes: 'μ is dimensionless; on a level surface the normal force often equals the weight m·g.',
      variables: [
        V('f', 'f', 'friction force', 'force'),
        V('mu', 'μ', 'coefficient of friction', 'dimensionless'),
        V('N', 'N', 'normal force', 'force')
      ],
      solveFor: {
        f:  { rearranged: 'f = μ·N', fn: (k) => k.mu * k.N },
        mu: { rearranged: 'μ = f / N', fn: (k) => k.f / k.N },
        N:  { rearranged: 'N = f / μ', fn: (k) => k.f / k.mu }
      }
    },
    {
      id: 'forces-04',
      category: 'forces',
      name: "Hooke's law (spring force)",
      equation: 'F = k·Δx',
      statement: 'Spring force equals the spring constant times the displacement from equilibrium.',
      notes: "Δx is measured from the spring's natural length; the restoring force opposes the displacement.",
      variables: [
        V('F', 'F', 'spring force', 'force'),
        V('k', 'k', 'spring constant', 'spring-constant'),
        V('dx', 'Δx', 'stretch or compression of the spring', 'length')
      ],
      solveFor: {
        F:  { rearranged: 'F = k·Δx', fn: (k) => k.k * k.dx },
        k:  { rearranged: 'k = F / Δx', fn: (k) => k.F / k.dx },
        dx: { rearranged: 'Δx = F / k', fn: (k) => k.F / k.k }
      }
    },

    // ---------------- energy ----------------
    {
      id: 'energy-01',
      category: 'energy',
      name: 'Work done by a constant force',
      equation: 'W = F·d·cos θ',
      statement: 'Work equals force times displacement times the cosine of the angle between them.',
      notes: 'θ is the angle between the force and the displacement; the work is zero when they are perpendicular. Angles are in radians (SI) — convert degrees first.',
      variables: [
        V('W', 'W', 'work done', 'energy'),
        V('F', 'F', 'applied force', 'force'),
        V('d', 'd', 'displacement along the motion', 'length'),
        V('theta', 'θ', 'angle between the force and the displacement', 'angle')
      ],
      solveFor: {
        W:     { rearranged: 'W = F·d·cos θ', fn: (k) => k.F * k.d * Math.cos(k.theta) },
        F:     { rearranged: 'F = W / (d·cos θ)', fn: (k) => k.W / (k.d * Math.cos(k.theta)) },
        d:     { rearranged: 'd = W / (F·cos θ)', fn: (k) => k.W / (k.F * Math.cos(k.theta)) },
        theta: { rearranged: 'θ = arccos(W / (F·d))', fn: (k) => Math.acos(k.W / (k.F * k.d)) }
      }
    },
    {
      id: 'energy-02',
      category: 'energy',
      name: 'Kinetic energy',
      equation: 'KE = ½·m·v²',
      statement: 'Kinetic energy equals half the mass times the speed squared.',
      notes: 'Solving for v takes the positive root (a speed).',
      variables: [
        V('KE', 'KE', 'kinetic energy', 'energy'),
        V('m', 'm', 'mass', 'mass'),
        V('v', 'v', 'speed', 'velocity')
      ],
      solveFor: {
        KE: { rearranged: 'KE = ½·m·v²', fn: (k) => 0.5 * k.m * k.v * k.v },
        m:  { rearranged: 'm = 2·KE / v²', fn: (k) => 2 * k.KE / (k.v * k.v) },
        v:  { rearranged: 'v = √(2·KE / m)', fn: (k) => Math.sqrt(2 * k.KE / k.m) }
      }
    },
    {
      id: 'energy-03',
      category: 'energy',
      name: 'Gravitational potential energy',
      equation: 'PE = m·g·h',
      statement: 'Gravitational potential energy equals mass times gravitational acceleration times height.',
      notes: "Height h is measured from any chosen reference level; near Earth's surface g = 9.81 m/s^2.",
      variables: [
        V('PE', 'PE', 'gravitational potential energy', 'energy'),
        V('m', 'm', 'mass', 'mass'),
        V('g', 'g', 'gravitational acceleration', 'acceleration'),
        V('h', 'h', 'height above the reference level', 'length')
      ],
      solveFor: {
        PE: { rearranged: 'PE = m·g·h', fn: (k) => k.m * k.g * k.h },
        m:  { rearranged: 'm = PE / (g·h)', fn: (k) => k.PE / (k.g * k.h) },
        g:  { rearranged: 'g = PE / (m·h)', fn: (k) => k.PE / (k.m * k.h) },
        h:  { rearranged: 'h = PE / (m·g)', fn: (k) => k.PE / (k.m * k.g) }
      }
    },
    {
      id: 'energy-04',
      category: 'energy',
      name: 'Elastic potential energy',
      equation: 'PE_s = ½·k·Δx²',
      statement: 'Spring potential energy equals half the spring constant times the displacement squared.',
      notes: "Δx is measured from the spring's natural length; solving for Δx takes the positive root.",
      variables: [
        V('PEs', 'PE_s', 'elastic potential energy', 'energy'),
        V('k', 'k', 'spring constant', 'spring-constant'),
        V('dx', 'Δx', 'stretch or compression of the spring', 'length')
      ],
      solveFor: {
        PEs: { rearranged: 'PE_s = ½·k·Δx²', fn: (k) => 0.5 * k.k * k.dx * k.dx },
        k:   { rearranged: 'k = 2·PE_s / Δx²', fn: (k) => 2 * k.PEs / (k.dx * k.dx) },
        dx:  { rearranged: 'Δx = √(2·PE_s / k)', fn: (k) => Math.sqrt(2 * k.PEs / k.k) }
      }
    },
    {
      id: 'energy-05',
      category: 'energy',
      name: 'Power from work',
      equation: 'P = W / t',
      statement: 'Power equals work divided by the time it takes.',
      notes: 'Here W means work (energy transferred), not weight.',
      variables: [
        V('P', 'P', 'power', 'power'),
        V('W', 'W', 'work done', 'energy'),
        V('t', 't', 'time interval', 'time')
      ],
      solveFor: {
        P: { rearranged: 'P = W / t', fn: (k) => k.W / k.t },
        W: { rearranged: 'W = P·t', fn: (k) => k.P * k.t },
        t: { rearranged: 't = W / P', fn: (k) => k.W / k.P }
      }
    },
    {
      id: 'energy-06',
      category: 'energy',
      name: 'Instantaneous power',
      equation: 'P = F·v',
      statement: 'Power equals force times velocity.',
      notes: 'Gives the instantaneous power when a force acts on an object moving at velocity v.',
      variables: [
        V('P', 'P', 'power', 'power'),
        V('F', 'F', 'applied force', 'force'),
        V('v', 'v', 'velocity', 'velocity')
      ],
      solveFor: {
        P: { rearranged: 'P = F·v', fn: (k) => k.F * k.v },
        F: { rearranged: 'F = P / v', fn: (k) => k.P / k.v },
        v: { rearranged: 'v = P / F', fn: (k) => k.P / k.F }
      }
    },
    {
      id: 'energy-07',
      category: 'energy',
      name: 'Conservation of mechanical energy',
      equation: '½·m·v₁² + m·g·h₁ = ½·m·v₂² + m·g·h₂',
      statement: 'When only gravity and springs do work, kinetic plus potential energy at point 1 equals kinetic plus potential energy at point 2.',
      notes: 'With no friction or drag, mechanical energy is conserved. The mass cancels, so this equation constrains the speeds and heights but cannot solve for m (any mass works when the values balance — solving for m returns no finite value). Speeds from square roots take the positive root.',
      variables: [
        V('m', 'm', 'mass', 'mass'),
        V('v1', 'v₁', 'speed at point 1', 'velocity'),
        V('h1', 'h₁', 'height at point 1', 'length'),
        V('v2', 'v₂', 'speed at point 2', 'velocity'),
        V('h2', 'h₂', 'height at point 2', 'length'),
        V('g', 'g', 'gravitational acceleration', 'acceleration')
      ],
      solveFor: {
        m:  { rearranged: 'm cancels: ½·v₁² + g·h₁ = ½·v₂² + g·h₂ (any mass)', fn: (k) => NaN },
        v1: { rearranged: 'v₁ = √(v₂² + 2·g·h₂ - 2·g·h₁)', fn: (k) => Math.sqrt(k.v2 * k.v2 + 2 * k.g * k.h2 - 2 * k.g * k.h1) },
        h1: { rearranged: 'h₁ = h₂ + (v₂² - v₁²) / (2·g)', fn: (k) => k.h2 + (k.v2 * k.v2 - k.v1 * k.v1) / (2 * k.g) },
        v2: { rearranged: 'v₂ = √(v₁² + 2·g·h₁ - 2·g·h₂)', fn: (k) => Math.sqrt(k.v1 * k.v1 + 2 * k.g * k.h1 - 2 * k.g * k.h2) },
        h2: { rearranged: 'h₂ = h₁ + (v₁² - v₂²) / (2·g)', fn: (k) => k.h1 + (k.v1 * k.v1 - k.v2 * k.v2) / (2 * k.g) },
        g:  { rearranged: 'g = (v₂² - v₁²) / (2·(h₁ - h₂))', fn: (k) => (k.v2 * k.v2 - k.v1 * k.v1) / (2 * (k.h1 - k.h2)) }
      }
    },
    // ---------------- momentum ----------------
    {
      id: 'momentum-01',
      category: 'momentum',
      name: 'Momentum',
      equation: 'p = m·v',
      statement: 'Momentum equals mass times velocity.',
      notes: 'Momentum is a vector; keep the signs consistent with your chosen direction.',
      variables: [
        V('p', 'p', 'momentum', 'momentum'),
        V('m', 'm', 'mass', 'mass'),
        V('v', 'v', 'velocity', 'velocity')
      ],
      solveFor: {
        p: { rearranged: 'p = m·v', fn: (k) => k.m * k.v },
        m: { rearranged: 'm = p / v', fn: (k) => k.p / k.v },
        v: { rearranged: 'v = p / m', fn: (k) => k.p / k.m }
      }
    },
    {
      id: 'momentum-02',
      category: 'momentum',
      name: 'Impulse from force and time',
      equation: 'J = F·Δt',
      statement: 'Impulse equals force times the time interval during which it acts.',
      notes: 'For a constant force, impulse is the area under the force-time graph.',
      variables: [
        V('J', 'J', 'impulse', 'momentum'),
        V('F', 'F', 'average force', 'force'),
        V('dt', 'Δt', 'time interval the force acts', 'time')
      ],
      solveFor: {
        J:  { rearranged: 'J = F·Δt', fn: (k) => k.F * k.dt },
        F:  { rearranged: 'F = J / Δt', fn: (k) => k.J / k.dt },
        dt: { rearranged: 'Δt = J / F', fn: (k) => k.J / k.F }
      }
    },
    {
      id: 'momentum-03',
      category: 'momentum',
      name: 'Impulse-momentum theorem',
      equation: 'J = m·Δv',
      statement: 'Impulse equals mass times the change in velocity.',
      notes: 'Same impulse as J = F·Δt; Δv is the change in velocity (final minus initial).',
      variables: [
        V('J', 'J', 'impulse', 'momentum'),
        V('m', 'm', 'mass', 'mass'),
        V('dv', 'Δv', 'change in velocity', 'velocity')
      ],
      solveFor: {
        J:  { rearranged: 'J = m·Δv', fn: (k) => k.m * k.dv },
        m:  { rearranged: 'm = J / Δv', fn: (k) => k.J / k.dv },
        dv: { rearranged: 'Δv = J / m', fn: (k) => k.J / k.m }
      }
    },

    // ---------------- circular ----------------
    {
      id: 'circular-01',
      category: 'circular',
      name: 'Speed in uniform circular motion',
      equation: 'v = 2·π·r / T',
      statement: 'Speed in uniform circular motion equals two pi times the radius divided by the period.',
      notes: 'T is the time for one full revolution; the speed is constant but the direction keeps changing.',
      variables: [
        V('v', 'v', 'tangential speed', 'velocity'),
        V('r', 'r', 'radius of the circular path', 'length'),
        V('T', 'T', 'period of one revolution', 'time')
      ],
      solveFor: {
        v: { rearranged: 'v = 2·π·r / T', fn: (k) => 2 * Math.PI * k.r / k.T },
        r: { rearranged: 'r = v·T / (2·π)', fn: (k) => k.v * k.T / (2 * Math.PI) },
        T: { rearranged: 'T = 2·π·r / v', fn: (k) => 2 * Math.PI * k.r / k.v }
      }
    },
    {
      id: 'circular-02',
      category: 'circular',
      name: 'Centripetal acceleration',
      equation: 'a_c = v² / r',
      statement: 'Centripetal acceleration equals speed squared divided by radius.',
      notes: 'Points toward the center of the circle; solving for v takes the positive root.',
      variables: [
        V('ac', 'a_c', 'centripetal acceleration', 'acceleration'),
        V('v', 'v', 'tangential speed', 'velocity'),
        V('r', 'r', 'radius of the circular path', 'length')
      ],
      solveFor: {
        ac: { rearranged: 'a_c = v² / r', fn: (k) => k.v * k.v / k.r },
        v:  { rearranged: 'v = √(a_c·r)', fn: (k) => Math.sqrt(k.ac * k.r) },
        r:  { rearranged: 'r = v² / a_c', fn: (k) => k.v * k.v / k.ac }
      }
    },
    {
      id: 'circular-03',
      category: 'circular',
      name: 'Centripetal force',
      equation: 'F_c = m·v² / r',
      statement: 'Centripetal force equals mass times speed squared divided by radius.',
      notes: 'Supplied by a real force (tension, gravity, friction); solving for v takes the positive root.',
      variables: [
        V('Fc', 'F_c', 'centripetal force', 'force'),
        V('m', 'm', 'mass', 'mass'),
        V('v', 'v', 'tangential speed', 'velocity'),
        V('r', 'r', 'radius of the circular path', 'length')
      ],
      solveFor: {
        Fc: { rearranged: 'F_c = m·v² / r', fn: (k) => k.m * k.v * k.v / k.r },
        m:  { rearranged: 'm = F_c·r / v²', fn: (k) => k.Fc * k.r / (k.v * k.v) },
        v:  { rearranged: 'v = √(F_c·r / m)', fn: (k) => Math.sqrt(k.Fc * k.r / k.m) },
        r:  { rearranged: 'r = m·v² / F_c', fn: (k) => k.m * k.v * k.v / k.Fc }
      }
    },
    {
      id: 'circular-04',
      category: 'circular',
      name: "Newton's law of gravitation",
      equation: 'F_g = G·m₁·m₂ / r²',
      statement: 'Gravitational force equals G times the product of the two masses divided by the square of the distance between their centers.',
      notes: 'G = 6.674 × 10⁻¹¹ N·m²/kg²; r is the distance between the centers of the two masses. Solving for r takes the positive root.',
      variables: [
        V('Fg', 'F_g', 'gravitational force', 'force'),
        V('m1', 'm₁', 'first mass', 'mass'),
        V('m2', 'm₂', 'second mass', 'mass'),
        V('r', 'r', 'distance between the centers', 'length')
      ],
      solveFor: {
        Fg: { rearranged: 'F_g = G·m₁·m₂ / r²', fn: (k) => GRAV * k.m1 * k.m2 / (k.r * k.r) },
        m1: { rearranged: 'm₁ = F_g·r² / (G·m₂)', fn: (k) => k.Fg * k.r * k.r / (GRAV * k.m2) },
        m2: { rearranged: 'm₂ = F_g·r² / (G·m₁)', fn: (k) => k.Fg * k.r * k.r / (GRAV * k.m1) },
        r:  { rearranged: 'r = √(G·m₁·m₂ / F_g)', fn: (k) => Math.sqrt(GRAV * k.m1 * k.m2 / k.Fg) }
      }
    },
    {
      id: 'circular-05',
      category: 'circular',
      name: 'Gravitational field strength',
      equation: 'g = G·M / r²',
      statement: 'Gravitational field strength equals G times the central mass divided by the square of the distance from its center.',
      notes: "G = 6.674 × 10⁻¹¹ N·m²/kg²; near Earth's surface this gives g ≈ 9.81 m/s^2. Solving for r takes the positive root.",
      variables: [
        V('g', 'g', 'gravitational field strength', 'acceleration'),
        V('M', 'M', 'mass of the planet or star', 'mass'),
        V('r', 'r', 'distance from the center', 'length')
      ],
      solveFor: {
        g: { rearranged: 'g = G·M / r²', fn: (k) => GRAV * k.M / (k.r * k.r) },
        M: { rearranged: 'M = g·r² / G', fn: (k) => k.g * k.r * k.r / GRAV },
        r: { rearranged: 'r = √(G·M / g)', fn: (k) => Math.sqrt(GRAV * k.M / k.g) }
      }
    },
    {
      id: 'circular-06',
      category: 'circular',
      name: 'Orbital speed',
      equation: 'v = √(G·M / r)',
      statement: 'Orbital speed equals the square root of G times the central mass divided by the orbital radius.',
      notes: 'G = 6.674 × 10⁻¹¹ N·m²/kg²; applies to a small body orbiting a much larger central mass M.',
      variables: [
        V('v', 'v', 'orbital speed', 'velocity'),
        V('M', 'M', 'mass of the planet or star', 'mass'),
        V('r', 'r', 'orbital radius', 'length')
      ],
      solveFor: {
        v: { rearranged: 'v = √(G·M / r)', fn: (k) => Math.sqrt(GRAV * k.M / k.r) },
        M: { rearranged: 'M = v²·r / G', fn: (k) => k.v * k.v * k.r / GRAV },
        r: { rearranged: 'r = G·M / v²', fn: (k) => GRAV * k.M / (k.v * k.v) }
      }
    },
    {
      id: 'circular-07',
      category: 'circular',
      name: "Kepler's third law (circular orbit)",
      equation: 'T² = 4·π²·r³ / (G·M)',
      statement: 'The square of the orbital period equals four pi squared times the orbital radius cubed, divided by G times the central mass.',
      notes: "G = 6.674 × 10⁻¹¹ N·m²/kg²; circular-orbit form of Kepler's third law. Solving for T takes the positive root and r the positive real cube root.",
      variables: [
        V('T', 'T', 'orbital period', 'time'),
        V('r', 'r', 'orbital radius', 'length'),
        V('M', 'M', 'mass of the planet or star', 'mass')
      ],
      solveFor: {
        T: { rearranged: 'T = √(4·π²·r³ / (G·M))', fn: (k) => Math.sqrt(4 * Math.PI * Math.PI * k.r * k.r * k.r / (GRAV * k.M)) },
        r: { rearranged: 'r = ∛(G·M·T² / (4·π²))', fn: (k) => Math.cbrt(GRAV * k.M * k.T * k.T / (4 * Math.PI * Math.PI)) },
        M: { rearranged: 'M = 4·π²·r³ / (G·T²)', fn: (k) => 4 * Math.PI * Math.PI * k.r * k.r * k.r / (GRAV * k.T * k.T) }
      }
    },

    // ---------------- waves ----------------
    {
      id: 'waves-01',
      category: 'waves',
      name: 'Wave speed',
      equation: 'v = f·λ',
      statement: 'Wave speed equals frequency times wavelength.',
      notes: 'Applies to any periodic wave; for light in vacuum v = c = 2.998 × 10⁸ m/s.',
      variables: [
        V('v', 'v', 'wave speed', 'velocity'),
        V('f', 'f', 'frequency', 'frequency'),
        V('lambda', 'λ', 'wavelength', 'length')
      ],
      solveFor: {
        v:      { rearranged: 'v = f·λ', fn: (k) => k.f * k.lambda },
        f:      { rearranged: 'f = v / λ', fn: (k) => k.v / k.lambda },
        lambda: { rearranged: 'λ = v / f', fn: (k) => k.v / k.f }
      }
    },
    {
      id: 'waves-02',
      category: 'waves',
      name: 'Period from frequency',
      equation: 'T = 1 / f',
      statement: 'Period equals one divided by frequency.',
      notes: 'Frequency and period are reciprocals.',
      variables: [
        V('T', 'T', 'period of the oscillation', 'time'),
        V('f', 'f', 'frequency', 'frequency')
      ],
      solveFor: {
        T: { rearranged: 'T = 1 / f', fn: (k) => 1 / k.f },
        f: { rearranged: 'f = 1 / T', fn: (k) => 1 / k.T }
      }
    },
    {
      id: 'waves-03',
      category: 'waves',
      name: 'Beat frequency',
      equation: 'f_b = |f₁ - f₂|',
      statement: 'Beat frequency equals the absolute difference of the two frequencies.',
      notes: 'Convention: solving for f₁ assumes f₁ ≥ f₂ (f₁ = f₂ + f_b) and solving for f₂ assumes f₁ ≥ f₂ (f₂ = f₁ - f_b).',
      variables: [
        V('fbeat', 'f_b', 'beat frequency', 'frequency'),
        V('f1', 'f₁', 'first frequency', 'frequency'),
        V('f2', 'f₂', 'second frequency', 'frequency')
      ],
      solveFor: {
        fbeat: { rearranged: 'f_b = |f₁ - f₂|', fn: (k) => Math.abs(k.f1 - k.f2) },
        f1:    { rearranged: 'f₁ = f₂ + f_b', fn: (k) => k.f2 + k.fbeat },
        f2:    { rearranged: 'f₂ = f₁ - f_b', fn: (k) => k.f1 - k.fbeat }
      }
    },
    {
      id: 'waves-04',
      category: 'waves',
      name: 'Wave speed on a string',
      equation: 'v = √(F_T / μ)',
      statement: 'Wave speed on a string equals the square root of the tension divided by the linear density.',
      notes: 'μ here is the mass per unit length of the string (not the coefficient of friction); the square root takes the positive root.',
      variables: [
        V('v', 'v', 'wave speed', 'velocity'),
        V('FT', 'F_T', 'tension in the string', 'force'),
        V('muL', 'μ', 'mass per unit length of the string', 'linear-density')
      ],
      solveFor: {
        v:   { rearranged: 'v = √(F_T / μ)', fn: (k) => Math.sqrt(k.FT / k.muL) },
        FT:  { rearranged: 'F_T = μ·v²', fn: (k) => k.muL * k.v * k.v },
        muL: { rearranged: 'μ = F_T / v²', fn: (k) => k.FT / (k.v * k.v) }
      }
    },
    {
      id: 'waves-05',
      category: 'waves',
      name: 'Intensity',
      equation: 'I = P / A',
      statement: 'Intensity equals power divided by the area the power passes through.',
      notes: 'A is the area perpendicular to the direction the wave travels.',
      variables: [
        V('I', 'I', 'intensity', 'intensity'),
        V('P', 'P', 'power', 'power'),
        V('A', 'A', 'area', 'area')
      ],
      solveFor: {
        I: { rearranged: 'I = P / A', fn: (k) => k.P / k.A },
        P: { rearranged: 'P = I·A', fn: (k) => k.I * k.A },
        A: { rearranged: 'A = P / I', fn: (k) => k.P / k.I }
      }
    },

    // ---------------- optics ----------------
    {
      id: 'optics-01',
      category: 'optics',
      name: 'Thin lens equation',
      equation: '1/f = 1/d_o + 1/d_i',
      statement: 'One over the focal length equals one over the object distance plus one over the image distance.',
      notes: 'Sign conventions: d_o > 0 for real objects; d_i > 0 for real images (opposite side of the lens) and d_i < 0 for virtual images.',
      variables: [
        V('f', 'f', 'focal length', 'length'),
        V('do', 'd_o', 'object distance from the lens', 'length'),
        V('di', 'd_i', 'image distance from the lens', 'length')
      ],
      solveFor: {
        f:  { rearranged: 'f = (d_o·d_i) / (d_o + d_i)', fn: (k) => k.do * k.di / (k.do + k.di) },
        do: { rearranged: 'd_o = (f·d_i) / (d_i - f)', fn: (k) => k.f * k.di / (k.di - k.f) },
        di: { rearranged: 'd_i = (f·d_o) / (d_o - f)', fn: (k) => k.f * k.do / (k.do - k.f) }
      }
    },
    {
      id: 'optics-02',
      category: 'optics',
      name: 'Magnification from distances',
      equation: 'm = -d_i / d_o',
      statement: 'Magnification equals minus the image distance divided by the object distance.',
      notes: 'A negative magnification means an inverted image; |m| > 1 means the image is enlarged.',
      variables: [
        V('m', 'm', 'magnification', 'dimensionless'),
        V('di', 'd_i', 'image distance from the lens', 'length'),
        V('do', 'd_o', 'object distance from the lens', 'length')
      ],
      solveFor: {
        m:  { rearranged: 'm = -d_i / d_o', fn: (k) => -k.di / k.do },
        di: { rearranged: 'd_i = -m·d_o', fn: (k) => -k.m * k.do },
        do: { rearranged: 'd_o = -d_i / m', fn: (k) => -k.di / k.m }
      }
    },
    {
      id: 'optics-03',
      category: 'optics',
      name: 'Magnification from heights',
      equation: 'm = h_i / h_o',
      statement: 'Magnification equals image height divided by object height.',
      notes: 'A positive m means an upright image; heights measured below the axis are negative.',
      variables: [
        V('m', 'm', 'magnification', 'dimensionless'),
        V('hi', 'h_i', 'image height', 'length'),
        V('ho', 'h_o', 'object height', 'length')
      ],
      solveFor: {
        m:  { rearranged: 'm = h_i / h_o', fn: (k) => k.hi / k.ho },
        hi: { rearranged: 'h_i = m·h_o', fn: (k) => k.m * k.ho },
        ho: { rearranged: 'h_o = h_i / m', fn: (k) => k.hi / k.m }
      }
    },
    {
      id: 'optics-04',
      category: 'optics',
      name: 'Index of refraction',
      equation: 'n = c / v',
      statement: 'The index of refraction equals the speed of light in vacuum divided by the speed of light in the medium.',
      notes: 'c = 2.998 × 10⁸ m/s is the speed of light in vacuum; n ≥ 1 for any material medium.',
      variables: [
        V('n', 'n', 'index of refraction', 'dimensionless'),
        V('v', 'v', 'speed of light in the medium', 'velocity')
      ],
      solveFor: {
        n: { rearranged: 'n = c / v', fn: (k) => C_LIGHT / k.v },
        v: { rearranged: 'v = c / n', fn: (k) => C_LIGHT / k.n }
      }
    },
    {
      id: 'optics-05',
      category: 'optics',
      name: "Snell's law",
      equation: 'n₁·sin θ₁ = n₂·sin θ₂',
      statement: 'The first index of refraction times the sine of the incidence angle equals the second index times the sine of the refraction angle.',
      notes: 'Angles are measured from the normal and used in radians (SI); solving for an angle uses the inverse sine, which is only defined when the ratio is at most 1 (past that, total internal reflection occurs).',
      variables: [
        V('n1', 'n₁', 'index of refraction of the first medium', 'dimensionless'),
        V('theta1', 'θ₁', 'angle of incidence', 'angle'),
        V('n2', 'n₂', 'index of refraction of the second medium', 'dimensionless'),
        V('theta2', 'θ₂', 'angle of refraction', 'angle')
      ],
      solveFor: {
        n1:     { rearranged: 'n₁ = n₂·sin θ₂ / sin θ₁', fn: (k) => k.n2 * Math.sin(k.theta2) / Math.sin(k.theta1) },
        theta1: { rearranged: 'θ₁ = asin(n₂·sin θ₂ / n₁)', fn: (k) => Math.asin(k.n2 * Math.sin(k.theta2) / k.n1) },
        n2:     { rearranged: 'n₂ = n₁·sin θ₁ / sin θ₂', fn: (k) => k.n1 * Math.sin(k.theta1) / Math.sin(k.theta2) },
        theta2: { rearranged: 'θ₂ = asin(n₁·sin θ₁ / n₂)', fn: (k) => Math.asin(k.n1 * Math.sin(k.theta1) / k.n2) }
      }
    },
    // ---------------- electricity ----------------
    {
      id: 'electricity-01',
      category: 'electricity',
      name: "Ohm's law",
      equation: 'V = I·R',
      statement: 'Voltage equals current times resistance.',
      notes: 'V is the potential difference across the resistor R.',
      variables: [
        V('V', 'V', 'voltage', 'voltage'),
        V('I', 'I', 'current', 'current'),
        V('R', 'R', 'resistance', 'resistance')
      ],
      solveFor: {
        V: { rearranged: 'V = I·R', fn: (k) => k.I * k.R },
        I: { rearranged: 'I = V / R', fn: (k) => k.V / k.R },
        R: { rearranged: 'R = V / I', fn: (k) => k.V / k.I }
      }
    },
    {
      id: 'electricity-02',
      category: 'electricity',
      name: 'Electrical power (voltage and current)',
      equation: 'P = V·I',
      statement: 'Power equals voltage times current.',
      notes: 'The power delivered by a portion of a circuit.',
      variables: [
        V('P', 'P', 'power', 'power'),
        V('V', 'V', 'voltage', 'voltage'),
        V('I', 'I', 'current', 'current')
      ],
      solveFor: {
        P: { rearranged: 'P = V·I', fn: (k) => k.V * k.I },
        V: { rearranged: 'V = P / I', fn: (k) => k.P / k.I },
        I: { rearranged: 'I = P / V', fn: (k) => k.P / k.V }
      }
    },
    {
      id: 'electricity-03',
      category: 'electricity',
      name: 'Power from current and resistance',
      equation: 'P = I²·R',
      statement: 'Power equals current squared times resistance.',
      notes: 'Ohmic heating in a resistor; solving for I takes the positive root.',
      variables: [
        V('P', 'P', 'power dissipated', 'power'),
        V('I', 'I', 'current', 'current'),
        V('R', 'R', 'resistance', 'resistance')
      ],
      solveFor: {
        P: { rearranged: 'P = I²·R', fn: (k) => k.I * k.I * k.R },
        I: { rearranged: 'I = √(P / R)', fn: (k) => Math.sqrt(k.P / k.R) },
        R: { rearranged: 'R = P / I²', fn: (k) => k.P / (k.I * k.I) }
      }
    },
    {
      id: 'electricity-04',
      category: 'electricity',
      name: 'Power from voltage and resistance',
      equation: 'P = V² / R',
      statement: 'Power equals voltage squared divided by resistance.',
      notes: 'Ohmic heating in a resistor; solving for V takes the positive root.',
      variables: [
        V('P', 'P', 'power dissipated', 'power'),
        V('V', 'V', 'voltage', 'voltage'),
        V('R', 'R', 'resistance', 'resistance')
      ],
      solveFor: {
        P: { rearranged: 'P = V² / R', fn: (k) => k.V * k.V / k.R },
        V: { rearranged: 'V = √(P·R)', fn: (k) => Math.sqrt(k.P * k.R) },
        R: { rearranged: 'R = V² / P', fn: (k) => k.V * k.V / k.P }
      }
    },
    {
      id: 'electricity-05',
      category: 'electricity',
      name: 'Charge from current',
      equation: 'Q = I·t',
      statement: 'Charge equals current times the time it flows.',
      notes: 'One ampere flowing for one second moves one coulomb of charge.',
      variables: [
        V('Q', 'Q', 'charge transferred', 'charge'),
        V('I', 'I', 'current', 'current'),
        V('t', 't', 'time the current flows', 'time')
      ],
      solveFor: {
        Q: { rearranged: 'Q = I·t', fn: (k) => k.I * k.t },
        I: { rearranged: 'I = Q / t', fn: (k) => k.Q / k.t },
        t: { rearranged: 't = Q / I', fn: (k) => k.Q / k.I }
      }
    },
    {
      id: 'electricity-06',
      category: 'electricity',
      name: 'Resistance of a wire',
      equation: 'R = ρ·L / A',
      statement: 'Resistance equals resistivity times length divided by cross-sectional area.',
      notes: 'ρ is a property of the material (copper: ρ = 1.68 × 10⁻⁸ Ω·m); longer or thinner wires have more resistance.',
      variables: [
        V('R', 'R', 'resistance', 'resistance'),
        V('rho', 'ρ', 'resistivity of the material', 'resistivity'),
        V('L', 'L', 'length of the wire', 'length'),
        V('A', 'A', 'cross-sectional area', 'area')
      ],
      solveFor: {
        R:   { rearranged: 'R = ρ·L / A', fn: (k) => k.rho * k.L / k.A },
        rho: { rearranged: 'ρ = R·A / L', fn: (k) => k.R * k.A / k.L },
        L:   { rearranged: 'L = R·A / ρ', fn: (k) => k.R * k.A / k.rho },
        A:   { rearranged: 'A = ρ·L / R', fn: (k) => k.rho * k.L / k.R }
      }
    },
    {
      id: 'electricity-07',
      category: 'electricity',
      name: "Coulomb's law",
      equation: 'F = k_e·q₁·q₂ / r²',
      statement: "Electric force equals Coulomb's constant times the product of the charges divided by the square of the distance between them.",
      notes: 'k_e = 8.988 × 10⁹ N·m²/C²; r is the distance between the charges. Solving for r takes the positive root.',
      variables: [
        V('F', 'F', 'electric force', 'force'),
        V('q1', 'q₁', 'first charge', 'charge'),
        V('q2', 'q₂', 'second charge', 'charge'),
        V('r', 'r', 'distance between the charges', 'length')
      ],
      solveFor: {
        F:  { rearranged: 'F = k_e·q₁·q₂ / r²', fn: (k) => K_E * k.q1 * k.q2 / (k.r * k.r) },
        q1: { rearranged: 'q₁ = F·r² / (k_e·q₂)', fn: (k) => k.F * k.r * k.r / (K_E * k.q2) },
        q2: { rearranged: 'q₂ = F·r² / (k_e·q₁)', fn: (k) => k.F * k.r * k.r / (K_E * k.q1) },
        r:  { rearranged: 'r = √(k_e·q₁·q₂ / F)', fn: (k) => Math.sqrt(K_E * k.q1 * k.q2 / k.F) }
      }
    },
    {
      id: 'electricity-08',
      category: 'electricity',
      name: 'Capacitance',
      equation: 'C = Q / V',
      statement: 'Capacitance equals stored charge divided by the voltage across the capacitor.',
      notes: 'One farad stores one coulomb per volt.',
      variables: [
        V('C', 'C', 'capacitance', 'capacitance'),
        V('Q', 'Q', 'charge stored', 'charge'),
        V('V', 'V', 'voltage across the capacitor', 'voltage')
      ],
      solveFor: {
        C: { rearranged: 'C = Q / V', fn: (k) => k.Q / k.V },
        Q: { rearranged: 'Q = C·V', fn: (k) => k.C * k.V },
        V: { rearranged: 'V = Q / C', fn: (k) => k.Q / k.C }
      }
    },

    // ---------------- fluids ----------------
    {
      id: 'fluids-01',
      category: 'fluids',
      name: 'Definition of pressure',
      equation: 'P = F / A',
      statement: 'Pressure equals force divided by the area it acts on.',
      notes: 'The force is applied perpendicular to the area.',
      variables: [
        V('P', 'P', 'pressure', 'pressure'),
        V('F', 'F', 'force on the surface', 'force'),
        V('A', 'A', 'area of the surface', 'area')
      ],
      solveFor: {
        P: { rearranged: 'P = F / A', fn: (k) => k.F / k.A },
        F: { rearranged: 'F = P·A', fn: (k) => k.P * k.A },
        A: { rearranged: 'A = F / P', fn: (k) => k.F / k.P }
      }
    },
    {
      id: 'fluids-02',
      category: 'fluids',
      name: 'Hydrostatic pressure',
      equation: 'P = ρ·g·h',
      statement: 'Hydrostatic pressure equals fluid density times gravitational acceleration times depth.',
      notes: 'h is the depth below the fluid surface; this is the gauge pressure (atmospheric pressure not included).',
      variables: [
        V('P', 'P', 'pressure', 'pressure'),
        V('rho', 'ρ', 'density of the fluid', 'density'),
        V('g', 'g', 'gravitational acceleration', 'acceleration'),
        V('h', 'h', 'depth below the surface', 'length')
      ],
      solveFor: {
        P:   { rearranged: 'P = ρ·g·h', fn: (k) => k.rho * k.g * k.h },
        rho: { rearranged: 'ρ = P / (g·h)', fn: (k) => k.P / (k.g * k.h) },
        g:   { rearranged: 'g = P / (ρ·h)', fn: (k) => k.P / (k.rho * k.h) },
        h:   { rearranged: 'h = P / (ρ·g)', fn: (k) => k.P / (k.rho * k.g) }
      }
    },
    {
      id: 'fluids-03',
      category: 'fluids',
      name: 'Density',
      equation: 'ρ = m / V',
      statement: 'Density equals mass divided by volume.',
      notes: 'Water has a density of 1000 kg/m³ (1 g/cm³).',
      variables: [
        V('rho', 'ρ', 'density', 'density'),
        V('m', 'm', 'mass', 'mass'),
        V('V', 'V', 'volume', 'volume')
      ],
      solveFor: {
        rho: { rearranged: 'ρ = m / V', fn: (k) => k.m / k.V },
        m:   { rearranged: 'm = ρ·V', fn: (k) => k.rho * k.V },
        V:   { rearranged: 'V = m / ρ', fn: (k) => k.m / k.rho }
      }
    },
    {
      id: 'fluids-04',
      category: 'fluids',
      name: 'Buoyant force',
      equation: 'F_b = ρ·V·g',
      statement: 'Buoyant force equals fluid density times displaced volume times gravitational acceleration.',
      notes: "Archimedes' principle; V is the volume of fluid displaced (the submerged volume).",
      variables: [
        V('Fb', 'F_b', 'buoyant force', 'force'),
        V('rho', 'ρ', 'density of the fluid', 'density'),
        V('V', 'V', 'displaced volume', 'volume'),
        V('g', 'g', 'gravitational acceleration', 'acceleration')
      ],
      solveFor: {
        Fb:  { rearranged: 'F_b = ρ·V·g', fn: (k) => k.rho * k.V * k.g },
        rho: { rearranged: 'ρ = F_b / (V·g)', fn: (k) => k.Fb / (k.V * k.g) },
        V:   { rearranged: 'V = F_b / (ρ·g)', fn: (k) => k.Fb / (k.rho * k.g) },
        g:   { rearranged: 'g = F_b / (ρ·V)', fn: (k) => k.Fb / (k.rho * k.V) }
      }
    },

    // ---------------- thermal ----------------
    {
      id: 'thermal-01',
      category: 'thermal',
      name: 'Heat for a temperature change',
      equation: 'Q = m·c·ΔT',
      statement: 'Heat equals mass times specific heat capacity times the temperature change.',
      notes: 'ΔT is a temperature change, so it is the same number in K and °C (convert °F intervals first); for water c = 4186 J/(kg·K).',
      variables: [
        V('Q', 'Q', 'heat added or removed', 'energy'),
        V('m', 'm', 'mass', 'mass'),
        V('c', 'c', 'specific heat capacity', 'specific-heat'),
        V('dT', 'ΔT', 'temperature change', 'temperature-interval')
      ],
      solveFor: {
        Q:  { rearranged: 'Q = m·c·ΔT', fn: (k) => k.m * k.c * k.dT },
        m:  { rearranged: 'm = Q / (c·ΔT)', fn: (k) => k.Q / (k.c * k.dT) },
        c:  { rearranged: 'c = Q / (m·ΔT)', fn: (k) => k.Q / (k.m * k.dT) },
        dT: { rearranged: 'ΔT = Q / (m·c)', fn: (k) => k.Q / (k.m * k.c) }
      }
    },
    {
      id: 'thermal-02',
      category: 'thermal',
      name: 'Heat for a phase change',
      equation: 'Q = m·L_f',
      statement: 'Heat for a phase change equals mass times latent heat.',
      notes: 'The temperature stays constant during a phase change; for water freezing L_f = 3.34 × 10⁵ J/kg.',
      variables: [
        V('Q', 'Q', 'heat added or removed', 'energy'),
        V('m', 'm', 'mass', 'mass'),
        V('Lf', 'L_f', 'latent heat (fusion or vaporization)', 'latent-heat')
      ],
      solveFor: {
        Q:  { rearranged: 'Q = m·L_f', fn: (k) => k.m * k.Lf },
        m:  { rearranged: 'm = Q / L_f', fn: (k) => k.Q / k.Lf },
        Lf: { rearranged: 'L_f = Q / m', fn: (k) => k.Q / k.m }
      }
    },
    {
      id: 'thermal-03',
      category: 'thermal',
      name: 'Linear thermal expansion',
      equation: 'ΔL = α·L₀·ΔT',
      statement: 'Change in length equals the expansion coefficient times the original length times the temperature change.',
      notes: 'Valid for small expansions; α depends on the material (aluminum ≈ 2.4 × 10⁻⁵ 1/K).',
      variables: [
        V('dL', 'ΔL', 'change in length', 'length'),
        V('alpha', 'α', 'coefficient of linear expansion', 'thermal-expansivity'),
        V('L0', 'L₀', 'original length', 'length'),
        V('dT', 'ΔT', 'temperature change', 'temperature-interval')
      ],
      solveFor: {
        dL:    { rearranged: 'ΔL = α·L₀·ΔT', fn: (k) => k.alpha * k.L0 * k.dT },
        alpha: { rearranged: 'α = ΔL / (L₀·ΔT)', fn: (k) => k.dL / (k.L0 * k.dT) },
        L0:    { rearranged: 'L₀ = ΔL / (α·ΔT)', fn: (k) => k.dL / (k.alpha * k.dT) },
        dT:    { rearranged: 'ΔT = ΔL / (α·L₀)', fn: (k) => k.dL / (k.alpha * k.L0) }
      }
    },
    {
      id: 'thermal-04',
      category: 'thermal',
      name: 'Ideal gas law',
      equation: 'P·V = n·R·T',
      statement: 'Pressure times volume equals the number of moles times the gas constant times absolute temperature.',
      notes: 'R = 8.314 J/(mol·K); T must be an absolute temperature in kelvin.',
      variables: [
        V('P', 'P', 'pressure', 'pressure'),
        V('V', 'V', 'volume', 'volume'),
        V('n', 'n', 'number of moles', 'amount'),
        V('T', 'T', 'absolute temperature', 'temperature')
      ],
      solveFor: {
        P: { rearranged: 'P = n·R·T / V', fn: (k) => k.n * R_GAS * k.T / k.V },
        V: { rearranged: 'V = n·R·T / P', fn: (k) => k.n * R_GAS * k.T / k.P },
        n: { rearranged: 'n = P·V / (R·T)', fn: (k) => k.P * k.V / (R_GAS * k.T) },
        T: { rearranged: 'T = P·V / (n·R)', fn: (k) => k.P * k.V / (k.n * R_GAS) }
      }
    },
    {
      id: 'thermal-05',
      category: 'thermal',
      name: 'Photon energy',
      equation: 'E = h·f',
      statement: "Photon energy equals Planck's constant times frequency.",
      notes: 'h = 6.626 × 10⁻³⁴ J·s is Planck\'s constant.',
      variables: [
        V('E', 'E', 'energy of the photon', 'energy'),
        V('f', 'f', 'frequency of the light', 'frequency')
      ],
      solveFor: {
        E: { rearranged: 'E = h·f', fn: (k) => H_PLANCK * k.f },
        f: { rearranged: 'f = E / h', fn: (k) => k.E / H_PLANCK }
      }
    },
    {
      id: 'thermal-06',
      category: 'thermal',
      name: 'Mass-energy equivalence',
      equation: 'E = m·c²',
      statement: 'Energy equals mass times the speed of light squared.',
      notes: 'c = 2.998 × 10⁸ m/s; a tiny mass corresponds to an enormous energy.',
      variables: [
        V('E', 'E', 'energy released', 'energy'),
        V('m', 'm', 'mass converted', 'mass')
      ],
      solveFor: {
        E: { rearranged: 'E = m·c²', fn: (k) => k.m * C_LIGHT * C_LIGHT },
        m: { rearranged: 'm = E / c²', fn: (k) => k.E / (C_LIGHT * C_LIGHT) }
      }
    },
    {
      id: 'thermal-07',
      category: 'thermal',
      name: 'De Broglie wavelength',
      equation: 'λ = h / (m·v)',
      statement: "The de Broglie wavelength equals Planck's constant divided by the momentum m·v.",
      notes: 'h = 6.626 × 10⁻³⁴ J·s; the wavelength shrinks as the particle moves faster.',
      variables: [
        V('lambda', 'λ', 'de Broglie wavelength', 'length'),
        V('m', 'm', 'mass of the particle', 'mass'),
        V('v', 'v', 'speed of the particle', 'velocity')
      ],
      solveFor: {
        lambda: { rearranged: 'λ = h / (m·v)', fn: (k) => H_PLANCK / (k.m * k.v) },
        m:      { rearranged: 'm = h / (λ·v)', fn: (k) => H_PLANCK / (k.lambda * k.v) },
        v:      { rearranged: 'v = h / (λ·m)', fn: (k) => H_PLANCK / (k.lambda * k.m) }
      }
    }
  ];

  // ------------------------------------------------------------------
  // Public API (exact names per §FORMULAS, SPEC.md)
  // ------------------------------------------------------------------
  function list() {
    return FORMULAS.slice();
  }

  function byId(id) {
    for (let i = 0; i < FORMULAS.length; i++) {
      if (FORMULAS[i].id === id) { return FORMULAS[i]; }
    }
    return undefined;
  }

  function byCategory(catId) {
    const out = [];
    for (let i = 0; i < FORMULAS.length; i++) {
      if (FORMULAS[i].category === catId) { out.push(FORMULAS[i]); }
    }
    return out;
  }

  const DIM_INDEX = {};
  DIMENSION_ORDER.forEach((d, i) => { DIM_INDEX[d] = i; });

  // One entry per unique (symbol, dimension) pair across the database.
  // commonUnits are merged (union, first-seen order) for repeated pairs.
  // Sorted by canonical dimension order, then symbol.
  function allSymbols() {
    const byPair = Object.create(null);
    const out = [];
    FORMULAS.forEach((f) => {
      f.variables.forEach((v) => {
        const key = v.symbol + '|' + v.dimension;
        const seen = byPair[key];
        if (!seen) {
          const entry = {
            symbol: v.symbol,
            description: v.description,
            dimension: v.dimension,
            siUnit: v.siUnit,
            commonUnits: v.commonUnits.slice()
          };
          byPair[key] = entry;
          out.push(entry);
        } else {
          v.commonUnits.forEach((u) => {
            if (seen.commonUnits.indexOf(u) === -1) { seen.commonUnits.push(u); }
          });
        }
      });
    });
    out.sort((a, b) => {
      const da = DIM_INDEX[a.dimension];
      const db = DIM_INDEX[b.dimension];
      if (da !== db) { return da - db; }
      if (a.symbol < b.symbol) { return -1; }
      if (a.symbol > b.symbol) { return 1; }
      return 0;
    });
    return out;
  }

  return {
    categories: CATEGORIES,
    list: list,
    byId: byId,
    byCategory: byCategory,
    allSymbols: allSymbols
  };
});