# physics-formula-finder — Build Specification & API Contracts

A static, single-page HTML app that walks physics students through the
**Formula for Success** study method:

1. **Read** the physics problem
2. **List** every variable you can find, with values and units
3. **Select** the correct formula from a curated list
4. **Convert** the knowns to appropriate (SI) units
5. **Substitute** the known values into the formula
6. **Solve** for the missing variable, with correct units

No build step. No frameworks. No npm dependencies (tests use Node's
built-in `node:test`, Node v22). Plain ES2020 JavaScript with the UMD-lite
pattern below. Served statically (Vercel); must also work from `file://`.

## Repository layout & file ownership (HARD RULE)

| File | Owner |
|---|---|
| `js/units.js`, `tests/units.test.js` | Builder A (units) |
| `js/formulas.js`, `tests/formulas.test.js` | Builder B (formulas) |
| `js/solver.js`, `tests/solver.test.js` | Builder C (solver) |
| `js/finder.js`, `tests/finder.test.js` | Builder D (finder) |
| `index.html`, `css/style.css` | Builder E (UI shell) |
| `js/app.js`, `package.json`, `README.md`, `tests/integration.test.js`, `.gitignore` | Parent (built after builders finish) |

Each builder creates/edits ONLY their own files. Never run git. Never touch
another builder's file, even to "fix" it — report issues instead. Builders'
tests must pass WITHOUT sibling files existing (use the schemas below and
mocks). The parent runs cross-module integration tests after the wave.

## Module pattern (UMD-lite) — use EXACTLY this shape

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsUnits = api; }   // ← this module's global name
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  // ... implementation ...
  return { /* public API */ };
});
```

Global names (browser): `PhysicsUnits`, `PhysicsFormulas`, `PhysicsFinder`,
and `PhysicsSolverFactory`. Script order in `index.html` (Builder E includes
all five tags, even though `js/app.js` is written later by the parent):
`js/units.js` → `js/formulas.js` → `js/solver.js` → `js/finder.js` → `js/app.js`.

`solver.js` is a FACTORY (units engine injected, so tests can pass a mock):

```js
(function (root, factory) {
  const api = { create: factory };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsSolverFactory = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (units) {
  'use strict';
  // units: the PhysicsUnits API (toSI, dimensionOf, formatValue, listUnits, ...)
  return { solve: solve /*, ... */ };
});
```

Parent's app.js will wire: `const PhysicsSolver = PhysicsSolverFactory.create(PhysicsUnits);`

## Text conventions (all builders)

- Variable symbol KEYS are ASCII: `v`, `v0`, `a`, `t`, `dx`, `theta`, `mu`,
  `rho`, `lambda`, `m1`, `m2`, `KE`, `PEs`, `dT`, ...
- DISPLAY forms use Unicode: `v₀`, `θ`, `μ`, `ρ`, `λ`, `m₁`, `PE_s`, `ΔT`.
- Multiplication dot: `·`. Division: `/`. Subtraction: ASCII `-` (never U+2212).
- Superscripts: `² ³`. Degrees: `°`. Ohm: `Ω`. Micro: `μ`. Middle dot `·`.
- Every equation/rearranged string must contain each variable's display form
  as a clean token, because the solver substitutes numbers by
  longest-display-first string replacement (e.g. replace `v₀` before `v`).
  Within one formula, display tokens are unique — the inventory below
  guarantees this.
- Files are UTF-8.

## Dimensions (canonical keys, used everywhere)

`length, time, mass, velocity, acceleration, force, energy, power, momentum,
pressure, temperature, temperature-interval, charge, current, voltage,
resistance, capacitance, frequency, angle, area, volume, density, amount,
dimensionless, spring-constant, linear-density, intensity, resistivity,
specific-heat, latent-heat, thermal-expansivity`

## §UNITS — `js/units.js` (Builder A) — global `PhysicsUnits`

Unit record: `{ symbol, name, mul, add }` with conversions
`si = (v + add) * mul` and inverse `v = si / mul - add`. Ordinary units have
`add = 0`. Temperature uses offsets: `°C` = {mul:1, add:273.15},
`°F` = {mul:5/9, add:459.67}. Temperature-INTERVAL units have no offsets:
`°C` = {mul:1}, `°F` = {mul:5/9}. Check: 32 °F → (32+459.67)*5/9 = 273.15 K;
100 °C → 373.15 K; 212 °F → 373.15 K. Interval: 180 Δ°F = 100 Δ°C? No —
180 Δ°F × 5/9 = 100 K ✓.

Register EXACTLY these units (SI first in each list — dropdown order):

| dimension | units (symbol = factor to SI) |
|---|---|
| length | m=1, km=1000, cm=0.01, mm=0.001, μm=1e-6, mi=1609.344, yd=0.9144, ft=0.3048, in=0.0254 |
| time | s=1, ms=0.001, μs=1e-6, min=60, hr=3600, day=86400 |
| mass | kg=1, g=0.001, mg=1e-6, t=1000, lb=0.45359237 |
| velocity | m/s=1, km/h=1000/3600, mph=0.44704, ft/s=0.3048, cm/s=0.01 |
| acceleration | m/s^2=1, ft/s^2=0.3048, g=9.80665 (standard gravity) |
| force | N=1, kN=1000, mN=0.001, dyn=1e-5, lbf=4.4482216152605 |
| energy | J=1, kJ=1000, cal=4.184, kcal=4184, eV=1.602176634e-19, kWh=3.6e6 |
| power | W=1, kW=1000, MW=1e6, hp=745.699872 |
| momentum | kg*m/s=1 |
| pressure | Pa=1, kPa=1000, MPa=1e6, bar=1e5, atm=101325, psi=6894.757293168, mmHg=133.32239, torr=101325/760 |
| temperature | K=1, °C={mul:1, add:273.15}, °F={mul:5/9, add:459.67} |
| temperature-interval | K=1, °C=1, °F=5/9 (NO offsets) |
| charge | C=1, mC=0.001, μC=1e-6, nC=1e-9 |
| current | A=1, mA=0.001, μA=1e-6 |
| voltage | V=1, mV=0.001, kV=1000 |
| resistance | Ω=1, mΩ=0.001, kΩ=1000, MΩ=1e6 |
| capacitance | F=1, mF=0.001, μF=1e-6, nF=1e-9, pF=1e-12 |
| frequency | Hz=1, kHz=1000, MHz=1e6, GHz=1e9 |
| angle | rad=1, °=Math.PI/180 |
| area | m²=1, cm²=1e-4, ft²=0.09290304, in²=0.00064516 |
| volume | m³=1, L=0.001, mL=1e-6, cm³=1e-6, gal=0.003785411784 |
| density | kg/m³=1, g/cm³=1000 |
| amount | mol=1, kmol=1000, mmol=0.001 |
| dimensionless | ''=1 (empty symbol; display as "dimensionless" in UIs) |
| spring-constant | N/m=1 |
| linear-density | kg/m=1 |
| intensity | W/m²=1 |
| resistivity | Ω·m=1 (symbol string: `Ω*m`) |
| specific-heat | J/(kg·K)=1 (symbol string: `J/(kg·K)`) |
| latent-heat | J/kg=1, kcal/kg=4184 |
| thermal-expansivity | 1/K=1 |

Physical constants live in the formula layer, not here:
G=6.674e-11, c=2.998e8, h=6.626e-34, ke=8.988e9, Rgas=8.314.

### Public API (exact names)

- `toSI(value, unitSymbol) -> number` — throws `Error` (with `.name === 'UnitError'`)
  if the symbol is unknown.
- `fromSI(value, unitSymbol) -> number` — same error behavior.
- `convert(value, fromSymbol, toSymbol) -> number` — throws `UnitError` if the
  two symbols belong to different dimensions, with message
  `"Cannot convert <from> (<dimFrom>) to <to> (<dimTo>)"`.
- `dimensionOf(unitSymbol) -> dimension key | null` — accepts aliases.
- `listUnits(dimension) -> [{symbol, name}]` — SI first, as registered above;
  throws `UnitError` for unknown dimension.
- `allUnitSymbols() -> { [unitSymbol]: dimension }` — canonical symbols only.
- `normalize(unitSymbol) -> canonical symbol` — resolves aliases (case-sensitive
  first, then case-insensitive fallback). Required alias map (minimum):
  `kph, kmh → km/h`; `m/s2, ms2 → m/s^2`; `ohm → Ω`; `kohm → kΩ`; `Mohm → MΩ`;
  `uF → μF`; `uC → μC`; `uA → μA`; `um → μm`; `us → μs`; `degC, celsius → °C`;
  `degF, fahrenheit → °F`; `deg, degrees → °`; `sec, secs → s`;
  `meter, meters → m`; `foot, feet → ft`; `inch, inches → in`; `mile, miles → mi`;
  `gram, grams → g`; `pound, pounds → lb`; `hour, hours → hr`;
  `radian, radians → rad`; `mole → mol`. Unknown input throws `UnitError`.
- `formatValue(value, sigFigs = 4) -> string`:
  - `0` → `'0'`; integers in range → `'26'`.
  - Round to sigFigs significant digits, strip trailing zeros (`9.810` → `'9.81'`).
  - If `|v| >= 1e5` or (`|v| < 1e-3` and `v !== 0`) → scientific:
    `'2.998 × 10^8'`, `'1.602 × 10^-19'` (mantissa has sigFigs sig figs).
  - Negative → leading `-`.
- `isTemperature(dimension) -> boolean` (true for `temperature`).

Tests must cover: every unit round-trips `fromSI(toSI(x, u), u) ≈ x` (relative
1e-12); temperature offsets (0 °C = 273.15 K, 212 °F = 373.15 K, −40 °F =
233.15 K); intervals (100 Δ°C = 180 Δ°F = 100 K); 72 km/h → 20 m/s; aliases;
dimension-mismatch throw; formatValue cases; every API function.

## §FORMULAS — `js/formulas.js` (Builder B) — global `PhysicsFormulas`

### Formula object schema (EXACT)

```js
{
  id: 'kinematics-01',            // stable, unique, from inventory below
  category: 'kinematics',         // one of the 10 category ids
  name: 'Velocity with constant acceleration',
  equation: 'v = v₀ + a·t',       // display form (Unicode)
  statement: 'Final velocity equals initial velocity plus acceleration times time.',
  notes: 'Valid only for constant acceleration.',   // student-friendly, 1 sentence
  variables: [
    { symbol: 'v',  display: 'v',  description: 'final velocity',   dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h', 'mph', 'ft/s'] },
    { symbol: 'v0', display: 'v₀', description: 'initial velocity', dimension: 'velocity',     siUnit: 'm/s',   commonUnits: ['km/h', 'mph', 'ft/s'] },
    { symbol: 'a',  display: 'a',  description: 'acceleration',     dimension: 'acceleration', siUnit: 'm/s^2', commonUnits: ['ft/s^2'] },
    { symbol: 't',  display: 't',  description: 'elapsed time',     dimension: 'time',         siUnit: 's',     commonUnits: ['min', 'hr'] }
  ],
  solveFor: {
    v:  { rearranged: 'v = v₀ + a·t',      fn: (k) => k.v0 + k.a * k.t },
    v0: { rearranged: 'v₀ = v - a·t',      fn: (k) => k.v - k.a * k.t },
    a:  { rearranged: 'a = (v - v₀) / t',  fn: (k) => (k.v - k.v0) / k.t },
    t:  { rearranged: 't = (v - v₀) / a',  fn: (k) => (k.v - k.v0) / k.a }
  }
}
```

Rules:
- EVERY variable in `variables` MUST have a `solveFor` entry — any variable
  can be the missing one. `fn` takes an object of SI values keyed by symbol
  (all OTHER variables) and returns the target's SI value.
- Constants are embedded in `fn` with the values given in the inventory, and
  mentioned in `notes` (e.g. "G = 6.674 × 10⁻¹¹ N·m²/kg²").
- `commonUnits` lists units from the §UNITS table that share the variable's
  dimension. `siUnit` MUST be the SI unit string from §UNITS.
- Square roots: `v = √(...)` — take the positive root; say so in `notes`
  when sign matters (e.g. "positive root; direction handled by the sign of inputs").
- `rearranged` strings: target display on the left, ASCII `-` for minus.

### Categories (id → display name, in this order)

`kinematics` → Kinematics; `forces` → Forces & Newton's Laws;
`energy` → Work, Energy & Power; `momentum` → Momentum & Impulse;
`circular` → Circular Motion & Gravitation; `waves` → Waves & Sound;
`optics` → Optics; `electricity` → Electricity & Circuits;
`fluids` → Fluids & Pressure; `thermal` → Thermal & Modern Physics.

### Public API (exact names)

- `categories -> [{id, name}]` (property, in the order above)
- `list() -> [formula]` (all, in inventory order)
- `byId(id) -> formula | undefined`
- `byCategory(catId) -> [formula]`
- `allSymbols() -> [{symbol, description, dimension, siUnit, commonUnits}]`
  — one entry per unique (symbol, dimension) pair across the whole database
  (e.g. `T` appears twice: as time and as temperature; `V` as voltage and as
  volume; `Q` as charge and as heat). Merge `commonUnits` for repeated pairs.
  Sorted by dimension order, then symbol.

### Formula inventory — implement ALL 56, with these exact ids and equations

Format: `id — equation — variables (symbol:dimension)`. For each variable
write a clear student-facing `description` and sensible `commonUnits`.
`Δ` variables use prefix `d`; every displayed token is unique per formula.

**kinematics**
1. `kinematics-01` — `v = v₀ + a·t` — v:velocity, v0:velocity, a:acceleration, t:time
2. `kinematics-02` — `Δx = v₀·t + ½·a·t²` — dx:length, v0:velocity, a:acceleration, t:time
3. `kinematics-03` — `v² = v₀² + 2·a·Δx` — v:velocity, v0:velocity, a:acceleration, dx:length (v = positive root)
4. `kinematics-04` — `Δx = ½·(v₀ + v)·t` — dx:length, v0:velocity, v:velocity, t:time
5. `kinematics-05` — `v_avg = Δx / t` — vavg:velocity, dx:length, t:time (display v_avg)
6. `kinematics-06` — `Δx = v·t` — dx:length, v:velocity, t:time

**forces**
7. `forces-01` — `F = m·a` — F:force, m:mass, a:acceleration
8. `forces-02` — `W = m·g` — W:force (weight), m:mass, g:acceleration
9. `forces-03` — `f = μ·N` — f:force (friction), mu:dimensionless (coefficient), N:force (normal)
10. `forces-04` — `F = k·Δx` — F:force, k:spring-constant, dx:length

**energy**
11. `energy-01` — `W = F·d·cos θ` — W:energy (work), F:force, d:length, theta:angle
12. `energy-02` — `KE = ½·m·v²` — KE:energy, m:mass, v:velocity
13. `energy-03` — `PE = m·g·h` — PE:energy, m:mass, g:acceleration, h:length
14. `energy-04` — `PE_s = ½·k·Δx²` — PEs:energy, k:spring-constant, dx:length (display PE_s)
15. `energy-05` — `P = W / t` — P:power, W:energy (work), t:time
16. `energy-06` — `P = F·v` — P:power, F:force, v:velocity
17. `energy-07` — `½·m·v₁² + m·g·h₁ = ½·m·v₂² + m·g·h₂` — m:mass, v1:velocity, h1:length, v2:velocity, h2:length, g:acceleration (conservation of mechanical energy)

**momentum**
18. `momentum-01` — `p = m·v` — p:momentum, m:mass, v:velocity
19. `momentum-02` — `J = F·Δt` — J:momentum (impulse), F:force, dt:time (display Δt)
20. `momentum-03` — `J = m·Δv` — J:momentum, m:mass, dv:velocity (display Δv)

**circular**
21. `circular-01` — `v = 2·π·r / T` — v:velocity, r:length, T:time (period)
22. `circular-02` — `a_c = v² / r` — ac:acceleration, v:velocity, r:length (display a_c)
23. `circular-03` — `F_c = m·v² / r` — Fc:force, m:mass, v:velocity, r:length (display F_c)
24. `circular-04` — `F_g = G·m₁·m₂ / r²` — Fg:force, m1:mass, m2:mass, r:length; G=6.674e-11 (display F_g)
25. `circular-05` — `g = G·M / r²` — g:acceleration, M:mass (planet), r:length; G=6.674e-11
26. `circular-06` — `v = √(G·M / r)` — v:velocity, M:mass, r:length; G=6.674e-11
27. `circular-07` — `T² = 4·π²·r³ / (G·M)` — T:time, r:length, M:mass; G=6.674e-11

**waves**
28. `waves-01` — `v = f·λ` — v:velocity (wave speed), f:frequency, lambda:length (wavelength, display λ)
29. `waves-02` — `T = 1 / f` — T:time (period), f:frequency
30. `waves-03` — `f_b = |f₁ - f₂|` — fbeat:frequency, f1:frequency, f2:frequency (display f_b; fn: fbeat = |f1-f2|; solving f1 → f2 + fbeat, solving f2 → f1 - fbeat when f1 ≥ f2 — document the convention in notes)
31. `waves-04` — `v = √(F_T / μ)` — v:velocity, FT:force (tension, display F_T), muL:linear-density (display μ)
32. `waves-05` — `I = P / A` — I:intensity, P:power, A:area

**optics**
33. `optics-01` — `1/f = 1/d_o + 1/d_i` — f:length (focal), do:length (object), di:length (image)
34. `optics-02` — `m = -d_i / d_o` — m:dimensionless (magnification), di:length, do:length
35. `optics-03` — `m = h_i / h_o` — m:dimensionless, hi:length (image height), ho:length (object height)
36. `optics-04` — `n = c / v` — n:dimensionless (index), v:velocity (light in medium); c=2.998e8
37. `optics-05` — `n₁·sin θ₁ = n₂·sin θ₂` — n1:dimensionless, theta1:angle (display θ₁), n2:dimensionless, theta2:angle (display θ₂); fn uses radians (SI); solving for an angle: θ = asin(...)

**electricity**
38. `electricity-01` — `V = I·R` — V:voltage, I:current, R:resistance
39. `electricity-02` — `P = V·I` — P:power, V:voltage, I:current
40. `electricity-03` — `P = I²·R` — P:power, I:current, R:resistance
41. `electricity-04` — `P = V² / R` — P:power, V:voltage, R:resistance
42. `electricity-05` — `Q = I·t` — Q:charge, I:current, t:time
43. `electricity-06` — `R = ρ·L / A` — R:resistance, rho:resistivity (display ρ), L:length, A:area
44. `electricity-07` — `F = k_e·q₁·q₂ / r²` — F:force, q1:charge, q2:charge, r:length; ke=8.988e9 (equation shows `F = k_e·q₁·q₂ / r²`)
45. `electricity-08` — `C = Q / V` — C:capacitance, Q:charge, V:voltage

**fluids**
46. `fluids-01` — `P = F / A` — P:pressure, F:force, A:area
47. `fluids-02` — `P = ρ·g·h` — P:pressure, rho:density, g:acceleration, h:length
48. `fluids-03` — `ρ = m / V` — rho:density, m:mass, V:volume
49. `fluids-04` — `F_b = ρ·V·g` — Fb:force (buoyant), rho:density, V:volume, g:acceleration (display F_b)

**thermal**
50. `thermal-01` — `Q = m·c·ΔT` — Q:energy (heat), m:mass, c:specific-heat, dT:temperature-interval (display ΔT)
51. `thermal-02` — `Q = m·L_f` — Q:energy, m:mass, Lf:latent-heat (display L_f)
52. `thermal-03` — `ΔL = α·L₀·ΔT` — dL:length (expansion, display ΔL), alpha:thermal-expansivity (display α), L0:length (original, display L₀), dT:temperature-interval (display ΔT)
53. `thermal-04` — `P·V = n·R·T` — P:pressure, V:volume, n:amount, T:temperature; Rgas=8.314
54. `thermal-05` — `E = h·f` — E:energy (photon), f:frequency; h=6.626e-34
55. `thermal-06` — `E = m·c²` — E:energy, m:mass; c=2.998e8
56. `thermal-07` — `λ = h / (m·v)` — lambda:length, m:mass, v:velocity; h=6.626e-34

### Physics constants (embed in fn; mention in notes)

G=6.674e-11, c=2.998e8, h=6.626e-34, ke=8.988e9, Rgas=8.314.

Tests must cover: unique ids; 10 categories; every variable has a solveFor
entry; every solveFor key set === variable symbol set; siUnit/commonUnits
dimensions match the declared variable dimension (hardcode the dimension→unit
map in the test, do not import js/units.js); display tokens of all variables
appear in `equation`; numeric spot-checks with real physics values, e.g.
kinematics-01 (v0=10, a=2, t=3 → v=16); forces-01 (F=ma with m=2, a=9.81 →
19.62); energy-02 (m=2, v=3 → 9); optics-05 (n1=1, θ1=30°=0.5235988 rad,
n2=1.5 → sinθ2 = 1/3); thermal-04 (P=101325, V=0.001, n=0.04, T=298 →
P·V ≈ n·R·T within 1%); and a generic round-trip: for every formula, for
every variable x, build knowns from per-dimension sample values (pick your
own consistent samples; special-case beats with f1≠f2), solve for x, then
solve for a different variable y using x's result and verify y recovers its
sample within 1e-6 relative.

## §SOLVER — `js/solver.js` (Builder C) — global `PhysicsSolverFactory`

`create(units)` returns `{ solve }`. `units` is the PhysicsUnits API.
`units` may be a MOCK in tests — implement against this interface only:
`toSI, fromSI, dimensionOf, listUnits, formatValue, normalize`.

### `solve(formula, targetSymbol, knowns) -> result`

`knowns` = `{ symbol: { value: number|string, unit: string } }` for every
non-target variable. Missing `unit` defaults to that variable's `siUnit`.
Values that aren't finite numbers after `parseFloat` → error `invalid-value`.

Success:

```js
{
  ok: true,
  target: { symbol, display, dimension, unit: siUnit },
  steps: [
    { label: 'Formula',    text: 'v = v₀ + a·t' },
    { label: 'Rearranged', text: 'v = v₀ + a·t' },        // solveFor[target].rearranged
    { label: 'Convert units', text: 'v₀: 72 km/h → 20 m/s' },  // one line per converted known, joined with '; ' — or 'All known values are already in SI units.'
    { label: 'Substitute',  text: 'v₀ = 20 m/s; a = -5 m/s^2; t = 3 s  →  v = 20 + (-5)·3' },
    { label: 'Compute',     text: 'v = 5 m/s' },
    { label: 'Result',      text: 'v = 5 m/s (velocity)' }
  ],
  converted: { v0: { from: '72 km/h', to: '20 m/s', value: 20, unit: 'm/s' }, ... }, // every known, SI
  assignments: [ { symbol: 'v0', display: 'v₀', value: 20, unit: 'm/s' }, ... ],
  substituted: 'v = 20 + (-5)·3',   // rearranged equation, known displays replaced by formatValue(SI), target display replaced by '?'
  result: { symbol: 'v', display: 'v', value: 5, unit: 'm/s', dimension: 'velocity' },
  formatted: '5 m/s'                 // formatValue(value) + ' ' + unit (no trailing space for dimensionless '')
}
```

Substitution algorithm: take `solveFor[target].rearranged`; for each known
variable (sorted by display string length, longest first) replace ALL
occurrences of its display string with `formatValue(siValue)`; finally
replace the target's display string with `?`. Wrap numeric values longer
than the bare token in parentheses ONLY when they start with `-` (so
`a = -5` renders as `(-5)` inside products): produce `(-5)` for negative
values, bare otherwise.

Failure: `{ ok: false, error, message }` with student-friendly messages:

- `bad-target` — targetSymbol not among formula variables (or no solveFor entry)
- `missing` — a non-target variable has no entry in knowns; message lists ALL
  missing: `"Missing values for: t (elapsed time). Go back to Step 2 and add them."`
- `invalid-value` — `"The value for v₀ is not a number."`
- `dimension-mismatch` — check `units.dimensionOf(unit)` equals the
  variable's dimension (after `units.normalize`); message:
  `"The unit 'kg' entered for m (mass) doesn't fit — expected a mass unit."`
- `non-finite` — fn threw or returned non-finite (usually a zero denominator):
  `"The calculation didn't produce a finite number — a value may be zero in a denominator. Check your knowns."`

Wrap the whole body in try/catch; any unexpected throw becomes
`{ ok:false, error:'non-finite', message: <catch message> }`. If `knowns`
contains the target WITH a value, ignore it (note in steps is NOT required).
Steps order is exactly: Formula, Rearranged, Convert units, Substitute,
Compute, Result (6 steps).

Tests (mock units + mock formula objects matching the §FORMULAS schema;
DO NOT import sibling modules): happy path all-SI; mixed units through mock
toSI; every error path; steps order and content; substituted string with
negative values parenthesized; formatted dimensionless ('' unit) has no
trailing space; solve with unit aliases via mock normalize.

## §FINDER — `js/finder.js` (Builder D) — global `PhysicsFinder`

Pure functions. No DOM, no globals, no dependencies.

### `find(formulas, knownSymbols, opts = {}) -> { exact, partial }`

- `formulas`: array of formula objects (§FORMULAS schema).
- `knownSymbols`: array of variable symbol keys the student listed.
- `opts`: `{ category?: string, target?: string }` (both optional).
- For each formula, `unknown` = variables whose symbol is NOT in knownSymbols:
  - `unknown.length === 1` → exact match: `{ formula, solvedFor: unknown[0], missing: [] }`
  - `unknown.length === 2` or `3` → partial: `{ formula, solvedFor: unknown[0], missing: [symbols...] }`
  - `unknown.length === 0` → skip (already fully determined)
  - `unknown.length >= 4` → skip (too far from the student's knowns)
- `opts.target` filter: exact kept only if `solvedFor === target`; partial
  kept only if `missing` includes target. `opts.category` filter: formula
  category must equal it.
- Sort exact by category order (as given by the formulas' category order of
  first appearance in the array... simpler: stable sort by category name is
  NOT required — sort exact/partial by: fewest unknowns first, then original
  array order). Keep it stable and deterministic.
- No formula appears in both lists; a formula appears at most once overall.

Also export `describeMatch(match) -> string`: for exact
`"Solves for ${target.display}: ${formula.equation}"`; for partial
`"Add ${missing displays joined by ', '} to use ${formula.equation}"`.

Tests (mock formula objects; DO NOT import siblings): exact detection;
partial with 2 and 3 missing; skip 0 and 4+; target filter; category filter;
dedupe; ordering determinism; describeMatch strings; empty knowns (all
formulas partial with 2-3 vars, none with 4+... assert sensible behavior).

## §DOM — `index.html` + `css/style.css` (Builder E)

`index.html` — semantic, accessible, NO JavaScript. Include the five script
tags in the §Module-pattern order. Structure (ids are a hard contract with
the parent's `js/app.js`):

```
<header class="site-header">
  <h1>⚛️ Formula for Success</h1>
  <p class="tagline">Read the problem → list the variables → pick the formula
     → convert the units → substitute → solve for the missing variable.</p>
  <ol id="steps-strip"> 6 <li data-step="1..6">1. Read … 6. Solve</li> </ol>
</header>
<main>
  <section class="step active" id="step-1" data-step="1">   # Read
    <h2>Step 1 · Read the problem</h2>
    <label for="problem-text">Paste or type your physics problem:</label>
    <textarea id="problem-text" rows="5" placeholder="A car traveling at 72 km/h brakes at −5.0 m/s². How long until it stops?"></textarea>
    <label for="examples-select">Or load a worked example:</label>
    <select id="examples-select"></select>
    <button type="button" id="load-example">Load example</button>
  </section>
  <section class="step" id="step-2" data-step="2">           # List variables
    <h2>Step 2 · List the variables</h2>
    <p class="hint">Write down every variable you can find, with its value and units.</p>
    <table id="variables-table">
      <thead><tr><th>Variable</th><th>Value</th><th>Unit</th><th></th></tr></thead>
      <tbody id="variables-body"></tbody>
    </table>
    <button type="button" id="add-variable">+ Add variable</button>
    <div id="vars-summary" class="hint"></div>
  </section>
  <section class="step" id="step-3" data-step="3">           # Select formula
    <h2>Step 3 · Select the formula</h2>
    <div id="match-list"></div>
    <label for="formula-select">Curated formula list:</label>
    <select id="formula-select"></select>
    <div id="formula-info"></div>
    <label for="target-select">Solve for (the missing variable):</label>
    <select id="target-select"></select>
    <div id="target-note" class="hint"></div>
  </section>
  <section class="step" id="step-4" data-step="4">           # Convert
    <h2>Step 4 · Convert to SI units</h2>
    <div id="convert-preview"></div>
  </section>
  <section class="step" id="step-5" data-step="5">           # Substitute
    <h2>Step 5 · Substitute the known values</h2>
    <div id="substitute-preview"></div>
  </section>
  <section class="step" id="step-6" data-step="6">           # Solve
    <h2>Step 6 · Solve for the missing variable</h2>
    <div id="result-box"></div>
    <ol id="steps-list"></ol>
    <button type="button" id="start-over">Start over</button>
  </section>
  <nav class="wizard-nav">
    <button type="button" id="btn-prev">← Back</button>
    <button type="button" id="btn-next">Next →</button>
  </nav>
</main>
<footer>Built for physics students. 56 curated formulas · detailed units · worked steps.</footer>
```

- All `<select>`s and dynamic `<div>`s start EMPTY — the parent's app.js
  populates them. Give selects a visible `<label>` as shown.
- `class="step"` sections: only `.active` is displayed
  (`#step-1` has it initially). The steps strip highlights the active step
  via `[aria-current="step"]` styling — app.js sets that attribute.
- `css/style.css`: professional, clean, physics-education aesthetic
  (deep blue/teal accent on light background; system font stack —
  `ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif`; monospace for equations: `ui-monospace, SFMono-Regular, Menlo,
  monospace`). Responsive down to 360 px (single column, table scrolls
  horizontally). Visible `:focus-visible` outlines. Comfortable line length.
  Result box (`#result-box`) gets a celebratory but tasteful success style
  (class `answer` inside it is fine to anticipate:
  `.answer` = large, bold, accent-colored).
- `@media print`: show ALL six step sections (ignore `.active`), hide
  wizard-nav, header strip, buttons — so a student can print the worked
  solution.
- No external assets: no CDN, no web fonts, no images. Inline SVG data-URI
  favicon is allowed. `<meta name="viewport">`, `<meta name="description">`,
  `<html lang="en">`, `<title>Formula for Success — Physics Problem Solver</title>`.

No test file required for Builder E. Verify tag balance and id spelling
carefully; the parent render-tests the page in a real browser.

## §TESTS — all builders

- Runner: `node --test tests/<file>.test.js` from the repo root. Node v22.
- Use `const { test } = require('node:test'); const assert = require('node:assert');`
- A builder's tests must pass WITHOUT any sibling builder's files on disk.
- Tolerance: relative 1e-9 (use a helper `approx(a, b)` — absolute 1e-9 near zero).
- Every public API function gets at least one test; every error path too.
- Do not create files other than your owned files (no fixtures, no helpers
  outside your module).