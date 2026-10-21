# PROMPTS.md — physics-formula-finder build prompts

Five build prompts for the project. Prompts 1–4 (+ the UI-shell half of 5)
run as parallel builder subagents, each with exclusive file ownership;
Prompt 5's integration/ship half is executed by the parent after the wave.

## Prompt 1 — Curated formula database
Create `js/formulas.js` — a curated, student-facing database of 56 canonical
physics formulas in 10 categories (kinematics, forces, energy, momentum,
circular motion & gravitation, waves, optics, electricity, fluids & pressure,
thermal & modern). Each formula carries: a stable id, category, display
name, Unicode equation, plain-English statement, applicability notes, and a
variables table (ASCII symbol key, Unicode display, description, dimension,
SI unit, common alternate units). The heart of the requirement: for EVERY
variable, a pre-solved rearrangement — a human-readable rearranged equation
plus a numeric function on SI values — so any variable can be the missing
one. Export `list()`, `byId()`, `byCategory()`, `categories`, `allSymbols()`.
Tests in `tests/formulas.test.js` (node:test): structural completeness
(every variable solvable, unique ids, unit/dimension consistency, display
tokens present in equations), numeric spot-checks with real physics values,
and a solve-then-round-trip sweep over every formula × every variable.

## Prompt 2 — Detailed units & conversion engine
Create `js/units.js` — the detailed units layer. For each physical dimension
(length, time, mass, velocity, acceleration, force, energy, power, momentum,
pressure, temperature, temperature-interval, charge, current, voltage,
resistance, capacitance, frequency, angle, area, volume, density, amount,
dimensionless, spring-constant, linear-density, intensity, resistivity,
specific-heat, latent-heat, thermal-expansivity) register SI-first unit lists
with exact conversion factors — m/km/cm/mm/μm/mi/yd/ft/in; s/ms/μs/min/hr/day;
kg/g/mg/t/lb; m/s/km/h/mph/ft/s; m/s²/ft/s²/g; N/kN/dyn/lbf; J/kJ/cal/kcal/
eV/kWh; W/kW/MW/hp; Pa/atm/bar/psi/mmHg/torr; K/°C/°F with offset
conversions for absolute temperature and factor-only intervals; C/mC/μC/nC;
A/mA/μA; V/mV/kV; Ω/kΩ/MΩ; F/μF/pF; Hz/kHz/MHz/GHz; rad/°; m²/ft²; m³/L/mL/
gal; kg/m³/g/cm³; mol. Export `toSI()`, `fromSI()`, `convert()`,
`dimensionOf()`, `listUnits()` (dropdown-ready, SI first), `allUnitSymbols()`,
`normalize()` (aliases like kph→km/h, uF→μF, ohm→Ω, degC→°C), and
`formatValue()` with sensible significant figures and scientific notation.
Tests in `tests/units.test.js`: every unit round-trips, temperature offsets
(0 °C = 273.15 K, 212 °F = 373.15 K), 72 km/h → 20 m/s, dimension-mismatch
throws, formatting edge cases.

## Prompt 3 — Step-by-step missing-variable solver
Create `js/solver.js` — an injectable factory `create(units)` returning
`solve(formula, targetSymbol, knowns)` where knowns is
`{symbol: {value, unit}}`. The solver validates that each known's unit
matches the variable's dimension (student-friendly error if not), converts
every known to SI, selects the pre-solved rearrangement for the target, and
emits the full worked sequence as steps — Formula → Rearranged → Convert
units (e.g. "v₀: 72 km/h → 20 m/s") → Substitute (numbers in the rearranged
equation, `?` for the target) → Compute → Result with the correct SI unit and
dimension. Returns `{ok, steps, converted, assignments, substituted, result,
formatted}`; failures return `{ok: false, error, message}` with clear
student-friendly messages for missing values, invalid values, unit
mismatches, and zero-denominator blowups. Tests in `tests/solver.test.js`
with a mock units engine + mock formula objects (no sibling imports):
mixed-unit solves, every error path, step ordering, substitution string
generation, formatting.

## Prompt 4 — Formula finder
Create `js/finder.js` — a pure matcher that turns a student's variable list
into formula candidates. `find(formulas, knownSymbols, opts)` returns exact
matches (formulas whose variables are all covered by the knowns except
exactly one — reporting which variable gets solved) and partial matches
(needing 1–2 more values, reporting exactly what's missing: "add t and v₀
to use v = v₀ + a·t"). Supports `opts.category` and `opts.target`
("solve for v") filters; deterministic ordering; each formula appears at
most once. Tests in `tests/finder.test.js` with mock formula objects: exact
detection, partial ordering, filters, dedupe, skip rules.

## Prompt 5 — "Formula for Success" wizard UI + integration + ship
Create `index.html` + `css/style.css` implementing the six-step guided
wizard: Step 1 Read the problem (problem text box + three loadable worked
examples), Step 2 List the variables (add/remove table rows — symbol
dropdown drawn from the whole database, value field, unit dropdown that
adapts to the chosen symbol's dimension), Step 3 Select the formula (curated
dropdown grouped by category with equation + plain-English preview,
auto-suggestions from the finder showing what each candidate solves for,
and a "solve for" dropdown of the missing variables), Step 4 Convert (every
known shown converted into SI), Step 5 Substitute (rearranged equation with
values plugged in), Step 6 Solve (the answer with correct units plus the
complete worked steps; print-friendly stylesheet). Then integrate (parent):
`js/app.js` wires the four modules together, `package.json` exposes
`npm test`, `tests/integration.test.js` runs end-to-end problems through
finder + solver with the real modules plus a solve-every-formula round-trip
sweep, `README.md` documents the method with worked examples, commit,
push to GitHub `main`, deploy to Vercel, verify the live URL.

## Dependency table

| Prompt | Files | Depends on | Executor |
|---|---|---|---|
| 1 | js/formulas.js + test | SPEC schema only | Builder B (parallel) |
| 2 | js/units.js + test | SPEC unit tables only | Builder A (parallel) |
| 3 | js/solver.js + test | SPEC schemas (mock units/formulas) | Builder C (parallel) |
| 4 | js/finder.js + test | SPEC schema (mock formulas) | Builder D (parallel) |
| 5a | index.html, css/style.css | SPEC DOM contract | Builder E (parallel) |
| 5b | js/app.js, package.json, README.md, tests/integration.test.js, deploy | ALL of 1–5a | Parent (sequential) |

## Testing strategy

- Wave tests (per builder): `node --test tests/<file>.test.js`, isolated,
  mock-based where a builder depends on a sibling's schema.
- Integration (parent): `node --test tests/` — real modules wired together;
  end-to-end problems (braking car 72 km/h, mA/kΩ circuit, hydrostatics,
  Snell's law, specific heat) + a round-trip sweep over all 56 formulas ×
  every target variable + cross-module unit/dimension consistency audit.
- Render test (parent): serve the directory, drive the wizard in a real
  browser, verify the result box text, screenshot.
- Ship gate: all tests green → commit → push to GitHub main → Vercel prod
  deploy → curl the live URL.