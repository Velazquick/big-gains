((scope) => {
  'use strict';
  const names = Object.freeze(['volt', 'cobalt', 'merlot', 'rose', 'violet', 'ember']);
  const legacy = ['ember', 'cobalt', 'merlot', 'rose'];
  // Primary is the filled-control color; ink is independently readable text.
  const palette = (name, primary, bright, ink, on, lightPrimary, lightInk) => Object.freeze({
    name, dark: Object.freeze({ primary, bright, ink, on }),
    light: Object.freeze({ primary: lightPrimary, bright: lightPrimary, ink: lightInk, on: name === 'Volt' ? '#111111' : '#ffffff' })
  });
  const palettes = Object.freeze({
    volt: palette('Volt', '#d8ff3e', '#e7ff8c', '#d8ff3e', '#111111', '#d8ff3e', '#4d6100'),
    cobalt: palette('Cobalt', '#62a8ff', '#a0ccff', '#62a8ff', '#111111', '#175fbd', '#175fbd'),
    merlot: palette('Merlot', '#801616', '#c65575', '#e58ba4', '#ffffff', '#801616', '#9d264c'),
    rose: palette('Rose', '#c85f98', '#f4badb', '#f09bc8', '#111111', '#a9477e', '#a9477e'),
    violet: palette('Violet', '#a78bfa', '#d2c2ff', '#bba6ff', '#111111', '#6d36c4', '#6d36c4'),
    ember: palette('Ember', '#ff783e', '#ffba8e', '#ff986a', '#111111', '#a83d12', '#a83d12')
  });
  function normalize(value) {
    const version = value?.version ?? value?.accentVersion ?? value?.accent_version ?? 0;
    if (![0, 1].includes(version)) return null;
    if (!(version === 1 ? names : legacy).includes(value?.accent)) return null;
    return Object.freeze({ accent: value.accent, version });
  }
  function resolve(value) {
    const valid = normalize(value);
    return valid ? valid.version === 0 && valid.accent === 'ember' ? 'volt' : valid.accent : 'cobalt';
  }
  function tokens(accent, light = false) {
    const p = palettes[names.includes(accent) ? accent : 'cobalt'][light ? 'light' : 'dark'];
    const rgb = p.ink.slice(1).match(/../g).map(x => parseInt(x, 16)).join(',');
    return Object.freeze({ ...p, rgb, soft: `rgba(${rgb},.10)`, border: `rgba(${rgb},.50)`, borderSoft: `rgba(${rgb},.30)`, chart: p.ink });
  }
  scope.BigGainsAppearanceModel = Object.freeze({ names, palettes, normalize, resolve, tokens });
})(typeof window === 'undefined' ? globalThis : window);
