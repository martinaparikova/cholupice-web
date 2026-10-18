import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGES = ["aktuality", "cholupicky-statek", "dokoncene-cinnosti", "kulturni-dum"];
const classNames = {
  "wp-block-image": "media-block",
  "wp-block-group": "media-group",
  "wp-block-group__inner-container": "media-group__inner",
  "wp-block-gallery": "media-gallery",
  "blocks-gallery-grid": "gallery-grid",
  "blocks-gallery-item": "gallery-item",
};
const descriptions = {
  aktuality: "Zprávy, sousedské akce a projekty v Cholupicích. Vyhledejte téma nebo záznamy z konkrétního roku.",
  "cholupicky-statek": "Vývoj záměru v Cholupickém statku, stanoviska městské části a možnosti zapojení obyvatel.",
  "dokoncene-cinnosti": "Archiv činnosti sdružení a starších zpráv z Cholupic. Vyhledávání podle tématu a uvedeného roku.",
};

export function compact(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function slug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zaznam";
}

export function mentionedYears(value) {
  return [...new Set(value.replace(/\bANO\s+2011\b/g, "ANO").match(/\b20\d{2}\b/g) || [])].sort().reverse();
}

export function entryYears($, card) {
  const text = card.find("h2,h3,p,li,figcaption").map((_, node) => $(node).text()).get().join(" ");
  return mentionedYears(text);
}

async function normalizeAssetNames() {
  for (const folder of ["images", "files"]) {
    const directory = path.join(ROOT, "assets", folder);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const normalized = entry.name.normalize("NFC");
      if (!entry.isFile() || normalized === entry.name) continue;
      const destination = path.join(directory, normalized);
      try {
        await fs.access(destination);
        throw new Error(`Kolize normalizovaných názvů: ${entry.name}`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      await fs.rename(path.join(directory, entry.name), destination);
    }
  }
}

export function relativeAssets(html) {
  return html.replace(/\b(href|src)="(\/[^"]*)"/g, (_, name, url) => `${name}="{{ '${url}' | relative_url }}"`)
    .replace(/\bsrcset="([^"]*)"/g, (_, value) => `srcset="${value.replace(/(^|, )(\S+)( \d+w)/g,
      (match, prefix, url, size) => url.startsWith("/") ? `${prefix}{{ '${url}' | relative_url }}${size}` : match)}"`);
}

const imageCache = new Map();
async function variants(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const source = path.join(ROOT, ...decodeURIComponent(url).normalize("NFC").split("/").filter(Boolean));
  const buffer = await fs.readFile(source);
  const metadata = await sharp(buffer).metadata();
  const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  if (!width || !height) throw new Error(`Chybí rozměry obrázku: ${url}`);
  const hash = createHash("sha256").update(buffer).update("webp-78-v1").digest("hex").slice(0, 16);
  const sizes = [...new Set([Math.min(320, width), Math.min(640, width)])];
  const entries = [];
  for (const size of sizes) {
    const name = `${hash}-${size}.webp`;
    const destination = path.join(ROOT, "assets", "images", "optimized", name);
    const output = await sharp(buffer).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    let existing;
    try { existing = await fs.readFile(destination); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!existing || !existing.equals(output)) await fs.writeFile(destination, output);
    entries.push({ url: `/assets/images/optimized/${name}`, width: size });
  }
  const result = { width, height, entries };
  imageCache.set(url, result);
  return result;
}

function cleanMarkup($) {
  $("meta, script").remove();
  $("img").each((_, el) => {
    const image = $(el);
    if (/^https:\/\/static\.xx\.fbcdn\.net\//.test(image.attr("src") || "")) image.replaceWith(image.attr("alt") || "");
  });
  $("*").each((_, el) => {
    const node = $(el);
    for (const attr of Object.keys(el.attribs || {})) {
      if (/^data-(id|full-url|link)$/.test(attr) || attr === "style") node.removeAttr(attr);
    }
    if (node.attr("class")) {
      const classes = node.attr("class").split(/\s+/).map((name) => classNames[name] || name)
        .filter((name) => !/^(wp-image-|size-|aligncenter$|is-resized$|is-cropped$|columns-)/.test(name));
      if (classes.length) node.attr("class", classes.join(" "));
      else node.removeAttr("class");
    }
    if ((node.attr("id") || "").startsWith("block-")) node.removeAttr("id");
  });
  for (let pass = 0; pass < 3; pass++) {
    $("p, li, ul, ol").each((_, el) => {
      const node = $(el);
      if (!compact(node.text()) && !node.find("img").length) node.remove();
    });
  }
  $("a[href]").each((_, el) => {
    const link = $(el);
    const href = link.attr("href");
    const linkNames = [
      ["gov.cz/e-petice/1192", "petice pro zachování linky 190"],
      ["Cholupice-znak-a-vlajka", "návrhy znaku a vlajky Cholupic (PDF)"],
      ["uklidmecesko.cz/event/28046", "podrobnosti úklidu Cholupic 27. 3. 2021"],
      ["sezn", "seznámení s problematikou Cholupic (PDF)"],
      ["tvorime-dvanactku-2021/vysledky", "výsledky participativního rozpočtu 2021"],
    ];
    if (/^zde$/i.test(compact(link.text()))) {
      const name = linkNames.find(([part]) => decodeURIComponent(href).includes(part));
      if (name) link.text(name[1]);
    }
    if (href.startsWith("http")) {
      const url = new URL(href);
      ["fbclid", "themeRefresh"].forEach((key) => url.searchParams.delete(key));
      link.attr("href", url.href);
    }
    if (/Nahled-Petice\.jpeg|03_zaklady\.pdfdf|^http:\/\/3\.6\.7\.227/.test(href)) {
      const replacement = $("<span></span>").text(`${link.text()} (původní dokument není dostupný)`);
      link.replaceWith(replacement);
    } else if (link.attr("target") === "_blank") {
      link.attr("rel", "noopener");
      if (!link.children(".visually-hidden").length) link.append('<span class="visually-hidden"> (otevře se v nové kartě)</span>');
    }
  });
}

export function sectionCards($) {
  if ($(".content-sections").length) return;
  const nodes = $.root().children().toArray();
  const container = $('<div class="content-sections"></div>');
  let card;
  let previous;
  for (const node of nodes) {
    const el = $(node);
    const heading = el.is("h2,h3");
    const starts = !card || (heading && !/^h[23]$/.test(previous)) || (el.is("ul") && previous && !/^(p|h2|h3)$/.test(previous));
    if (starts) {
      card = $('<section class="content-card"></section>');
      container.append(card);
    }
    card.append(el);
    previous = node.tagName;
  }
  $.root().append(container);
}

function addHeadings($, collection) {
  const ids = new Set($("[id]").toArray().map((node) => $(node).attr("id")));
  const cards = collection ? $("[data-entry], .update-card, .content-card") : $(".content-card");
  cards.each((index, el) => {
    const card = $(el);
    let heading = card.children("h2,h3").first();
    if (!heading.length) heading = card.find(".update-card__copy > h2").first();
    if (!heading.length) {
      const first = card.find("li").first();
      const lead = first.clone().children("ul,ol").remove().end();
      let title = compact(lead.find("strong").first().text() || lead.text());
      if (!title) title = compact(card.find("figcaption").first().text()) || "Fotografie k činnosti sdružení";
      if (title.length > 105) title = title.slice(0, 102).replace(/\s+\S*$/, "") + "…";
      heading = $("<h2></h2>").text(title);
      card.prepend(heading);
    }
    if (!heading.attr("id")) {
      const base = slug(heading.text());
      let id = base;
      let suffix = 2;
      while (ids.has(id)) id = `${base}-${suffix++}`;
      heading.attr("id", id);
      ids.add(id);
    }
    const firstList = card.children("ul").first();
    if (firstList.children("li").length === 1) {
      const item = firstList.children("li").first();
      const lead = item.clone().children("ul,ol").remove().end();
      if (!lead.find("img,a").length && compact(lead.text()) === compact(heading.text())) {
        const nested = item.children("ul,ol");
        nested.remove();
        if (nested.length) firstList.replaceWith(nested);
        else firstList.remove();
      }
    }
    if (collection) {
      card.attr("data-entry", "").attr("data-years", entryYears($, card).join(" "));
      heading.addClass("entry-heading");
      if (!heading.children("a").length) heading.wrapInner(`<a href="#${heading.attr("id")}"></a>`);
    }
  });
}

async function images($) {
  for (const el of $("img").toArray()) {
    const image = $(el);
    const parentLink = image.closest("a");
    const original = parentLink.attr("href")?.startsWith("/assets/images/")
      ? parentLink.attr("href") : image.attr("src");
    if (!original?.startsWith("/assets/images/")) continue;
    const data = await variants(original);
    image.attr("width", String(data.width)).attr("height", String(data.height)).attr("loading", "lazy").attr("decoding", "async");
    if (!image.attr("alt")) {
      const card = image.closest(".content-card, .update-card");
      const caption = compact(image.closest("figure").find("figcaption").text());
      const context = compact(card.find("h2,h3").first().text());
      image.attr("alt", compact([context, caption].filter(Boolean).join(" – ")).slice(0, 180) || "Fotografie z Cholupic");
    }
    const projectSheet = original.match(/\/projekt-(\d)-/);
    if (projectSheet) image.attr("alt", `Prezentace záměru DSS v Cholupickém statku – list ${projectSheet[1]}`);
    if (original.includes("Screen-Shot-2021-06-07")) image.attr("alt", "Vybraný návrh znaku a vlajky Cholupic – autor Ing. Arnošt Drozd");
    const entries = data.entries;
    image.attr("src", entries[0].url)
      .attr("srcset", entries.map((entry) => `${entry.url} ${entry.width}w`).join(", "))
      .attr("sizes", "(max-width: 42rem) calc(100vw - 4rem), 320px");
    if (!parentLink.length) {
      image.wrap($('<a class="image-link"></a>').attr("href", original));
    }
    const link = image.closest("a");
    link.addClass("image-link").attr("aria-label", `Zvětšit obrázek: ${image.attr("alt")}`);
  }
}

async function preparePage(folder) {
  const filename = path.join(ROOT, folder, "index.md");
  const source = await fs.readFile(filename, "utf8");
  const match = source.normalize("NFC").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`Chybí front matter: ${filename}`);
  let front = match[1];
  const collection = folder === "aktuality" || folder === "dokoncene-cinnosti";
  const body = match[2].replace(/\s*{% include collection-controls\.html %}\s*/g, "")
    .replace(/{{ '([^']+)' \| relative_url }}/g, "$1");
  const $ = load(body, null, false);
  cleanMarkup($);
  if (folder !== "aktuality") sectionCards($);
  addHeadings($, collection);
  await images($);
  let output;
  if (collection) {
    const entries = folder === "aktuality" ? $(".updates") : $(".content-sections");
    entries.addClass("collection-entries").attr("id", "collection-entries");
    if (!$("[data-collection]").length) {
      entries.wrap('<div data-collection></div>');
      const wrapper = $("[data-collection]");
      wrapper.prepend('<p class="collection-intro"></p>');
      wrapper.find(".collection-intro").text(folder === "aktuality"
        ? "Nové zprávy i starší oznámení. U dlouhodobých projektů zachováváme také původní plány; datum v textu nemusí znamenat datum dokončení."
        : "Starší zprávy a činnost sdružení. Záznamy zachycují stav v době zveřejnění, nikoli nutně dnešní situaci.");
    }
    $(".collection-status, .collection-controls, [data-empty]").remove();
    entries.before("{% include collection-controls.html %}\n");
    output = $.root().html();
  } else {
    if (folder === "cholupicky-statek" && !$(".section-index").length) {
      const nav = $('<nav class="section-index" aria-label="Na této stránce"><p><strong>Na této stránce</strong></p><ul></ul></nav>');
      $(".content-card > h2").each((_, heading) => {
        nav.find("ul").append($("<li></li>").append($("<a></a>").attr("href", `#${$(heading).attr("id")}`).text($(heading).text())));
      });
      $.root().prepend(nav);
    }
    output = $.root().html();
  }
  if (descriptions[folder] && !/^description:/m.test(front)) front += `\ndescription: "${descriptions[folder]}"`;
  if (collection && !/^wide:/m.test(front)) front += "\nwide: true";
  output = output.trim().replace(/<\/section>\s*/g, "</section>\n");
  const result = `---\n${front}\n---\n\n${relativeAssets(output)}\n`;
  if (result !== source) await fs.writeFile(filename, result);
}

async function prepareFigures(folder) {
  const filename = path.join(ROOT, folder, "index.md");
  const source = await fs.readFile(filename, "utf8");
  let output = "";
  let end = 0;
  for (const match of source.matchAll(/<figure\b[\s\S]*?<\/figure>/g)) {
    output += source.slice(end, match.index);
    const $ = load(match[0].normalize("NFC").replace(/{{ '([^']+)' \| relative_url }}/g, "$1"), null, false);
    await images($);
    output += relativeAssets($.root().html());
    end = match.index + match[0].length;
  }
  output += source.slice(end);
  if (output !== source) await fs.writeFile(filename, output);
}

async function run() {
  await normalizeAssetNames();
  for (const folder of PAGES) await preparePage(folder);
  await prepareFigures("ostatni");
  console.log(`Připraveno ${PAGES.length + 1} stránek a ${imageCache.size} obrázků.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => { console.error(error); process.exitCode = 1; });
}
