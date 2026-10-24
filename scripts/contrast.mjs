// WCAG contrast for the design tokens used as text/UI colors, light and dark.
const L = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const light = { desk: "#dedad3", surface: "#ffffff", surface2: "#f4f2ee", sunk: "#d3cec6", active: "#cfc9c0", text: "#0a0a0a", muted: "#56524c", tickText: "#1f5f70", tickSoft: "#e3eef0", tickFill: "#256f82", penText: "#a8291f", penSoft: "#fbe4e0", line: "#7d776d", primary: "#0a0a0a", onPrimary: "#ffffff" };
const dark = { desk: "#111111", surface: "#1a1a1a", surface2: "#222222", sunk: "#0a0a0a", active: "#262626", text: "#efeeec", muted: "#b4b0a8", tickText: "#7fc6d6", tickSoft: "#16292e", tickFill: "#256f82", penText: "#ff8d82", penSoft: "#3a1f1c", line: "#77726a", primary: "#efeeec", onPrimary: "#111111" };
let bad = 0;
for (const [n, t] of [["light", light], ["dark", dark]]) {
  const pairs = [
    ["text/desk", t.text, t.desk, 4.5], ["text/surface", t.text, t.surface, 4.5], ["text/active", t.text, t.active, 4.5], ["muted/desk", t.muted, t.desk, 4.5], ["muted/surface", t.muted, t.surface, 4.5], ["muted/surface2", t.muted, t.surface2, 4.5], ["muted/sunk (stage caption)", t.muted, t.sunk, 4.5],
    ["tickText/desk", t.tickText, t.desk, 4.5], ["tickText/surface", t.tickText, t.surface, 4.5], ["tickText/tickSoft", t.tickText, t.tickSoft, 4.5],
    ["penText/desk", t.penText, t.desk, 4.5], ["penText/surface", t.penText, t.surface, 4.5], ["penText/penSoft", t.penText, t.penSoft, 4.5],
    ["text/penSoft", t.text, t.penSoft, 4.5], ["text/tickSoft", t.text, t.tickSoft, 4.5],
    ["white on tickFill (landing action, CTA field)", "#ffffff", t.tickFill, 4.5], ["onPrimary on primary (app action)", t.onPrimary, t.primary, 4.5],
    ["control border/surface (UI 3:1)", t.line, t.surface, 3], ["control border/surface2 (UI 3:1)", t.line, t.surface2, 3],
    ["ink on highlighter", "#0a0a0a", "#f2d15c", 4.5],
    // Selected-state indicators (WCAG 1.4.11): the 2px ink bar against what it sits on.
    ["tab indicator/selected tab", t.text, t.surface2, 3], ["tab indicator/sheet", t.text, t.surface, 3], ["nav indicator/desk", t.text, t.desk, 3], ["filter underline/sheet", t.text, t.surface, 3], ["selected template ring/sheet", t.tickFill, t.surface, 3],
  ];
  for (const [name, a, b, min] of pairs) { const r = cr(a, b); const ok = r >= min; if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"} ${n} ${name} ${r.toFixed(2)} (min ${min})`); }
}
// The showcase's dark field is the same in both themes.
for (const [name, a, b, min] of [["on-dark/field", "#efeeec", "#0a0a0a", 4.5], ["field label/field", "#c9c5bd", "#0a0a0a", 4.5], ["field input border/field (UI 3:1)", "#77726a", "#0a0a0a", 3]]) { const r = cr(a, b); const ok = r >= min; if (!ok) bad++; console.log(`${ok ? "PASS" : "FAIL"} showcase ${name} ${r.toFixed(2)} (min ${min})`); }
console.log(bad ? `${bad} failing` : "all pairs pass");
process.exit(bad ? 1 : 0);
