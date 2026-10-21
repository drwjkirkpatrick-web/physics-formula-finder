/**
 * physics-formula-finder — js/units.js (Builder A)
 * Detailed units & conversion engine. Browser global: `PhysicsUnits`.
 *
 * Implements §UNITS of SPEC.md: 31 dimensions, exact Unicode unit
 * symbols, offset-aware temperature conversions, alias resolution,
 * and significant-figure formatting.
 *
 * Unit record shape (also returned by listUnits): { symbol, name, mul, add }
 *   to SI:   si = (value + add) * mul
 *   from SI: value = si / mul - add
 * Ordinary units have add = 0. Temperature '°C' has add 273.15 and
 * '°F' has mul 5/9 with add 459.67; temperature-INTERVAL records carry
 * no offsets.
 *
 * Public API (exactly these nine members):
 *   toSI(value, unitSymbol)            -> number
 *   fromSI(value, unitSymbol)          -> number
 *   convert(value, fromSymbol, toSymbol) -> number
 *   dimensionOf(unitSymbol)            -> dimension key | null
 *   listUnits(dimension)               -> [{ symbol, name, mul, add }]
 *   allUnitSymbols()                   -> { [unitSymbol]: dimension }
 *   normalize(unitSymbol)              -> canonical symbol
 *   formatValue(value, sigFigs = 4)    -> string
 *   isTemperature(dimension)           -> boolean
 *
 * All public functions accept unit aliases (normalize is applied
 * internally, so aliases like 'kph' work everywhere). Unknown units
 * throw an Error whose `.name` is 'UnitError'.
 *
 * Dual-registered symbols: 'g' (mass gram / acceleration standard
 * gravity) and 'K', '°C', '°F' (temperature / temperature-interval).
 * Flat symbol lookups (toSI, fromSI, convert, dimensionOf) resolve these
 * to the FIRST registered dimension, following the SPEC dimension
 * order: 'g' → mass, K/°C/°F → temperature (with offsets). The
 * per-dimension lists from listUnits() always contain every record
 * registered for that dimension, so the factor-only temperature-interval
 * records stay available to callers that know the dimension.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  else { root.PhysicsUnits = api; }   // ← this module's global name
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ---------------------------------------------------------- errors -- */

  class UnitError extends Error {
    constructor(message) {
      super(message);
      this.name = 'UnitError';
    }
  }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function unknownUnit(unitSymbol) {
    return new UnitError("Unknown unit: '" + String(unitSymbol) + "'");
  }

  function unknownDimension(dimension) {
    return new UnitError("Unknown dimension: '" + String(dimension) + "'");
  }

  function invalidValue(value) {
    return new UnitError("Invalid value: '" + String(value) +
      "' (expected a finite number)");
  }

  /* ------------------------------------------------------- registry -- */

  function unit(symbol, name, mul, add) {
    return { symbol: symbol, name: name, mul: mul, add: add === undefined ? 0 : add };
  }

  // Canonical dimension keys, in the order given by the SPEC.
  const DIMENSIONS = [
    'length', 'time', 'mass', 'velocity', 'acceleration', 'force', 'energy',
    'power', 'momentum', 'pressure', 'temperature', 'temperature-interval',
    'charge', 'current', 'voltage', 'resistance', 'capacitance', 'frequency',
    'angle', 'area', 'volume', 'density', 'amount', 'dimensionless',
    'spring-constant', 'linear-density', 'intensity', 'resistivity',
    'specific-heat', 'latent-heat', 'thermal-expansivity'
  ];

  // Unit records, SI first within each dimension (dropdown order).
  const REGISTRY = {
    length: [
      unit('m', 'meter', 1),
      unit('km', 'kilometer', 1000),
      unit('cm', 'centimeter', 0.01),
      unit('mm', 'millimeter', 0.001),
      unit('μm', 'micrometer', 1e-6),
      unit('mi', 'mile', 1609.344),
      unit('yd', 'yard', 0.9144),
      unit('ft', 'foot', 0.3048),
      unit('in', 'inch', 0.0254)
    ],
    time: [
      unit('s', 'second', 1),
      unit('ms', 'millisecond', 0.001),
      unit('μs', 'microsecond', 1e-6),
      unit('min', 'minute', 60),
      unit('hr', 'hour', 3600),
      unit('day', 'day', 86400)
    ],
    mass: [
      unit('kg', 'kilogram', 1),
      unit('g', 'gram', 0.001),
      unit('mg', 'milligram', 1e-6),
      unit('t', 'metric ton', 1000),
      unit('lb', 'pound', 0.45359237)
    ],
    velocity: [
      unit('m/s', 'meter per second', 1),
      unit('km/h', 'kilometer per hour', 1000 / 3600),
      unit('mph', 'mile per hour', 0.44704),
      unit('ft/s', 'foot per second', 0.3048),
      unit('cm/s', 'centimeter per second', 0.01)
    ],
    acceleration: [
      unit('m/s^2', 'meter per second squared', 1),
      unit('ft/s^2', 'foot per second squared', 0.3048),
      unit('g', 'standard gravity', 9.80665)
    ],
    force: [
      unit('N', 'newton', 1),
      unit('kN', 'kilonewton', 1000),
      unit('mN', 'millinewton', 0.001),
      unit('dyn', 'dyne', 1e-5),
      unit('lbf', 'pound-force', 4.4482216152605)
    ],
    energy: [
      unit('J', 'joule', 1),
      unit('kJ', 'kilojoule', 1000),
      unit('cal', 'calorie', 4.184),
      unit('kcal', 'kilocalorie', 4184),
      unit('eV', 'electronvolt', 1.602176634e-19),
      unit('kWh', 'kilowatt-hour', 3.6e6)
    ],
    power: [
      unit('W', 'watt', 1),
      unit('kW', 'kilowatt', 1000),
      unit('MW', 'megawatt', 1e6),
      unit('hp', 'horsepower', 745.699872)
    ],
    momentum: [
      unit('kg*m/s', 'kilogram meter per second', 1)
    ],
    pressure: [
      unit('Pa', 'pascal', 1),
      unit('kPa', 'kilopascal', 1000),
      unit('MPa', 'megapascal', 1e6),
      unit('bar', 'bar', 1e5),
      unit('atm', 'atmosphere', 101325),
      unit('psi', 'pound per square inch', 6894.757293168),
      unit('mmHg', 'millimeter of mercury', 133.32239),
      unit('torr', 'torr', 101325 / 760)
    ],
    temperature: [
      unit('K', 'kelvin', 1),
      unit('°C', 'degree Celsius', 1, 273.15),
      unit('°F', 'degree Fahrenheit', 5 / 9, 459.67)
    ],
    'temperature-interval': [
      unit('K', 'kelvin (interval)', 1),
      unit('°C', 'degree Celsius (interval)', 1),
      unit('°F', 'degree Fahrenheit (interval)', 5 / 9)
    ],
    charge: [
      unit('C', 'coulomb', 1),
      unit('mC', 'millicoulomb', 0.001),
      unit('μC', 'microcoulomb', 1e-6),
      unit('nC', 'nanocoulomb', 1e-9)
    ],
    current: [
      unit('A', 'ampere', 1),
      unit('mA', 'milliampere', 0.001),
      unit('μA', 'microampere', 1e-6)
    ],
    voltage: [
      unit('V', 'volt', 1),
      unit('mV', 'millivolt', 0.001),
      unit('kV', 'kilovolt', 1000)
    ],
    resistance: [
      unit('Ω', 'ohm', 1),
      unit('mΩ', 'milliohm', 0.001),
      unit('kΩ', 'kiloohm', 1000),
      unit('MΩ', 'megaohm', 1e6)
    ],
    capacitance: [
      unit('F', 'farad', 1),
      unit('mF', 'millifarad', 0.001),
      unit('μF', 'microfarad', 1e-6),
      unit('nF', 'nanofarad', 1e-9),
      unit('pF', 'picofarad', 1e-12)
    ],
    frequency: [
      unit('Hz', 'hertz', 1),
      unit('kHz', 'kilohertz', 1000),
      unit('MHz', 'megahertz', 1e6),
      unit('GHz', 'gigahertz', 1e9)
    ],
    angle: [
      unit('rad', 'radian', 1),
      unit('°', 'degree', Math.PI / 180)
    ],
    area: [
      unit('m²', 'square meter', 1),
      unit('cm²', 'square centimeter', 1e-4),
      unit('ft²', 'square foot', 0.09290304),
      unit('in²', 'square inch', 0.00064516)
    ],
    volume: [
      unit('m³', 'cubic meter', 1),
      unit('L', 'liter', 0.001),
      unit('mL', 'milliliter', 1e-6),
      unit('cm³', 'cubic centimeter', 1e-6),
      unit('gal', 'gallon', 0.003785411784)
    ],
    density: [
      unit('kg/m³', 'kilogram per cubic meter', 1),
      unit('g/cm³', 'gram per cubic centimeter', 1000)
    ],
    amount: [
      unit('mol', 'mole', 1),
      unit('kmol', 'kilomole', 1000),
      unit('mmol', 'millimole', 0.001)
    ],
    dimensionless: [
      unit('', 'dimensionless', 1)
    ],
    'spring-constant': [
      unit('N/m', 'newton per meter', 1)
    ],
    'linear-density': [
      unit('kg/m', 'kilogram per meter', 1)
    ],
    intensity: [
      unit('W/m²', 'watt per square meter', 1)
    ],
    resistivity: [
      unit('Ω*m', 'ohm meter', 1)
    ],
    'specific-heat': [
      unit('J/(kg·K)', 'joule per kilogram kelvin', 1)
    ],
    'latent-heat': [
      unit('J/kg', 'joule per kilogram', 1),
      unit('kcal/kg', 'kilocalorie per kilogram', 4184)
    ],
    'thermal-expansivity': [
      unit('1/K', 'per kelvin', 1)
    ]
  };

  // Flat symbol index. Four symbols are registered in two dimensions
  // ('g', 'K', '°C', '°F'); the first dimension in DIMENSIONS wins for
  // flat lookups (see the file header).
  const BY_SYMBOL = {};
  DIMENSIONS.forEach(function (dim) {
    REGISTRY[dim].forEach(function (rec) {
      if (!hasOwn(BY_SYMBOL, rec.symbol)) {
        BY_SYMBOL[rec.symbol] = { dimension: dim, record: rec };
      }
    });
  });
  const CANONICAL_SYMBOLS = Object.keys(BY_SYMBOL); // unique symbol strings

  // Alias map. Keys are student-friendly spellings; values are the
  // canonical symbols registered above. The SPEC list is the minimum;
  // the extras below resolve common ASCII spellings and word forms.
  const ALIASES = {
    // SPEC-required minimum
    'kph': 'km/h', 'kmh': 'km/h',
    'm/s2': 'm/s^2', 'ms2': 'm/s^2',
    'ohm': 'Ω', 'kohm': 'kΩ', 'Mohm': 'MΩ',
    'uF': 'μF', 'uC': 'μC', 'uA': 'μA', 'um': 'μm', 'us': 'μs',
    'degC': '°C', 'celsius': '°C',
    'degF': '°F', 'fahrenheit': '°F',
    'deg': '°', 'degrees': '°',
    'sec': 's', 'secs': 's',
    'meter': 'm', 'meters': 'm',
    'foot': 'ft', 'feet': 'ft',
    'inch': 'in', 'inches': 'in',
    'mile': 'mi', 'miles': 'mi',
    'gram': 'g', 'grams': 'g',
    'pound': 'lb', 'pounds': 'lb',
    'hour': 'hr', 'hours': 'hr',
    'radian': 'rad', 'radians': 'rad',
    'mole': 'mol',
    // friendly extras (all resolve to canonical symbols)
    'km/hr': 'km/h', 'mi/hr': 'mph',
    'm/s²': 'm/s^2', 'ft/s²': 'ft/s^2', 'ft/s2': 'ft/s^2',
    'm2': 'm²', 'cm2': 'cm²', 'ft2': 'ft²', 'in2': 'in²',
    'm3': 'm³', 'cm3': 'cm³', 'kg/m3': 'kg/m³', 'g/cm3': 'g/cm³',
    'W/m2': 'W/m²',
    // MICRO SIGN (U+00B5) spellings of the Greek-mu units
    'µF': 'μF', 'µC': 'μC', 'µA': 'μA', 'µm': 'μm', 'µs': 'μs',
    'milliohm': 'mΩ', 'kiloohm': 'kΩ', 'megaohm': 'MΩ',
    'ohm*m': 'Ω*m', 'ohm·m': 'Ω*m',
    'J/(kg*K)': 'J/(kg·K)', 'J/(kg K)': 'J/(kg·K)',
    'second': 's', 'seconds': 's', 'minute': 'min', 'minutes': 'min',
    'days': 'day', 'moles': 'mol', 'kelvin': 'K',
    'newton': 'N', 'newtons': 'N', 'joule': 'J', 'joules': 'J',
    'watt': 'W', 'watts': 'W', 'pascal': 'Pa', 'hertz': 'Hz',
    'volt': 'V', 'volts': 'V', 'ampere': 'A', 'amp': 'A', 'amps': 'A',
    'coulomb': 'C', 'coulombs': 'C', 'farad': 'F',
    'liter': 'L', 'liters': 'L', 'litre': 'L', 'litres': 'L',
    'gallon': 'gal', 'gallons': 'gal',
    'dimensionless': '', 'unitless': '', 'none': ''
  };

  /* --------------------------------------------------------- core -- */

  /**
   * Resolve a unit symbol to its canonical spelling.
   * Exact canonical symbols win, then the alias map (case-sensitive),
   * then a case-insensitive fallback over canonicals and aliases.
   * @param {string} unitSymbol - symbol or alias (may be '' for
   *   the dimensionless unit)
   * @returns {string} canonical symbol
   * @throws {UnitError} unknown or ambiguous input
   */
  function normalize(unitSymbol) {
    if (typeof unitSymbol === 'string' && hasOwn(BY_SYMBOL, unitSymbol)) {
      return unitSymbol;
    }
    if (typeof unitSymbol !== 'string') { throw unknownUnit(unitSymbol); }
    if (hasOwn(ALIASES, unitSymbol)) { return ALIASES[unitSymbol]; }
    const lower = unitSymbol.toLowerCase();
    // case-insensitive over canonical symbols
    const canon = CANONICAL_SYMBOLS.filter(function (s) {
      return s.toLowerCase() === lower;
    });
    if (canon.length === 1) { return canon[0]; }
    if (canon.length > 1) {
      throw new UnitError("Ambiguous unit '" + unitSymbol +
        "': matches " + canon.join(', ') + ' (use exact capitalization)');
    }
    // case-insensitive over alias keys
    const aliasHits = Object.keys(ALIASES).filter(function (a) {
      return a.toLowerCase() === lower;
    });
    const targets = [];
    aliasHits.forEach(function (a) {
      if (targets.indexOf(ALIASES[a]) === -1) { targets.push(ALIASES[a]); }
    });
    if (targets.length === 1) { return targets[0]; }
    if (targets.length > 1) {
      throw new UnitError("Ambiguous unit '" + unitSymbol +
        "': matches " + aliasHits.join(', '));
    }
    throw unknownUnit(unitSymbol);
  }

  function recordFor(unitSymbol) {
    return BY_SYMBOL[normalize(unitSymbol)].record;
  }

  /**
   * Convert a value in the given unit to the SI unit of its dimension.
   * si = (value + add) * mul
   * @param {number} value - finite number
   * @param {string} unitSymbol - canonical symbol or alias
   * @returns {number} value in SI units
   * @throws {UnitError} unknown unit or non-finite value
   */
  function toSI(value, unitSymbol) {
    const rec = recordFor(unitSymbol);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalidValue(value);
    }
    return (value + rec.add) * rec.mul;
  }

  /**
   * Convert an SI value into the given unit.
   * value = si / mul - add
   * @throws {UnitError} unknown unit or non-finite value
   */
  function fromSI(value, unitSymbol) {
    const rec = recordFor(unitSymbol);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalidValue(value);
    }
    return value / rec.mul - rec.add;
  }

  /**
   * Convert between two units of the same dimension.
   * @throws {UnitError} unknown unit, dimension mismatch, or bad value.
   *   Mismatch message (exact): `Cannot convert <from> (<dimFrom>) to
   *   <to> (<dimTo>)`, using the symbols as passed.
   */
  function convert(value, fromSymbol, toSymbol) {
    const fromNorm = normalize(fromSymbol);
    const toNorm = normalize(toSymbol);
    const dimFrom = BY_SYMBOL[fromNorm].dimension;
    const dimTo = BY_SYMBOL[toNorm].dimension;
    if (dimFrom !== dimTo) {
      throw new UnitError('Cannot convert ' + fromSymbol + ' (' + dimFrom +
        ') to ' + toSymbol + ' (' + dimTo + ')');
    }
    return fromSI(toSI(value, fromNorm), toNorm);
  }

  /**
   * Dimension key for a unit symbol (aliases accepted), or null if the
   * symbol is unknown. Never throws.
   */
  function dimensionOf(unitSymbol) {
    let canonical;
    try { canonical = normalize(unitSymbol); }
    catch (err) { return null; }
    const entry = BY_SYMBOL[canonical];
    return entry ? entry.dimension : null;
  }

  /**
   * Units registered for a dimension, SI first (dropdown order).
   * Entries are the full records { symbol, name, mul, add }.
   * @throws {UnitError} unknown dimension
   */
  function listUnits(dimension) {
    if (typeof dimension !== 'string' || !hasOwn(REGISTRY, dimension)) {
      throw unknownDimension(dimension);
    }
    return REGISTRY[dimension].map(function (rec) {
      return { symbol: rec.symbol, name: rec.name, mul: rec.mul, add: rec.add };
    });
  }

  /**
   * Map of every canonical unit symbol to its dimension (aliases
   * excluded). For the four dual-registered symbols the value is the
   * first-registered dimension (see file header).
   */
  function allUnitSymbols() {
    const out = {};
    CANONICAL_SYMBOLS.forEach(function (sym) {
      out[sym] = BY_SYMBOL[sym].dimension;
    });
    return out;
  }

  /**
   * Format a number for display.
   * - 0 → '0'; integers in range render bare ('26').
   * - Rounded to sigFigs significant digits, trailing zeros stripped
   *   ('9.810' → '9.81').
   * - |v| >= 1e5 or (|v| < 1e-3 and v !== 0) → scientific:
   *   '2.998 × 10^8', '1.602 × 10^-19' (mantissa has sigFigs digits).
   * - Negatives get a leading '-'.
   * @param {number} value
   * @param {number} [sigFigs=4] - integer >= 1
   * @returns {string}
   * @throws {UnitError} non-finite value or invalid sigFigs
   */
  function formatValue(value, sigFigs) {
    if (sigFigs === undefined) { sigFigs = 4; }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalidValue(value);
    }
    if (typeof sigFigs !== 'number' || !Number.isInteger(sigFigs) ||
        sigFigs < 1) {
      throw new UnitError("Invalid sigFigs: '" + String(sigFigs) +
        "' (expected an integer >= 1)");
    }
    if (value === 0) { return '0'; }
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1e5 || abs < 1e-3) {
      const parts = abs.toExponential(sigFigs - 1).split('e');
      const mantissa = Number(parts[0]);        // strips trailing zeros
      const exponent = parseInt(parts[1], 10);  // toExponential keeps the
                                               // mantissa in [1, 10)
      return sign + String(mantissa) + ' × 10^' + exponent;
    }
    return sign + String(Number(abs.toPrecision(sigFigs)));
  }

  /**
   * True only for the 'temperature' dimension (offset conversions
   * apply there; 'temperature-interval' is factor-only).
   */
  function isTemperature(dimension) {
    return dimension === 'temperature';
  }

  /* ------------------------------------------------------ exports -- */

  return {
    toSI: toSI,
    fromSI: fromSI,
    convert: convert,
    dimensionOf: dimensionOf,
    listUnits: listUnits,
    allUnitSymbols: allUnitSymbols,
    normalize: normalize,
    formatValue: formatValue,
    isTemperature: isTemperature
  };
});