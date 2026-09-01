((scope) => {
  'use strict';

  // Storage and all training math remain canonical pounds. This module is the
  // only display/input boundary for the profile-level weight-unit preference.
  const POUNDS_PER_KILOGRAM = 2.2046226218;
  const UNITS = new Set(['lb', 'kg']);
  const finite = value => value !== '' && value != null && Number.isFinite(Number(value));
  const preference = value => Object.freeze({
    contractVersion: 1,
    weightUnit: UNITS.has(value?.weightUnit) ? value.weightUnit : 'lb'
  });
  const unitFor = state => preference(state?.unitPreferences).weightUnit;
  const effectiveUnitFor = (activeWorkout, state) => UNITS.has(activeWorkout?.displayUnitOverride)
    ? activeWorkout.displayUnitOverride
    : unitFor(state);
  const displayUnit = (state, override) => UNITS.has(override) ? override : unitFor(state);
  const round = (value, digits) => {
    const power = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * power) / power;
  };
  const displayDigits = ({ workload = false } = {}) => workload ? 0 : 1;

  function fromCanonicalPounds(value, unit = 'lb', options = {}) {
    if (value === '' || value == null) return '';
    if (!finite(value)) return null;
    const converted = unit === 'kg' ? Number(value) / POUNDS_PER_KILOGRAM : Number(value);
    return round(converted, options.digits ?? displayDigits(options));
  }

  function toCanonicalPounds(value, unit = 'lb') {
    if (value === '' || value == null) return '';
    if (typeof value === 'string' && !/^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*$/.test(value)) return null;
    if (!finite(value)) return null;
    return unit === 'kg' ? Number(value) * POUNDS_PER_KILOGRAM : Number(value);
  }

  function formatNumber(value, { digits = 1, compact = false } = {}) {
    if (!finite(value)) return '—';
    if (compact && Math.abs(Number(value)) >= 1000) {
      return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value));
    }
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
      useGrouping: true
    }).format(Number(value));
  }

  function formatLoad(value, state, { suffix = '', digits = 1, unit = null } = {}) {
    if (!finite(value)) return '—';
    const shownUnit = displayUnit(state, unit);
    return `${formatNumber(fromCanonicalPounds(value, shownUnit, { digits }), { digits })} ${shownUnit}${suffix}`;
  }

  function formatBodyweight(value, state) {
    return formatLoad(value, state, { digits: 1 });
  }

  function formatWorkload(value, state, { kind = null, compact = false, unit = null } = {}) {
    if (!finite(value)) return '—';
    const shownUnit = displayUnit(state, unit);
    const shown = fromCanonicalPounds(value, shownUnit, { workload: true });
    const qualifier = kind === 'indicated_load' ? 'indicated '
      : kind === 'modeled_system_load' ? 'modeled '
        : '';
    return `${formatNumber(shown, { digits: 0, compact })} ${qualifier}${shownUnit}`;
  }

  function inputValue(value, state, { unit = null } = {}) {
    if (value === '' || value == null) return '';
    return fromCanonicalPounds(value, displayUnit(state, unit), { digits: 3 });
  }

  function inputStep(canonicalStep, state, { unit = null } = {}) {
    if (!finite(canonicalStep) || Number(canonicalStep) <= 0) return 0.1;
    return displayUnit(state, unit) === 'kg'
      ? Math.max(0.1, round(Number(canonicalStep) / POUNDS_PER_KILOGRAM, 1))
      : Number(canonicalStep);
  }

  function parseInput(value, state, { allowZero = false } = {}) {
    const canonical = toCanonicalPounds(value, unitFor(state));
    if (canonical === '') return Object.freeze({ ok: false, blank: true, value: '' });
    if (canonical === null || canonical < 0 || (!allowZero && canonical === 0)) {
      return Object.freeze({ ok: false, malformed: canonical === null, value: null });
    }
    return Object.freeze({ ok: true, value: canonical });
  }

  Object.defineProperty(scope, 'BigGainsUnits', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({
      POUNDS_PER_KILOGRAM,
      preference,
      unitFor,
      effectiveUnitFor,
      fromCanonicalPounds,
      toCanonicalPounds,
      formatNumber,
      formatLoad,
      formatBodyweight,
      formatWorkload,
      inputValue,
      inputStep,
      parseInput
    }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
