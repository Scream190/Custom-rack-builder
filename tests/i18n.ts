// English translation checks. Run: npm run test:i18n
import { setLangForTests, tr, trMarkup } from '../src/i18n';
import { EN, EN_TPL } from '../src/i18n/en';
import { EN_EXTRA_TPL } from '../src/i18n/enExtra';
import { DEVICE_CATEGORIES } from '../src/library/devices';
import { CONNECTORS } from '../src/model/connectors';

let failed = false;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed = true; console.log('  FAIL', msg); } };

setLangForTests('en');
// every template keeps its placeholders
for (const [de, en] of [...EN_TPL, ...EN_EXTRA_TPL]) {
  const a = (de.match(/\{\d+\}/g) ?? []).sort().join(), b = (en.match(/\{\d+\}/g) ?? []).sort().join();
  ok(a === b, `template placeholders differ: "${de}" → "${en}"`);
}
// translations must not still contain obvious German
const GERMAN = /[äöüÄÖÜß]|\b(und|oder|nicht|für|mit|der|die|das)\b/;
for (const [de, en] of Object.entries(EN)) ok(!GERMAN.test(en) || /Schaeffer|Kanal \/ Name/.test(en), `"${de}" → "${en}" still looks German`);
// samples: exact, whitespace, template, nested template argument, phrase inside a longer text, generated names
const cases: [string, string][] = [
  ['Kabel löschen', 'Delete cable'], [' Ausschnitte', ' Cut-outs'], ['Einlage „Bühne“ löschen?', 'Delete inlay “Bühne”?'],
  ['12 von 16 HE', '12 of 16 U'], ['W024, Kaltgeräte IEC, 1 m', 'W024, IEC mains, 1 m'], ['Shure ULXD1 Taschensender', 'Shure ULXD1 Bodypack transmitter'],
  ['Rückdeckel: Rahmen seitlich', 'Rear lid: frame sides'], ['Ober- und Unterseite Korpus', 'top and bottom of the body'], ['Rack 1', 'Rack 1'],
];
for (const [de, en] of cases) ok(tr(de) === en, `tr("${de}") = "${tr(de)}", expected "${en}"`);
for (const c of DEVICE_CATEGORIES) ok(!GERMAN.test(tr(c)), `category "${c}" → "${tr(c)}"`);
for (const c of Object.values(CONNECTORS)) ok(!/[äöüß]|Kaltgeräte|Klinke|Durchführung|-pol/.test(tr(c.label)), `connector "${c.label}" → "${tr(c.label)}"`);
ok(trMarkup('<text>Vorderansicht</text><g title="Kabel löschen"></g>') === '<text>Front view</text><g title="Delete cable"></g>', 'markup translation');
setLangForTests('de');
ok(tr('Kabel löschen') === 'Kabel löschen', 'German stays German');
console.log(`i18n: ${Object.keys(EN).length} texts, ${EN_TPL.length + EN_EXTRA_TPL.length} templates`);
if (failed) { console.error('i18n: problems found'); process.exit(1); }
console.log('i18n: ok');
