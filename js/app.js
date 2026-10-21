// ---------------------------------------------------------------------------
// Formula for Success — application wiring (parent-owned integration file).
// Wires the four logic modules to the Step 1-6 DOM contract in index.html:
//   PhysicsUnits, PhysicsFormulas, PhysicsFinder, PhysicsSolverFactory.
// No imports, no frameworks — plain browser script, loaded last.
// All dynamic content uses textContent/createElement (never innerHTML), so
// student-typed problem text can't inject markup.
// ---------------------------------------------------------------------------
(function () {
  'use strict';

  const Units = window.PhysicsUnits;
  const Formulas = window.PhysicsFormulas;
  const Finder = window.PhysicsFinder;
  const Solver = window.PhysicsSolverFactory.create(Units);

  function $(id) { return document.getElementById(id); }

  const els = {
    problemText: $('problem-text'),
    examplesSelect: $('examples-select'),
    loadExample: $('load-example'),
    variablesBody: $('variables-body'),
    addVariable: $('add-variable'),
    varsSummary: $('vars-summary'),
    matchList: $('match-list'),
    formulaSelect: $('formula-select'),
    formulaInfo: $('formula-info'),
    targetSelect: $('target-select'),
    targetNote: $('target-note'),
    convertPreview: $('convert-preview'),
    substitutePreview: $('substitute-preview'),
    resultBox: $('result-box'),
    stepsList: $('steps-list'),
    startOver: $('start-over'),
    prev: $('btn-prev'),
    next: $('btn-next'),
    strip: $('steps-strip')
  };

  // ---- Worked examples -----------------------------------------------------
  const EXAMPLES = [
    {
      name: 'Braking car (kinematics)',
      problem: 'A car is traveling at 72 km/h when the driver brakes, decelerating at 5.0 m/s². How long does it take to come to a stop?',
      rows: [
        { symbol: 'v0', dimension: 'velocity', value: '72', unit: 'km/h' },
        { symbol: 'v', dimension: 'velocity', value: '0', unit: 'm/s' },
        { symbol: 'a', dimension: 'acceleration', value: '-5.0', unit: 'm/s^2' }
      ],
      formulaId: 'kinematics-01', target: 't'
    },
    {
      name: 'Dropped from a roof (free fall)',
      problem: 'A ball is dropped from a 45 m roof. Ignoring air resistance, how fast is it moving just before it hits the ground?',
      rows: [
        { symbol: 'v0', dimension: 'velocity', value: '0', unit: 'm/s' },
        { symbol: 'a', dimension: 'acceleration', value: '9.81', unit: 'm/s^2' },
        { symbol: 'dx', dimension: 'length', value: '45', unit: 'm' }
      ],
      formulaId: 'kinematics-03', target: 'v'
    },
    {
      name: "Resistor voltage (Ohm's law)",
      problem: 'A heating element draws 50 mA of current through a 2.2 kΩ resistor. What voltage does it drop?',
      rows: [
        { symbol: 'I', dimension: 'current', value: '50', unit: 'mA' },
        { symbol: 'R', dimension: 'resistance', value: '2.2', unit: 'kΩ' }
      ],
      formulaId: 'electricity-01', target: 'V'
    }
  ];

  // ---- tiny DOM helpers -----------------------------------------------------
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function option(text, value) {
    const o = document.createElement('option');
    o.textContent = text;
    o.value = value;
    return o;
  }

  // ---- Step 2: variable rows -------------------------------------------------
  const rowRefs = [];

  function symbolChoices() {
    // One entry per unique (symbol, dimension) pair, alphabetical by symbol.
    const syms = Formulas.allSymbols().slice();
    syms.sort(function (a, b) {
      if (a.symbol !== b.symbol) return a.symbol < b.symbol ? -1 : 1;
      return a.description < b.description ? -1 : 1;
    });
    return syms;
  }

  function populateSymbolOptions(select) {
    select.appendChild(option('— choose a variable —', ''));
    symbolChoices().forEach(function (s) {
      select.appendChild(option(s.symbol + ' — ' + s.description,
        s.symbol + '::' + s.dimension));
    });
  }

  function populateUnitOptions(select, dimension, preferred) {
    select.textContent = '';
    let list = [];
    try { list = Units.listUnits(dimension); } catch (e) { list = []; }
    list.forEach(function (u) {
      select.appendChild(option(u.symbol === '' ? '(dimensionless)' : u.symbol, u.symbol));
    });
    select.value = preferred || (list[0] && list[0].symbol) || '';
  }

  function pairOf(value) {
    if (!value) return { symbol: '', dimension: '' };
    const i = value.indexOf('::');
    if (i < 0) return { symbol: value, dimension: '' };
    return { symbol: value.slice(0, i), dimension: value.slice(i + 2) };
  }

  function addRow(pre) {
    pre = pre || {};
    const tr = document.createElement('tr');

    const symbolCell = document.createElement('td');
    const symbolSel = document.createElement('select');
    populateSymbolOptions(symbolSel);
    symbolCell.appendChild(symbolSel);

    const valueCell = document.createElement('td');
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.inputMode = 'decimal';
    valueInput.placeholder = 'value';
    valueCell.appendChild(valueInput);

    const unitCell = document.createElement('td');
    const unitSel = document.createElement('select');
    unitCell.appendChild(unitSel);

    const removeCell = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.setAttribute('aria-label', 'Remove this variable');
    removeCell.appendChild(removeBtn);

    tr.appendChild(symbolCell);
    tr.appendChild(valueCell);
    tr.appendChild(unitCell);
    tr.appendChild(removeCell);
    els.variablesBody.appendChild(tr);

    const row = { tr: tr, symbolSel: symbolSel, valueInput: valueInput, unitSel: unitSel };
    rowRefs.push(row);

    function refreshUnits() {
      const p = pairOf(symbolSel.value);
      if (p.dimension) {
        let si = '';
        const syms = Formulas.allSymbols();
        for (let i = 0; i < syms.length; i += 1) {
          if (syms[i].symbol === p.symbol && syms[i].dimension === p.dimension) {
            si = syms[i].siUnit; break;
          }
        }
        populateUnitOptions(unitSel, p.dimension, pre.unit || si);
      } else {
        unitSel.textContent = '';
      }
      rowChanged();
    }

    symbolSel.addEventListener('change', function () { pre.unit = null; refreshUnits(); });
    valueInput.addEventListener('input', rowChanged);
    unitSel.addEventListener('change', rowChanged);
    removeBtn.addEventListener('click', function () {
      const i = rowRefs.indexOf(row);
      if (i >= 0) rowRefs.splice(i, 1);
      tr.remove();
      rowChanged();
    });

    if (pre.symbol && pre.dimension) {
      symbolSel.value = pre.symbol + '::' + pre.dimension;
      refreshUnits(); // applies pre.unit via populateUnitOptions
      valueInput.value = pre.value || '';
    }
    rowChanged();
  }

  function clearRows() {
    rowRefs.length = 0;
    els.variablesBody.textContent = '';
  }

  function readRows() {
    return rowRefs.map(function (r) {
      const p = pairOf(r.symbolSel.value);
      return {
        symbol: p.symbol,
        dimension: p.dimension,
        valueStr: r.valueInput.value.trim(),
        unit: r.unitSel.value
      };
    });
  }

  function knownsFromRows() {
    const knowns = {};
    const symbols = [];
    const problems = [];
    const seen = Object.create(null);
    readRows().forEach(function (r) {
      if (!r.symbol || r.valueStr === '') return;
      const num = parseFloat(r.valueStr);
      if (!Number.isFinite(num)) {
        problems.push("'" + r.valueStr + "' for " + r.symbol + " is not a number");
        return;
      }
      if (seen[r.symbol]) problems.push(r.symbol + ' is listed twice — the last value wins');
      seen[r.symbol] = true;
      knowns[r.symbol] = { value: num, unit: r.unit };
      symbols.push(r.symbol);
    });
    return { knowns: knowns, symbols: symbols, problems: problems };
  }

  function updateSummary() {
    const box = els.varsSummary;
    box.textContent = '';
    const k = knownsFromRows();
    if (k.symbols.length === 0) {
      box.appendChild(el('span', null,
        'No values yet — write down every variable the problem gives you.'));
      return;
    }
    box.appendChild(el('span', null,
      'Known so far: ' + k.symbols.join(', ') + ' (' + k.symbols.length +
      (k.symbols.length === 1 ? ' value' : ' values') + ').'));
    k.problems.forEach(function (p) {
      box.appendChild(el('div', 'error', p));
    });
  }

  // ---- Step 3: formula selection ---------------------------------------------
  function populateFormulaSelect() {
    els.formulaSelect.appendChild(option('— choose a formula —', ''));
    Formulas.categories.forEach(function (cat) {
      const og = document.createElement('optgroup');
      og.label = cat.name;
      Formulas.byCategory(cat.id).forEach(function (f) {
        og.appendChild(option(f.name + ' — ' + f.equation, f.id));
      });
      els.formulaSelect.appendChild(og);
    });
  }

  function renderFormulaInfo() {
    const box = els.formulaInfo;
    box.textContent = '';
    const f = Formulas.byId(els.formulaSelect.value);
    if (!f) return;
    box.appendChild(el('h3', null, f.name));
    box.appendChild(el('p', 'equation', f.equation));
    box.appendChild(el('p', null, f.statement));
    if (f.notes) box.appendChild(el('p', 'hint', f.notes));
    const ul = el('ul', 'var-list');
    f.variables.forEach(function (v) {
      ul.appendChild(el('li', null,
        v.display + ' — ' + v.description +
        (v.siUnit === '' ? ' (dimensionless)' : ' (' + v.siUnit + ')')));
    });
    box.appendChild(ul);
  }

  function populateTargetSelect(preferred) {
    const sel = els.targetSelect;
    sel.textContent = '';
    const f = Formulas.byId(els.formulaSelect.value);
    if (!f) return;
    const knowns = knownsFromRows().knowns;
    const has = function (sym) {
      return Object.prototype.hasOwnProperty.call(knowns, sym);
    };
    const missing = f.variables.filter(function (v) { return !has(v.symbol); });
    const ordered = missing.concat(f.variables.filter(function (v) { return has(v.symbol); }));
    ordered.forEach(function (v) {
      sel.appendChild(option(v.display + ' — ' + v.description, v.symbol));
    });
    if (preferred && ordered.some(function (v) { return v.symbol === preferred; })) {
      sel.value = preferred;
    } else if (ordered.length > 0) {
      sel.value = ordered[0].symbol;
    }
    updateTargetNote(f, missing);
  }

  function updateTargetNote(f, missing) {
    const note = els.targetNote;
    note.textContent = '';
    note.classList.remove('error');
    if (!f) return;
    if (missing.length === 0) {
      note.textContent =
        "Every variable of this formula has a value. Pick the one to solve for — its own listed value is ignored.";
    } else if (missing.length === 1) {
      note.textContent = 'Missing: ' + missing[0].display + ' (' + missing[0].description +
        ') — that is the variable you will solve for.';
    } else {
      const listed = missing.map(function (v) {
        return v.display + ' (' + v.description + ')';
      }).join(', ');
      note.classList.add('error');
      note.textContent = 'Still missing values for: ' + listed +
        '. Add them in Step 2 — a solve needs every value except the one you want.';
    }
  }

  function updateMatches() {
    const box = els.matchList;
    box.textContent = '';
    const k = knownsFromRows();
    if (k.symbols.length === 0) {
      box.appendChild(el('p', 'hint',
        'List your variables in Step 2 and the best formulas will show up here automatically.'));
      return;
    }
    const m = Finder.find(Formulas.list(), k.symbols);
    if (m.exact.length === 0 && m.partial.length === 0) {
      box.appendChild(el('p', 'hint',
        'No curated formula is close to that combination of variables yet — pick one manually below.'));
      return;
    }
    if (m.exact.length > 0) {
      box.appendChild(el('h4', null, 'You have every value except one — ready to use:'));
      m.exact.forEach(function (match) {
        const btn = el('button', 'match-btn', Finder.describeMatch(match));
        btn.type = 'button';
        btn.addEventListener('click', function () {
          selectFormula(match.formula.id, match.solvedFor);
        });
        box.appendChild(btn);
      });
    }
    if (m.partial.length > 0) {
      box.appendChild(el('h4', null, 'Nearly there — add one or two more values:'));
      m.partial.slice(0, 8).forEach(function (match) {
        box.appendChild(el('div', 'hint', Finder.describeMatch(match)));
      });
    }
  }

  function selectFormula(id, target) {
    els.formulaSelect.value = id;
    renderFormulaInfo();
    populateTargetSelect(target);
  }

  // ---- Steps 4-6: solve and render ---------------------------------------------
  function runSolve() {
    const note = els.targetNote;
    note.classList.remove('error');
    note.textContent = '';
    const f = Formulas.byId(els.formulaSelect.value);
    if (!f) {
      note.classList.add('error');
      note.textContent = 'Choose a formula first.';
      return null;
    }
    const target = els.targetSelect.value;
    if (!target) {
      note.classList.add('error');
      note.textContent = 'Choose the variable to solve for.';
      return null;
    }
    const k = knownsFromRows();
    if (k.problems.length > 0) {
      note.classList.add('error');
      note.textContent = k.problems.join('; ') + '.';
      return null;
    }
    const res = Solver.solve(f, target, k.knowns);
    if (!res.ok) {
      note.classList.add('error');
      note.textContent = res.message + (f.notes ? '  Note: ' + f.notes : '');
      return null;
    }
    return res;
  }

  function renderSolveOutputs(res) {
    // Step 4 — conversions
    const conv = els.convertPreview;
    conv.textContent = '';
    const ul = el('ul', 'convert-list');
    let anyConverted = false;
    res.assignments.forEach(function (a) {
      const c = res.converted[a.symbol];
      const li = el('li', null);
      li.appendChild(document.createTextNode(a.display + ': ' + c.from + ' → ' + c.to));
      ul.appendChild(li);
      if (c.from !== c.to) anyConverted = true;
    });
    if (!anyConverted) {
      conv.appendChild(el('p', null, 'All known values are already in SI units:'));
    } else {
      conv.appendChild(el('p', null, 'Converted into SI units:'));
    }
    conv.appendChild(ul);

    // Step 5 — substitution
    const sub = els.substitutePreview;
    sub.textContent = '';
    sub.appendChild(el('p', 'equation', res.substituted));
    const assign = el('ul', 'assign-list');
    res.assignments.forEach(function (a) {
      assign.appendChild(el('li', null,
        a.display + ' = ' + Units.formatValue(a.value) + (a.unit ? ' ' + a.unit : '')));
    });
    sub.appendChild(assign);

    // Step 6 — result + full worked steps
    const box = els.resultBox;
    box.textContent = '';
    box.appendChild(el('div', 'answer',
      res.result.display + ' = ' + res.formatted));
    box.appendChild(el('p', 'hint',
      'Solved for ' + res.target.display + ' (' + res.target.dimension + ').'));

    const list = els.stepsList;
    list.textContent = '';
    res.steps.forEach(function (s) {
      const li = el('li');
      li.appendChild(el('strong', null, s.label + ': '));
      li.appendChild(document.createTextNode(s.text));
      list.appendChild(li);
    });
  }

  // ---- Wizard navigation -------------------------------------------------------
  let currentStep = 1;

  function setStep(n) {
    currentStep = n;
    const sections = document.querySelectorAll('main section.step');
    sections.forEach(function (s) {
      s.classList.toggle('active', s.id === 'step-' + n);
    });
    els.strip.querySelectorAll('li').forEach(function (li) {
      if (Number(li.getAttribute('data-step')) === n) {
        li.setAttribute('aria-current', 'step');
      } else {
        li.removeAttribute('aria-current');
      }
    });
    els.prev.disabled = (n === 1);
    els.next.disabled = (n === 6);
    els.next.textContent = (n === 6) ? 'Done ✓' : 'Next →';
  }

  function goNext() {
    if (currentStep === 2) {
      const k = knownsFromRows();
      if (k.symbols.length === 0) {
        els.varsSummary.appendChild(el('div', 'error',
          'Add at least one variable with a value before continuing.'));
        return;
      }
      updateMatches();
    }
    if (currentStep === 3) {
      const res = runSolve();
      if (!res) return; // error already shown in target-note
      renderSolveOutputs(res);
    }
    if (currentStep < 6) setStep(currentStep + 1);
  }

  function goPrev() {
    if (currentStep > 1) setStep(currentStep - 1);
  }

  function rowChanged() {
    updateSummary();
    // Live-refresh suggestions and target note while on Step 3.
    if (currentStep === 3) {
      updateMatches();
      populateTargetSelect(els.targetSelect.value);
    }
  }

  // ---- Examples & reset ------------------------------------------------------------
  function loadExample() {
    const ex = EXAMPLES[Number(els.examplesSelect.value)];
    if (!ex) return;
    clearRows();
    els.problemText.value = ex.problem;
    ex.rows.forEach(function (r) { addRow(r); });
    selectFormula(ex.formulaId, ex.target);
    updateMatches();
  }

  function startOver() {
    clearRows();
    addRow();
    els.problemText.value = '';
    els.examplesSelect.selectedIndex = 0;
    els.formulaSelect.value = '';
    els.formulaInfo.textContent = '';
    els.targetSelect.textContent = '';
    els.targetNote.textContent = '';
    els.targetNote.classList.remove('error');
    els.convertPreview.textContent = '';
    els.substitutePreview.textContent = '';
    els.resultBox.textContent = '';
    els.stepsList.textContent = '';
    els.matchList.textContent = '';
    setStep(1);
  }

  // ---- Boot ---------------------------------------------------------------------
  function init() {
    EXAMPLES.forEach(function (ex, i) {
      els.examplesSelect.appendChild(option(ex.name, String(i)));
    });
    populateFormulaSelect();
    addRow();
    els.addVariable.addEventListener('click', function () { addRow(); });
    els.loadExample.addEventListener('click', loadExample);
    els.startOver.addEventListener('click', startOver);
    els.prev.addEventListener('click', goPrev);
    els.next.addEventListener('click', goNext);
    els.formulaSelect.addEventListener('change', function () {
      renderFormulaInfo();
      populateTargetSelect();
    });
    setStep(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();