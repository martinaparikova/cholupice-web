#!/usr/bin/env node
/**
 * Doplní na stránku "Ze zasedání Rady a Zastupitelstva" nová jednání Rady MČ
 * a Zastupitelstva MČ Praha 12, které se týkají Cholupic a okolí.
 *
 * Jak to funguje:
 *  1. Z ze-zasedani-rady-a-zastupitelstva/index.md zjistí, jaké nejnovější
 *     datum jednání (zvlášť pro Radu a pro Zastupitelstvo) už na stránce je.
 *  2. Stáhne ze stránek praha12.cz seznam jednání (Usnesení Rady / Zápisy a
 *     materiály Zastupitelstva) a projde jej od nejnovějšího, dokud nenarazí
 *     na datum, které už máme.
 *  3. U každého takového (dosud chybějícího) jednání stáhne detail a najde
 *     body programu, jejichž název obsahuje "Cholupic..." (pokrývá všechny
 *     tvary: Cholupice, Cholupic, Cholupicích, Cholupický, Cholupickém, ...).
 *  4. Nalezené body doplní do odpovídajícího bloku (podle typu jednání a
 *     roku) na začátek seznamu (nejnovější nahoře), případně založí nový
 *     blok a tlačítko filtru pro nový rok.
 *
 * Bezpečné opakované spouštění: skript nikdy nemaže ani neupravuje stávající
 * záznamy, pouze přidává nové (podle data novější, než je to nejnovější
 * v souboru). Pokud žádné nové jednání s Cholupicemi nenajde, soubor
 * nezmění.
 *
 * Použití:  node scripts/update-meetings.mjs [--dry-run] [--add-links]
 * --add-links doplní ověřené odkazy i ke stávajícím bodům beze změny textu.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.praha12.cz";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const INDEX_FILE = path.join(ROOT, "ze-zasedani-rady-a-zastupitelstva", "index.md");
const DRY_RUN = process.argv.includes("--dry-run");
const ADD_LINKS = process.argv.includes("--add-links");

const TYPES = {
  rada: {
    label: "Rada",
    listUrl: "/volebni-obdobi-2022-2026/ds-1710/archiv=0&p1=65977",
    // dates in list items read "... konané D. M. RRRR"
  },
  zastupitelstvo: {
    label: "Zastupitelstvo",
    listUrl: "/volebni-obdobi-2022-2026/ds-1709/archiv=0&p1=64334",
    // dates in list items read "... konaného D. M. RRRR"
  },
};

const CHOLUPICE_RE = /cholupic/i;
const REQUEST_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; cholupice-web meetings updater)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("utf8");
}

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, " ");
}

function cleanTitle(raw) {
  return decodeEntities(stripTags(raw)).replace(/\s+/g, " ").trim();
}

function parseDate(d, m, y) {
  return { day: Number(d), month: Number(m), year: Number(y) };
}

function dateKey({ day, month, year }) {
  return year * 10000 + month * 100 + day;
}

function dateLabel({ day, month, year }) {
  return `${day}.${month}.${year}`;
}

// --- 1. Read current state of the page -------------------------------------

export function meetingGroups(content) {
  return [...content.matchAll(/<ul data-meeting-group data-type="(rada|zastupitelstvo)" data-year="(\d{4})">[\s\S]*?(?=\n<ul data-meeting-group|\n<!-- \/meeting-groups -->|\n<script>|$)/g)];
}

async function readCurrentLatestDates(content) {
  const latest = {};
  for (const m of meetingGroups(content)) {
    const type = m[1];
    const body = m[0];
    const dateRe = /<strong>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/strong>/g;
    let dm;
    while ((dm = dateRe.exec(body))) {
      const d = parseDate(dm[1], dm[2], dm[3]);
      if (!latest[type] || dateKey(d) > dateKey(latest[type])) latest[type] = d;
    }
  }
  return latest;
}

// --- 2. Scrape the list of meetings on praha12.cz ---------------------------

async function fetchMeetingList(type, cutoffKey) {
  const { listUrl } = TYPES[type];
  const meetings = [];
  let page = 1;
  while (true) {
    const url = page === 1 ? `${SITE}${listUrl}` : `${SITE}${listUrl}&tzv=1&pocet=25&stranka=${page}`;
    const html = await fetchHtml(url);
    await sleep(REQUEST_DELAY_MS);
    const dokIdx = html.indexOf('<div class="dok">');
    if (dokIdx === -1) break;
    const dokEnd = html.indexOf("</ul>", dokIdx);
    const section = html.slice(dokIdx, dokEnd === -1 ? undefined : dokEnd);

    const itemRe = /<li><strong><a href="([^"]+)">([\s\S]*?)<\/a><\/strong>/g;
    let found = 0;
    let hitCutoff = false;
    let im;
    while ((im = itemRe.exec(section))) {
      found += 1;
      const href = im[1];
      const linkText = decodeEntities(stripTags(im[2])).replace(/\s+/g, " ").trim();
      const dm = linkText.match(/konan\S*\s+(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/i);
      if (!dm) continue;
      const date = parseDate(dm[1], dm[2], dm[3]);
      const key = dateKey(date);
      if (key <= cutoffKey) {
        hitCutoff = true;
        continue;
      }
      meetings.push({ date, key, url: new URL(decodeEntities(href), SITE).toString(), title: linkText });
    }
    if (found === 0 || hitCutoff) break;
    page += 1;
    if (page > 20) break; // safety net
  }
  // newest first
  meetings.sort((a, b) => b.key - a.key);
  return meetings;
}

// --- 3. Scrape a meeting detail page for Cholupice-related agenda items ----

async function fetchCholupiceItems(meetingUrl) {
  const html = await fetchHtml(meetingUrl);
  await sleep(REQUEST_DELAY_MS);
  return parseMeetingItems(html);
}

export function parseMeetingItems(html) {
  const dokIdx = html.indexOf('id="dokument"');
  if (dokIdx === -1) throw new Error("Chybí obsah jednání (id=dokument).");
  const section = html.slice(dokIdx);

  const rowRe = /<tr>\s*<td align="left">\s*(?:<strong>|<b>)([\s\S]*?)(?:<\/strong>|<\/b>)\s*<br\s*\/?>([\s\S]*?)<\/td>\s*<\/tr>/g;
  const items = [];
  let rm;
  while ((rm = rowRe.exec(section))) {
    const title = cleanTitle(rm[1]);
    if (!title) continue;
    const material = [...rm[2].matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .find((m) => /[RZ]-\d+-\d+-\d+/.test(cleanTitle(m[2])));
    if (!material) {
      console.warn(`  ! Bez dostupného odkazu na materiál: ${title}`);
      items.push({ title, code: null, url: null });
      continue;
    }
    const url = new URL(decodeEntities(material[1]), SITE);
    if (url.origin !== SITE || url.pathname.toLowerCase() !== "/assets/file.ashx" ||
        !url.searchParams.has("id_dokumenty")) {
      throw new Error(`Neočekávaný odkaz na dokument: ${url}`);
    }
    const code = cleanTitle(material[2]).match(/[RZ]-\d+-\d+-\d+/)[0];
    items.push({ title, code, url: url.toString() });
  }
  if (items.length === 0) throw new Error("Nepodařilo se načíst body jednání.");
  return items;
}

// --- 4. Build HTML for new <li> entries -------------------------------------

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function itemLink(item, title = escapeHtml(item.title)) {
  if (!item.url) return title;
  return `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${title}</a>`;
}

export function buildLi(date, items) {
  const label = dateLabel(date);
  if (items.length === 1) {
    return `<li><strong>${label}</strong> ${itemLink(items[0])}</li>`;
  }
  const inner = items.map((it) => `<li>${itemLink(it)}</li>`).join("");
  return `<li><strong>${label}</strong><ul>${inner}</ul></li>`;
}

function titleKey(title) {
  return cleanTitle(title).normalize("NFC").toLocaleLowerCase("cs")
    .replace(/[–—]/g, "-").replace(/\s+/g, " ");
}

export function addLinks(content, type, date, items) {
  let count = 0;
  const updated = content.replace(
    /<ul data-meeting-group data-type="(rada|zastupitelstvo)" data-year="(\d{4})">[\s\S]*?(?=\n<ul data-meeting-group|\n<!-- \/meeting-groups -->|\n<script>|$)/g,
    (group, groupType) => {
      if (groupType !== type) return group;
      return group.replace(
        /<strong>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/strong>[\s\S]*?(?=<strong>\d{1,2}\.\d{1,2}\.\d{4}<\/strong>|$)/g,
        (entry, day, month, year) => {
          if (dateKey(parseDate(day, month, year)) !== dateKey(date)) return entry;
          return entry.replace(/(<li>|<\/strong>)([^<]+)(?=<|$)/g, (text, prefix, raw) => {
            const title = raw.trim();
            const matches = items.filter((item) => item.url && titleKey(item.title) === titleKey(title));
            if (matches.length !== 1) return text;
            count++;
            return prefix + raw.replace(title, () => itemLink(matches[0], title));
          });
        },
      );
    },
  );
  return { content: updated, count };
}

// --- 5. Stitch new entries into index.md ------------------------------------

function insertYearBlock(content, type, year, liHtml) {
  const blockStart = `<ul data-meeting-group data-type="${type}" data-year="${year}">`;
  const existingIdx = content.indexOf(blockStart);
  if (existingIdx !== -1) {
    const insertAt = existingIdx + blockStart.length;
    return content.slice(0, insertAt) + liHtml + content.slice(insertAt);
  }
  // No block for this year yet: create one, placed before the first existing
  // block of the same type (blocks are ordered newest year first).
  const anyBlockRe = new RegExp(`<ul data-meeting-group data-type="${type}" data-year="\\d{4}">`);
  const anyMatch = anyBlockRe.exec(content);
  const newBlock = `<ul data-meeting-group data-type="${type}" data-year="${year}">${liHtml}</ul>\n\n`;
  if (anyMatch) {
    return content.slice(0, anyMatch.index) + newBlock + content.slice(anyMatch.index);
  }
  // Fallback: no existing block of this type at all — shouldn't happen.
  return content + "\n" + newBlock;
}

export function ensureYearChip(content, year) {
  const chipRe = /<div class="meetings-filter__chips" data-filter-group="year"[^>]*>([\s\S]*?)<\/div>/;
  const m = chipRe.exec(content);
  if (!m) return content;
  const existing = [...m[1].matchAll(/data-value="(\d{4})"/g)].map((x) => x[1]);
  if (existing.includes(String(year))) return content;

  const years = [...existing.map(Number), year].sort((a, b) => b - a);
  const chipsHtml = years
    .map((y, i) => `<button type="button" class="meetings-filter__chip${i === 0 ? " is-active" : ""}" data-value="${y}" aria-pressed="${i === 0 ? "true" : "false"}">${y}</button>`)
    .join("\n      ");
  const replacement = `<div class="meetings-filter__chips" data-filter-group="year" role="group" aria-label="Rok jednání">\n      ${chipsHtml}\n    </div>`;
  content = content.slice(0, m.index) + replacement + content.slice(m.index + m[0].length);

  return content;
}

// --- main --------------------------------------------------------------------

async function run() {
  const content = await fs.readFile(INDEX_FILE, "utf8");
  const latest = await readCurrentLatestDates(content);
  console.log("Dosud nejnovější datum na stránce:");
  for (const type of Object.keys(TYPES)) {
    console.log(`  ${TYPES[type].label}: ${latest[type] ? dateLabel(latest[type]) : "(žádné)"}`);
  }

  let updated = content;
  const summary = [];
  let linkCount = 0;

  for (const type of Object.keys(TYPES)) {
    const cutoff = latest[type] ? dateKey(latest[type]) : 0;
    console.log(`\nHledám nová jednání typu "${TYPES[type].label}" ...`);
    const existingDates = new Set(meetingGroups(content).filter((m) => m[1] === type)
      .flatMap((m) => [...m[0].matchAll(/<strong>(\d{1,2})\.(\d{1,2})\.(\d{4})<\/strong>/g)]
        .map((d) => dateKey(parseDate(d[1], d[2], d[3])))));
    const listCutoff = ADD_LINKS && existingDates.size ? Math.min(...existingDates) - 1 : cutoff;
    const meetings = await fetchMeetingList(type, listCutoff);
    console.log(`  nalezeno ${meetings.length} jednání v kontrolovaném období ...`);

    // group new <li> entries by year, newest meeting first within the year
    const byYear = new Map();
    for (const meeting of meetings) {
      const isExisting = meeting.key <= cutoff;
      if (isExisting && !existingDates.has(meeting.key)) continue;
      const allItems = await fetchCholupiceItems(meeting.url);
      if (isExisting) {
        const result = addLinks(updated, type, meeting.date, allItems);
        updated = result.content;
        linkCount += result.count;
        console.log(`  ${dateLabel(meeting.date)} (${TYPES[type].label}): +${result.count} odkazů`);
        continue;
      }
      const items = allItems.filter((item) => CHOLUPICE_RE.test(item.title));
      if (items.length === 0) continue;
      console.log(`  + ${dateLabel(meeting.date)} (${TYPES[type].label}): ${items.length} položka/y s "Cholupice"`);
      for (const it of items) console.log(`      - ${it.code ? it.code + ": " : ""}${it.title}`);
      const year = meeting.date.year;
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(buildLi(meeting.date, items));
    }

    const years = [...byYear.keys()].sort((a, b) => b - a); // newest year first
    for (const year of years) {
      const liHtml = byYear.get(year).join("");
      updated = insertYearBlock(updated, type, year, liHtml);
      updated = ensureYearChip(updated, year);
      summary.push({ type, year, count: byYear.get(year).length });
    }
  }

  if (updated === content) {
    console.log("\nNic nového k doplnění (žádné další jednání se zatím netýkalo Cholupic).");
    return;
  }

  console.log("\nShrnutí doplněných záznamů:");
  for (const s of summary) console.log(`  ${TYPES[s.type].label} ${s.year}: +${s.count} jednání`);
  console.log(`  Doplněné odkazy ke stávajícím bodům: ${linkCount}`);

  if (DRY_RUN) {
    console.log("\n--dry-run: soubor nebyl zapsán.");
    return;
  }

  await fs.writeFile(INDEX_FILE, updated, "utf8");
  console.log(`\nZapsáno do ${path.relative(ROOT, INDEX_FILE)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
