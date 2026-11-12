#!/usr/bin/env node
/**
 * Archivuje položky úřední desky MČ Praha 12, jejichž název zjevně souvisí
 * s Cholupicemi. Data čte z oficiálního JSON-LD otevřených dat, ne z HTML.
 *
 * Použití: node scripts/update-notice-board.mjs [--dry-run]
 * --dry-run pouze vypíše nalezené položky; nic nezapisuje ani nestahuje.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_URL = "https://www.praha12.cz/opendata-uredni-deska";
const INDEX_FILE = path.join(ROOT, "z-uredni-desky", "index.md");
const ARCHIVE_DIR = path.join(ROOT, "assets", "files", "uredni-deska");
const DRY_RUN = process.argv.includes("--dry-run");
const CHOLUPICE_RE = /\b(?:cholupic\w*|dolnocholupick\w*|hornocholupick\w*|ražick\w*|razick\w*|k\s+dýmači|k\s+dymači|podchýšsk\w*|podchys\w*|kestřansk\w*|kestransk\w*|mokřadn\w*|mokr adn\w*)\b/iu;
const ENTRY_MARKER = "    <!-- notice-board-entries -->\n    <!-- /notice-board-entries -->";
const REQUEST_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; cholupice-web notice-board archiver)" };

export function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function slug(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90) || "dokument";
}

export function isRelevant(item) {
  return CHOLUPICE_RE.test(item.title);
}

export function parseNoticeBoard(payload) {
  if (!payload || !Array.isArray(payload.informace)) throw new Error("Otevřená data neobsahují pole informace.");
  return payload.informace.map((item) => ({
    id: item.iri || item.url,
    url: item.url,
    title: item.název?.cs,
    posted: item.vyvěšení?.datum,
    relevantUntil: item.relevantní_do?.datum,
    referenceNumber: item.číslo_jednací || "",
    fileNumber: item.spisová_značka || "",
    documents: (item.dokument || []).map((document) => ({
      title: document.název?.cs || "Příloha",
      url: document.url?.replaceAll("&amp;", "&"),
    })),
  })).filter((item) => item.id && item.url && item.title && item.posted);
}

export function documentId(url) {
  const parsed = new URL(url);
  return parsed.searchParams.get("id_dokumenty") || slug(parsed.pathname);
}

export function extensionFrom(contentType, filename) {
  const fromName = path.extname(filename || "").toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/i.test(fromName)) return fromName;
  if (contentType?.includes("pdf")) return ".pdf";
  if (contentType?.includes("msword")) return ".doc";
  if (contentType?.includes("officedocument.wordprocessingml")) return ".docx";
  if (contentType?.includes("spreadsheetml")) return ".xlsx";
  return ".bin";
}

export function archivePathFor(document, posted, contentType = "") {
  const year = String(posted).slice(0, 4);
  const id = documentId(document.url);
  const extension = extensionFrom(contentType, document.title);
  const basename = path.basename(document.title || "Příloha", path.extname(document.title || ""));
  return path.posix.join("/assets/files/uredni-deska", year, `${slug(basename)}-${slug(id)}${extension}`);
}

export function existingEntryIds(content) {
  return new Set([...content.matchAll(/data-notice-id="([^"]+)"/g)].map((match) => decodeURIComponent(match[1])));
}

function formatDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[3])}.${Number(match[2])}.${match[1]}` : value;
}

export function renderEntry(item, archivedDocuments) {
  const anchor = `${slug(item.title)}-${item.posted}`;
  const metadata = [
    `<span><strong>Vyvěšeno:</strong> ${escapeHtml(formatDate(item.posted))}</span>`,
    item.relevantUntil ? `<span><strong>Plánované sejmutí:</strong> ${escapeHtml(formatDate(item.relevantUntil))}</span>` : "",
    item.referenceNumber ? `<span><strong>Č. j.:</strong> ${escapeHtml(item.referenceNumber)}</span>` : "",
    item.fileNumber ? `<span><strong>Spisová značka:</strong> ${escapeHtml(item.fileNumber)}</span>` : "",
  ].filter(Boolean).join("");
  const documents = archivedDocuments.length
    ? `<h3>Přílohy uložené v archivu</h3><ul>${archivedDocuments.map((document) => `<li><a href="${escapeHtml(document.localUrl)}">${escapeHtml(document.title)}</a></li>`).join("")}</ul>`
    : "<p>Zdroj u této položky neuváděl přílohu ke stažení.</p>";
  return `    <article class="notice-card" id="${escapeHtml(anchor)}" data-entry data-years="${escapeHtml(item.posted.slice(0, 4))}" data-notice-id="${encodeURIComponent(item.id)}">\n      <h2 class="entry-heading"><a href="#${escapeHtml(anchor)}">${escapeHtml(item.title)}</a></h2>\n      <div class="notice-card__metadata">${metadata}</div>\n      <p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Zobrazit původní záznam na Praha 12</a></p>\n      ${documents}\n    </article>`;
}

export function insertEntries(content, entries) {
  const marker = /^(\s*<!-- notice-board-entries -->\r?\n)([\s\S]*?)(\s*<!-- \/notice-board-entries -->)$/m;
  if (!marker.test(content)) throw new Error("Na stránce chybí vyznačené místo pro záznamy úřední desky.");
  return content.replace(marker, (_, opening, current, closing) => `${opening}${entries.join("\n")}\n${current}${closing}`);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });
  if (!response.ok) throw new Error(`GET ${url} -> ${response.status}`);
  return response.json();
}

async function downloadDocument(document, posted) {
  const response = await fetch(document.url, { headers: REQUEST_HEADERS });
  if (!response.ok) throw new Error(`GET ${document.url} -> ${response.status}`);
  const localUrl = archivePathFor(document, posted, response.headers.get("content-type") || "");
  const destination = path.join(ROOT, ...localUrl.split("/").filter(Boolean));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.access(destination);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error(`Stažený dokument je prázdný: ${document.url}`);
    await fs.writeFile(destination, buffer);
  }
  return { ...document, localUrl };
}

async function run() {
  const [content, payload] = await Promise.all([fs.readFile(INDEX_FILE, "utf8"), fetchJson(DATA_URL)]);
  const knownIds = existingEntryIds(content);
  const items = parseNoticeBoard(payload).filter(isRelevant).filter((item) => !knownIds.has(item.id));
  console.log(`Nalezeno ${items.length} nových položek souvisejících s Cholupicemi.`);
  for (const item of items) {
    console.log(`- ${formatDate(item.posted)}: ${item.title} (${item.documents.length} příloh)`);
  }
  if (!items.length) return;
  if (DRY_RUN) {
    console.log("\n--dry-run: stránka ani dokumenty nebyly zapsány.");
    return;
  }

  const entries = [];
  for (const item of items) {
    const documents = [];
    for (const document of item.documents) documents.push(await downloadDocument(document, item.posted));
    entries.push(renderEntry(item, documents));
  }
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, insertEntries(content, entries), "utf8");
  console.log(`\nZapsáno ${items.length} položek do ${path.relative(ROOT, INDEX_FILE)}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}