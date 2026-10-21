# 🔥 Formula for Success — Physics Problem Solver

**A six-step wizard that teaches physics students how to *think through* a problem — not just how to punch numbers into one.**

Try it live: **https://physics-formula-finder.vercel.app**

Most physics tools hand you an answer. This one walks you through the **Formula for Success** — the study method that turns a scary word problem into six small, doable moves:

1. **Read the problem** — paste it in (or load a worked example)
2. **List the variables** — every quantity you can find, with its value and units
3. **Select the formula** — from a curated list of 56, with live suggestions showing what each one would solve for
4. **Convert the units** — watch 72 km/h become 20 m/s before your eyes
5. **Substitute** — the rearranged equation with your numbers in place
6. **Solve** — the missing variable, with the correct units and every step of the work shown

## What makes it special

- **56 curated formulas across 10 categories** — kinematics, forces, work/energy/power, momentum, circular motion & gravitation, waves, optics, electricity, fluids & pressure, thermal & modern — and *any* variable can be the missing one. Every formula is pre-solved for every symbol it contains (183 rearrangements), so the app can solve for whatever your problem leaves out.
- **A seriously detailed units engine** — 31 physical dimensions, 100+ units with exact conversion factors, absolute-temperature offsets *and* temperature intervals, standard-gravity `g`, and aliases like `kph`, `uF`, `ohm`, `degC`. The unit dropdown adapts to the variable you pick.
- **A solver that shows its work** — Formula → Rearranged → Convert units → Substitute → Compute → Result. Copy the whole trail into your homework the honest way, or print it (the page prints as one clean worked solution).
- **Smart formula suggestions** — list your variables and the finder instantly shows which formulas are ready to use ("Solves for t: v = v₀ + a·t") and which are one value away ("Add Δx, t to use Δx = v₀·t + ½·a·t²").
- **Student-friendly errors** — a kilogram in a velocity slot gets a gentle explanation, not a stack trace.
- **Zero dependencies, works offline** — one HTML page, four small JavaScript modules, no build step, no frameworks, no CDN. Open `index.html` straight from disk if you like.

## A worked example, straight from the app

> *A car is traveling at 72 km/h when the driver brakes, decelerating at 5.0 m/s². How long does it take to come to a stop?*

```
Formula:        v = v₀ + a·t
Rearranged:     t = (v - v₀) / a
Convert units:  v₀: 72 km/h → 20 m/s
Substitute:     v = 0 m/s; v₀ = 20 m/s; a = -5 m/s²  →  ? = (0 - 20) / (-5)
Compute:        t = 4 s
Result:         t = 4 s (time)
```

Three worked examples ship built-in: the braking car above, a ball dropped from a 45 m roof, and a resistor dropping 50 mA through 2.2 kΩ (that one shows off mA → A and kΩ → Ω conversions).

## Run it

- **Use it:** open `index.html` in any browser — no server, no install. Or visit the [live site](https://physics-formula-finder.vercel.app).
- **Test it:** `npm test` — 128 checks across five suites: units, formulas, solver, finder, and an integration suite that round-trips **every formula × every target variable** through the real units engine.

## How it works

| Module | Job |
|---|---|
| `js/units.js` | The detailed units engine: 31 dimensions, exact factors, temperature offsets vs. intervals, aliases, significant-figure formatting |
| `js/formulas.js` | The curated database: 56 formulas, 81 unique variable entries, a pre-solved rearrangement for every variable |
| `js/solver.js` | Dimension-aware step-by-step solver: validates units, converts to SI, substitutes, computes, and writes the worked steps |
| `js/finder.js` | Pure matcher: turns your variable list into exact and "almost there" formula suggestions |
| `js/app.js` | Wires it all to the six-step wizard UI |

Everything is plain ES2020 with a tiny UMD wrapper — the same files run in the browser as `<script>` tags and in Node's built-in test runner. No build step, ever.

## Built for physics students

Read the problem. List the variables. Pick the formula. Convert the units. Substitute. Solve. That's the whole game — this app just makes the moves visible.