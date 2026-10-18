import test from "node:test";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { compact, entryYears, mentionedYears, relativeAssets, sectionCards, slug } from "./prepare-content.mjs";

test("normalizes Czech anchors and extracts distinct years", () => {
  assert.equal(slug("Požár špýcharu (červenec 2026)"), "pozar-spycharu-cervenec-2026");
  assert.equal(compact("  Cholupice \n  Praha 12 "), "Cholupice Praha 12");
  assert.deepEqual(mentionedYears("Od 2025 do 2026, také 2025; 19 000 Kč."), ["2026", "2025"]);
  assert.deepEqual(mentionedYears("ANO 2011 – volby 2026"), ["2026"]);
});

test("creates static cards without detaching media or separating a heading from its list", () => {
  const $ = load("<h2>Téma</h2><h3>Podtéma</h3><ul><li>Text</li></ul><figure><img src='a.jpg'></figure><ul><li>Další téma</li></ul>", null, false);
  sectionCards($);
  assert.equal($(".content-card").length, 2);
  assert.equal($(".content-card").first().find("img").length, 1);
  assert.equal($(".content-card").first().find("ul").length, 1);
  const first = $.root().html();
  sectionCards($);
  assert.equal($.root().html(), first);
});

test("finds years at the end of adjacent list items without joining words", () => {
  const $ = load("<article><h2>Projekt</h2><ul><li>Plán na rok 2021</li><li>Další stav 2022</li></ul></article>", null, false);
  assert.deepEqual(entryYears($, $("article")), ["2022", "2021"]);
});

test("preserves external and anchor links and handles project-site image paths", () => {
  const html = '<a href="/assets/image.jpg"><img src="/assets/small.webp" srcset="/assets/small.webp 320w, /assets/large.webp 640w"></a><a href="#obsah">Obsah</a><a href="https://example.org/">Ven</a>';
  const output = relativeAssets(html);
  assert.match(output, /href="{{ '\/assets\/image.jpg' \| relative_url }}"/);
  assert.match(output, /{{ '\/assets\/large.webp' \| relative_url }} 640w/);
  assert.match(output, /href="#obsah"/);
  assert.match(output, /href="https:\/\/example.org\/"/);
});
