import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { load } from "cheerio";
import { entryYears } from "./prepare-content.mjs";

const readPage = async (folder) => {
  const source = await fs.readFile(new URL(`../${folder}/index.md`, import.meta.url), "utf8");
  return load(source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/{{ '([^']+)' \| relative_url }}/g, "$1"), null, false);
};
const archive = await readPage("dokoncene-cinnosti");
const news = await readPage("aktuality");
const cards = news("[data-entry]").toArray();
const indexOf = (text) => {
  const index = cards.findIndex((card) => news(card).find("h2").first().text().includes(text));
  assert.notEqual(index, -1, `Missing news entry: ${text}`);
  return index;
};

test("archive contains no dated entries from 2024 onwards", () => {
  archive("[data-entry]").each((_, card) => {
    assert.ok(entryYears(archive, archive(card)).every((year) => Number(year) <= 2023),
      archive(card).find("h2,h3").first().text());
  });
});

test("recent archive updates are placed between their chronological neighbours", () => {
  assert.ok(indexOf("8.8.2025") < indexOf("31.7.2025"));
  assert.ok(indexOf("31.7.2025") < indexOf("22.7.2025"));
  assert.ok(indexOf("zpracování podkladové studie") < indexOf("28.1.2025"));
  assert.ok(indexOf("28.1.2025") < indexOf("19.1.2025"));
  assert.ok(indexOf("27.11.2024") < indexOf("Podzim 2024:"));
  assert.ok(indexOf("Podzim 2024:") < indexOf("31.8.2024"));
});

test("mixed road history retains both photos without attributing them to the later reconstruction", () => {
  const history = archive("#oprava-vytluku-v-ulici-ke-kalku").closest("[data-entry]");
  const update = news("#podzim-2024-rekonstrukce-povrchu-ulice-ke-kalku").closest("[data-entry]");
  assert.match(history.text(), /2019/);
  assert.match(history.text(), /2020/);
  assert.doesNotMatch(history.text(), /2024/);
  assert.equal(history.find("img").length, 2);
  assert.equal(history.find("figcaption").text(), "PoPřed");
  assert.equal(update.find("img").length, 0);
  assert.equal(news(cards[indexOf("31.7.2025")]).find("img").length, 2);
});

test("undated fence repair is not assigned the neighbouring airport update date", () => {
  const repair = archive("#oprava-oploceni-detskeho-hriste").closest("[data-entry]");
  assert.equal(repair.length, 1);
  assert.equal(repair.find("img").length, 2);
  assert.equal(repair.attr("data-years"), "");
  assert.doesNotMatch(repair.text(), /28\.1\.2025/);
  assert.equal(news(cards[indexOf("28.1.2025")]).find("img").length, 0);
});
