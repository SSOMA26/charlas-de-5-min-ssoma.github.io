const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const context = {
  console,
  Date,
  Blob,
  Uint8Array,
  window: {},
  document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: {},
  location: { protocol: "http:" },
  URL,
  setTimeout,
  clearTimeout
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/data.js"), "utf8"), context);

let source = fs.readFileSync(path.join(root, "assets/js/app.js"), "utf8");
source = source.replace(
  'document.addEventListener("DOMContentLoaded", init);',
  'globalThis.__ssomaTest = { eligibleDates, buildNovember, buildDecember, formatDate, parseLocalDate };'
);
vm.runInContext(source, context);

const { eligibleDates, buildNovember, buildDecember } = context.__ssomaTest;
const november = buildNovember();
const december = buildDecember();

assert.strictEqual(context.window.SSOMA_TOPICS.length, 26, "Debe haber 26 temas");
assert.strictEqual(eligibleDates(2026, 10, 2).length, 25, "Noviembre debe tener 25 jornadas");
assert.strictEqual(november.length, 25, "Noviembre debe tener 25 fechas");
assert.strictEqual(november.flatMap(day => day.sessions).length, 26, "Noviembre debe programar 26 charlas");
assert.strictEqual(november[0].date, "2026-11-02");
assert.strictEqual(november.at(-1).date, "2026-11-30");
assert.deepStrictEqual(Array.from(november.at(-1).sessions, item => item.topicId), [25, 26]);
assert.ok(november.every(day => new Date(`${day.date}T12:00:00`).getDay() !== 0), "No debe incluir domingos");
assert.strictEqual(december.length, 27, "Diciembre debe tener 27 jornadas");
assert.strictEqual(december.flatMap(day => day.sessions).length, 27, "Diciembre debe tener 27 charlas");
assert.ok(december.every(day => new Date(`${day.date}T12:00:00`).getDay() !== 0), "Diciembre no debe incluir domingos");
assert.deepStrictEqual(Array.from(new Set(december.flatMap(day => day.sessions.map(item => item.topicId)))).sort((a,b) => a-b), Array.from({ length: 26 }, (_, index) => index + 1));
assert.strictEqual(december.at(-1).sessions[0].topicId, 7, "El 31 de diciembre debe ser el refuerzo del tema 7");

console.log("Logic tests: OK");
console.log(`November: ${november.length} days, ${november.flatMap(day => day.sessions).length} sessions`);
console.log(`December: ${december.length} days, ${december.flatMap(day => day.sessions).length} sessions`);
