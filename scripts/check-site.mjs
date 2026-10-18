import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SITE = path.join(ROOT, "_site");
const baseurl = process.env.SITE_BASEURL || "";
const errors = [];
const pages = [];

async function walk(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) await walk(filename);
    else if (entry.name.endsWith(".html")) pages.push(filename);
  }
}

await walk(SITE);
const parsed = new Map();
for (const filename of pages) parsed.set(filename, load(await fs.readFile(filename, "utf8")));
let targets = 0;
for (const [filename, $] of parsed) {
  const label = path.relative(SITE, filename);
  const fail = (message) => errors.push(`${label}: ${message}`);
  if ($("h1").length !== 1) fail("Stránka musí mít právě jeden H1.");
  if (!$("meta[name=description]").attr("content")) fail("Chybí popis stránky.");
  if (!$('a[href="#obsah"]').length) fail("Chybí odkaz pro přeskočení navigace.");
  const ids = new Set();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id");
    if (ids.has(id)) fail(`Duplicitní id: ${id}`);
    ids.add(id);
  });
  $("img").each((_, el) => {
    const image = $(el);
    if (!image.attr("alt") && !image.closest(".site-header__brand").length) fail(`Chybí popis obrázku: ${image.attr("src")}`);
    if (!(Number(image.attr("width")) > 0 && Number(image.attr("height")) > 0)) fail(`Neplatné rozměry: ${image.attr("src")}`);
    if (image.closest("main").length && !image.closest(".home-about__map").length && image.attr("loading") !== "lazy") fail("Obrázek pod úvodem nemá lazy loading.");
  });
  $("[data-entry], .content-card").each((_, el) => {
    if (!$(el).find("h2,h3").length) fail("Karta nemá nadpis.");
    if (!$(el).text().trim() && !$(el).find("img").length) fail("Prázdná karta.");
  });
  for (const el of $("a[href], img[src], script[src], link[href]").toArray()) {
    const node = $(el);
    const raw = node.attr("href") || node.attr("src");
    if (!raw || /^(https?:|mailto:|data:|tel:)/.test(raw)) continue;
    targets++;
    const url = new URL(raw, `https://local.test${baseurl}/${label.replaceAll(path.sep, "/")}`);
    let pathname = decodeURIComponent(url.pathname);
    if (baseurl && !pathname.startsWith(baseurl + "/")) {
      fail(`Cíl mimo baseurl: ${raw}`);
      continue;
    }
    pathname = pathname.slice(baseurl.length);
    let target = path.join(SITE, ...pathname.split("/").filter(Boolean));
    if (url.pathname.endsWith("/")) target = path.join(target, "index.html");
    try {
      await fs.access(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      fail(`Nedostupný lokální cíl: ${raw}`);
      continue;
    }
    if (url.hash && parsed.has(target) && !parsed.get(target)(`[id="${decodeURIComponent(url.hash.slice(1))}"]`).length) fail(`Neexistující kotva: ${raw}`);
    const srcset = node.attr("srcset");
    if (srcset) {
      for (const candidate of srcset.split(",").map((value) => value.trim().split(/\s+/)[0])) {
        const variant = decodeURIComponent(candidate).slice(baseurl.length);
        try { await fs.access(path.join(SITE, ...variant.split("/").filter(Boolean))); }
        catch (error) {
          if (error.code !== "ENOENT") throw error;
          fail(`Chybí responzivní obrázek: ${candidate}`);
        }
      }
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`OK: ${pages.length} stránek, ${targets} lokálních odkazů a zdrojů; nadpisy, obrázky a kotvy v pořádku.`);
}
