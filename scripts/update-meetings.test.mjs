import test from "node:test";
import assert from "node:assert/strict";
import { addLinks, buildLi, ensureYearChip, meetingGroups, parseMeetingItems } from "./update-meetings.mjs";

const date = { day: 15, month: 9, year: 2026 };
const title = "Dodatek č. 3 ke smlouvě o pachtu pozemků v k. ú. Cholupice a v k. ú. Točná";
const row = (tag = "strong", prefix = "") => `<tr><td align="left"><${tag}>${title}</${tag}><br>
${prefix}<a href="/assets/File.ashx?id_org=80112&amp;id_dokumenty=120778">R-177-004-26</a>
<a href="#">Hlasování</a><div><ul><li>Jméno</li></ul></div></td></tr>`;
const html = `<div id="dokument">${row()}</div>`;

test("extracts the document URL, not voting or meeting links", () => {
  const [item] = parseMeetingItems(html);
  assert.equal(item.title, title);
  assert.equal(item.url, "https://www.praha12.cz/assets/File.ashx?id_org=80112&id_dokumenty=120778");
  assert.equal(parseMeetingItems(`<div id="dokument">${row("b", "Materiál č. ")}`)[0].code, item.code);
  const rendered = buildLi(date, [item]);
  assert.match(rendered, /&amp;id_dokumenty=120778/);
  assert.match(rendered, /target="_blank" rel="noopener"/);
});

test("rejects missing or unexpected document markup", () => {
  assert.throws(() => parseMeetingItems("<html></html>"), /Chybí obsah/);
  assert.throws(() => parseMeetingItems('<div id="dokument">empty</div>'), /Nepodařilo/);
  assert.throws(() => parseMeetingItems(html.replace("/assets/File.ashx", "https://example.org/file")), /Neočekávaný/);
});

test("preserves agenda titles without published material and emits a warning", (t) => {
  const warning = t.mock.method(console, "warn", () => {});
  const [item] = parseMeetingItems('<div id="dokument"><tr><td align="left"><b>Cholupice</b><br>Bez dokumentu</td></tr></div>');
  assert.equal(item.url, null);
  assert.equal(warning.mock.callCount(), 1);
  assert.equal(buildLi(date, [item]), "<li><strong>15.9.2026</strong> Cholupice</li>");
});

test("links exact titles only in the correct meeting and preserves existing content", () => {
  const items = parseMeetingItems(html);
  const group = (type, day) => `<ul data-meeting-group data-type="${type}" data-year="2026"><li><strong>${day}.9.2026</strong><ul><li>${title}</li><li>Ruční poznámka</li></ul></li></ul>`;
  const content = `${group("rada", 15)}\n${group("rada", 14)}\n${group("zastupitelstvo", 15)}\n<script>filter</script>`;
  assert.equal(meetingGroups(content).length, 3);
  const result = addLinks(content, "rada", date, items);
  assert.equal(result.count, 1);
  assert.equal(result.content.replace(/<a[^>]+>([^<]+)<\/a>/g, "$1"), content);
  assert.equal(addLinks(result.content, "rada", date, items).content, result.content);
  assert.equal(addLinks(content, "rada", date, [...items, ...items]).count, 0);
});

test("handles single items, entities and nested lists without truncating dates", () => {
  const item = { title: "Cholupice – pozemky & stavby", url: "https://www.praha12.cz/assets/File.ashx?id_dokumenty=1" };
  const content = '<ul data-meeting-group data-type="rada" data-year="2026"><li><strong>16.9.2026</strong><ul><li>Jiný bod</li></ul></li><li><strong>15.9.2026</strong> Cholupice &#8211; pozemky &amp; stavby</li></ul>\n<script></script>';
  const result = addLinks(content, "rada", date, [item]);
  assert.equal(result.count, 1);
  assert.match(result.content, />Cholupice &#8211; pozemky &amp; stavby<\/a>/);
});

test("supports accessible year controls and keeps new-year defaults in markup", () => {
  const source = '<div class="meetings-filter__chips" data-filter-group="year" role="group" aria-label="Rok jednání"><button data-value="2026">2026</button></div>';
  const updated = ensureYearChip(source, 2027);
  assert.match(updated, /role="group" aria-label="Rok jednání"/);
  assert.match(updated, /data-value="2027" aria-pressed="true"/);
  assert.match(updated, /data-value="2026" aria-pressed="false"/);
  assert.equal(ensureYearChip(updated, 2027), updated);
});

test("meeting groups stop before the new static end marker", () => {
  const group = '<ul data-meeting-group data-type="rada" data-year="2026"><li><strong>15.9.2026</strong> Cholupice</li></ul>';
  const content = `${group}\n<!-- /meeting-groups -->\n<p>Poznámka</p>`;
  assert.equal(meetingGroups(content)[0][0], group);
});
