/**
 * physics-formula-finder — js/finder.js (Builder D)
 * Formula finder / matcher. Browser global name: `PhysicsFinder`.
 *
 * Pure functions only: no DOM, no globals beyond the UMD global, no
 * dependencies. Consumes formula objects built to the §FORMULAS schema of
 * SPEC.md (never imports them).
 *
 * Public API (exact, per §FINDER of SPEC.md):
 *
 *   find(formulas, knownSymbols, opts = {}) -> { exact, partial }
 *     formulas:     array of §FORMULAS formula objects.
 *     knownSymbols: array of variable symbol keys the student listed.
 *     opts.category: keep only formulas whose `category` equals it.
 *     opts.target:   exact kept only if solvedFor === target;
 *                    partial kept only if `missing` includes target.
 *
 *     For each formula, unknown = variables whose symbol is NOT in
 *     knownSymbols (in `variables` order):
 *       1 unknown  -> exact  { formula, solvedFor: unknown[0], missing: [] }
 *       2 or 3     -> partial{ formula, solvedFor: unknown[0],
 *                              missing: [all unknown symbols] }
 *       0 unknowns -> skip (already fully determined)
 *       4+ unknowns-> skip (too far from the student's knowns)
 *
 *     Ordering is stable and deterministic: fewest unknowns first, then
 *     original array order. A formula never appears in both lists and at
 *     most once overall (duplicate entries in `formulas` — same object or
 *     same `id` — are collapsed to their first occurrence).
 *
 *   describeMatch(match) -> string
 *     exact:   "Solves for <display of solvedFor>: <equation>"
 *     partial: "Add <missing displays joined ', '> to use <equation>"
 *     Displays are resolved from formula.variables (raw symbol as
 *     fallback when data is malformed).
 *
 * Documented defensive behavior (supersets of the SPEC, which defines no
 * error paths for the finder): non-array `formulas` / `knownSymbols` are
 * treated as empty; `opts` may be null; malformed formula entries are
 * skipped; a missing/non-string display falls back to the raw symbol;
 * describeMatch throws TypeError when given no usable match/formula.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsFinder = api; }   // ← this module's global name
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function knownSet(knownSymbols) {
    const set = new Set();
    if (Array.isArray(knownSymbols)) {
      for (let i = 0; i < knownSymbols.length; i++) set.add(knownSymbols[i]);
    }
    return set;
  }

  function variableList(formula) {
    return (formula && Array.isArray(formula.variables)) ? formula.variables : [];
  }

  // Unknown variable symbols of one formula, in `variables` order, deduped.
  function unknownSymbols(formula, known) {
    const unknown = [];
    const seen = new Set();
    const vars = variableList(formula);
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i];
      if (!v || typeof v.symbol !== 'string' || v.symbol === '') continue;
      if (known.has(v.symbol) || seen.has(v.symbol)) continue;
      seen.add(v.symbol);
      unknown.push(v.symbol);
    }
    return unknown;
  }

  // Display form of a symbol, resolved from formula.variables; the raw
  // symbol is the fallback so malformed data still renders something.
  function displayOf(formula, symbol) {
    const vars = variableList(formula);
    for (let i = 0; i < vars.length; i++) {
      if (vars[i] && vars[i].symbol === symbol) {
        return (typeof vars[i].display === 'string') ? vars[i].display : symbol;
      }
    }
    return symbol;
  }

  function find(formulas, knownSymbols, opts = {}) {
    const options = (opts && typeof opts === 'object') ? opts : {};
    // `!= null` treats both undefined and null as "filter not requested".
    const wantCategory = options.category != null;
    const wantTarget = options.target != null;
    const known = knownSet(knownSymbols);
    const list = Array.isArray(formulas) ? formulas : [];

    const exact = [];
    const partial = [];
    const seenObjects = new Set(); // dedupe by object identity ...
    const seenIds = new Set();     // ... then by formula.id (unique per schema)

    for (let i = 0; i < list.length; i++) {
      const formula = list[i];
      if (!formula || typeof formula !== 'object') continue;   // malformed entry
      if (seenObjects.has(formula)) continue;                 // same object twice
      if (typeof formula.id === 'string') {
        if (seenIds.has(formula.id)) continue;                 // same id twice
        seenIds.add(formula.id);
      }
      seenObjects.add(formula);

      if (wantCategory && formula.category !== options.category) continue;

      const unknown = unknownSymbols(formula, known);
      if (unknown.length === 0) continue;   // fully determined -> skip
      if (unknown.length >= 4) continue;    // too far from knowns -> skip

      if (unknown.length === 1) {
        const solvedFor = unknown[0];
        if (wantTarget && solvedFor !== options.target) continue;
        exact.push({
          match: { formula: formula, solvedFor: solvedFor, missing: [] },
          count: 1,
          index: i
        });
      } else {
        // unknown.length is 2 or 3
        if (wantTarget && unknown.indexOf(options.target) === -1) continue;
        partial.push({
          match: {
            formula: formula,
            solvedFor: unknown[0],
            missing: unknown.slice()
          },
          count: unknown.length,
          index: i
        });
      }
    }

    // Fewest unknowns first, then original array order — deterministic.
    const byCountThenIndex = function (a, b) {
      return (a.count - b.count) || (a.index - b.index);
    };
    exact.sort(byCountThenIndex);
    partial.sort(byCountThenIndex);

    return {
      exact: exact.map(function (e) { return e.match; }),
      partial: partial.map(function (p) { return p.match; })
    };
  }

  function describeMatch(match) {
    if (!match || typeof match !== 'object' || !match.formula) {
      throw new TypeError(
        'describeMatch expects a match object: { formula, solvedFor, missing }'
      );
    }
    const formula = match.formula;
    const equation = (typeof formula.equation === 'string') ? formula.equation : '';
    const missing = Array.isArray(match.missing) ? match.missing : [];

    if (missing.length === 0) {
      const solvedFor = (typeof match.solvedFor === 'string') ? match.solvedFor : '';
      return 'Solves for ' + displayOf(formula, solvedFor) + ': ' + equation;
    }
    const displays = [];
    for (let i = 0; i < missing.length; i++) {
      displays.push(displayOf(formula, missing[i]));
    }
    return 'Add ' + displays.join(', ') + ' to use ' + equation;
  }

  return { find: find, describeMatch: describeMatch };
});