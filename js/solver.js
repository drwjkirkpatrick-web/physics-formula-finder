(function (root, factory) {
  const api = { create: factory };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsSolverFactory = api; }
})(typeof window !== 'undefined' ? window : globalThis, function (units) {
  'use strict';

  const NON_FINITE_MESSAGE =
    "The calculation didn't produce a finite number — a value may be zero in a denominator. Check your knowns.";

  function failure(error, message) {
    return { ok: false, error: error, message: message };
  }

  function formatValue(value) {
    return String(units.formatValue(value));
  }

  function formatWithUnit(value, unit) {
    const formatted = formatValue(value);
    return unit ? formatted + ' ' + unit : formatted;
  }

  // Accept numbers, or strings parsed with parseFloat ("72", "16 m/s").
  // Anything that is not a finite number afterwards is invalid.
  function parseValue(raw) {
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw : NaN;
    }
    if (typeof raw === 'string') {
      const parsed = parseFloat(raw.trim());
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  // A missing (or blank) unit defaults to the variable's siUnit.
  function pickUnit(entry, variable) {
    const raw = entry ? entry.unit : undefined;
    if (raw === undefined || raw === null) return variable.siUnit;
    const asString = String(raw).trim();
    return asString === '' ? variable.siUnit : asString;
  }

  function hasKnownEntry(knowns, symbol) {
    if (!Object.prototype.hasOwnProperty.call(knowns, symbol)) return false;
    return knowns[symbol] !== undefined && knowns[symbol] !== null;
  }

  function replaceAll(text, search, replacement) {
    return text.split(search).join(replacement);
  }

  // tokens: [{ display, replacement }] sorted longest-display-first, so
  // 'v₀' is replaced before 'v' and no display ever corrupts another.
  function buildSubstituted(rearranged, tokens) {
    let text = String(rearranged);
    for (let i = 0; i < tokens.length; i += 1) {
      text = replaceAll(text, tokens[i].display, tokens[i].replacement);
    }
    return text;
  }

  // Find the conversion record for a unit inside the units engine's list for
  // the variable's dimension. Dual-registered symbols ('°C' is both an
  // absolute temperature and a temperature interval; 'g' is both a gram and
  // standard gravity) resolve differently per dimension, so the record from
  // the variable's own dimension list is authoritative when the engine
  // exposes factors there. Records without a numeric mul (minimal mocks) are
  // ignored so the flat dimensionOf fallback still applies for them.
  function dimensionRecord(units, dimension, canonicalUnit, rawUnit) {
    let list = null;
    try { list = units.listUnits(dimension); } catch (e) { list = null; }
    if (!Array.isArray(list)) return null;
    for (let i = 0; i < list.length; i += 1) {
      const rec = list[i];
      if (rec && typeof rec.mul === 'number' &&
          (rec.symbol === canonicalUnit || rec.symbol === rawUnit)) {
        return rec;
      }
    }
    return null;
  }

  function solve(formula, targetSymbol, knowns) {
    try {
      const variables = formula && Array.isArray(formula.variables) ? formula.variables : [];
      const solveFor = formula && formula.solveFor && typeof formula.solveFor === 'object' ? formula.solveFor : {};
      const knownsMap = knowns && typeof knowns === 'object' ? knowns : {};

      // ---- 1. The target must be one of the formula's variables, with a solveFor entry.
      let target = null;
      for (let i = 0; i < variables.length; i += 1) {
        if (variables[i] && variables[i].symbol === targetSymbol) { target = variables[i]; break; }
      }
      const targetEntry = target ? solveFor[targetSymbol] : null;
      if (!target || !targetEntry || typeof targetEntry.fn !== 'function') {
        return failure('bad-target',
          "Cannot solve for '" + String(targetSymbol) + "' — it is not a variable of this formula.");
      }

      // ---- 2. Every non-target variable needs a known value. (If knowns also
      // contains the target, that entry is simply ignored.)
      const knownVariables = [];
      const missingVariables = [];
      for (let i = 0; i < variables.length; i += 1) {
        const variable = variables[i];
        if (!variable || variable.symbol === targetSymbol) continue;
        if (hasKnownEntry(knownsMap, variable.symbol)) knownVariables.push(variable);
        else missingVariables.push(variable);
      }
      if (missingVariables.length > 0) {
        const listed = [];
        for (let i = 0; i < missingVariables.length; i += 1) {
          const variable = missingVariables[i];
          listed.push(variable.display + ' (' + (variable.description || variable.symbol) + ')');
        }
        return failure('missing',
          'Missing values for: ' + listed.join(', ') + '. Go back to Step 2 and add them.');
      }

      // ---- 3. Parse every known value.
      const parsed = new Map();
      for (let i = 0; i < knownVariables.length; i += 1) {
        const variable = knownVariables[i];
        const entry = knownsMap[variable.symbol];
        const value = parseValue(entry.value);
        if (!Number.isFinite(value)) {
          return failure('invalid-value',
            'The value for ' + variable.display + ' is not a number.');
        }
        parsed.set(variable.symbol, { value: value });
      }

      // ---- 4. Normalize each unit, check its dimension, convert to SI.
      const converted = {};
      const assignments = [];
      const siValues = {};
      const convertLines = [];
      for (let i = 0; i < knownVariables.length; i += 1) {
        const variable = knownVariables[i];
        const entry = knownsMap[variable.symbol];
        const record = parsed.get(variable.symbol);
        const unit = pickUnit(entry, variable);
        let canonicalUnit = unit;
        try { canonicalUnit = units.normalize(unit); } catch (e) { canonicalUnit = unit; }
        const dimRecord = dimensionRecord(units, variable.dimension, canonicalUnit, unit);
        let siValue;
        if (dimRecord) {
          // Dimension-aware conversion: intervals use factor-only records,
          // standard-gravity 'g' uses the acceleration record, and absolute
          // temperatures still pick up their offsets from their own list.
          siValue = (record.value + (dimRecord.add || 0)) * dimRecord.mul;
        } else {
          const dimension = units.dimensionOf(canonicalUnit);
          if (dimension !== variable.dimension) {
            return failure('dimension-mismatch',
              "The unit '" + unit + "' entered for " + variable.display + ' (' + variable.dimension +
              ") doesn't fit — expected a " + variable.dimension + ' unit.');
          }
          siValue = units.toSI(record.value, canonicalUnit);
        }
        record.unit = unit;
        record.siValue = siValue;

        const siUnit = variable.siUnit;
        converted[variable.symbol] = {
          from: formatWithUnit(record.value, unit),
          to: formatWithUnit(siValue, siUnit),
          value: siValue,
          unit: siUnit
        };
        assignments.push({
          symbol: variable.symbol,
          display: variable.display,
          value: siValue,
          unit: siUnit
        });
        siValues[variable.symbol] = siValue;
        if (canonicalUnit !== siUnit) {
          convertLines.push(variable.display + ': ' + formatWithUnit(record.value, unit) +
            ' → ' + formatWithUnit(siValue, siUnit));
        }
      }

      // ---- 5. Compute through the formula's solveFor[target].fn.
      let value;
      try {
        value = targetEntry.fn(siValues);
      } catch (e) {
        return failure('non-finite', NON_FINITE_MESSAGE);
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return failure('non-finite', NON_FINITE_MESSAGE);
      }

      // ---- 6. Build the substituted equation: knowns (longest display first,
      // negatives parenthesized like (-5)) become numbers; the target becomes '?'.
      const tokens = [];
      for (let i = 0; i < knownVariables.length; i += 1) {
        const variable = knownVariables[i];
        const record = parsed.get(variable.symbol);
        let token = formatValue(record.siValue);
        if (token.startsWith('-')) token = '(' + token + ')';
        tokens.push({ display: variable.display, replacement: token });
      }
      tokens.push({ display: target.display, replacement: '?' });
      tokens.sort(function (a, b) { return b.display.length - a.display.length; });
      const substituted = buildSubstituted(targetEntry.rearranged, tokens);

      // ---- 7. The six worked steps.
      const computeText = target.display + ' = ' + formatWithUnit(value, target.siUnit);
      const steps = [
        { label: 'Formula', text: String(formula.equation) },
        { label: 'Rearranged', text: String(targetEntry.rearranged) },
        {
          label: 'Convert units',
          text: convertLines.length > 0
            ? convertLines.join('; ')
            : 'All known values are already in SI units.'
        },
        {
          label: 'Substitute',
          text: assignments.map(function (a) {
            return a.display + ' = ' + formatWithUnit(a.value, a.unit);
          }).join('; ') + '  →  ' + substituted
        },
        { label: 'Compute', text: computeText },
        { label: 'Result', text: computeText + ' (' + target.dimension + ')' }
      ];

      return {
        ok: true,
        target: {
          symbol: target.symbol,
          display: target.display,
          dimension: target.dimension,
          unit: target.siUnit
        },
        steps: steps,
        converted: converted,
        assignments: assignments,
        substituted: substituted,
        result: {
          symbol: target.symbol,
          display: target.display,
          value: value,
          unit: target.siUnit,
          dimension: target.dimension
        },
        formatted: formatWithUnit(value, target.siUnit)
      };
    } catch (e) {
      // Any unexpected throw (units engine, malformed formula) is reported,
      // never thrown at the caller.
      return failure('non-finite', e && e.message ? e.message : String(e));
    }
  }

  return { solve: solve };
});