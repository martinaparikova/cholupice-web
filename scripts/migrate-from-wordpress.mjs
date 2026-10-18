#!/usr/bin/env node
/**
 * Migrates content from the zitcholupice.cz WordPress site (via its public REST API)
 * into Jekyll-ready Markdown pages, downloading every image used in the content
 * into assets/images/.
 *
 * Usage:  node scripts/migrate-from-wordpress.mjs
 *
 * Safe to re-run: it only overwrites generated *.md page files and re-downloads
 * images that are missing locally (existing images are not re-downloaded).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.zitcholupice.cz";
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMAGES_DIR = path.join(ROOT, "assets", "images");
const FILES_DIR = path.join(ROOT, "assets", "files");
const PAGES_ORDER_FILE = path.join(ROOT, "_data", "nav.yml");
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

// slug -> { title, order, permalink } mapping, driven by the live site's main menu
const NAV = [
  { slug: "domu", wpSlug: "domu", wpId: 19, title: "O sdružení", permalink: "/" },
  { slug: "cholupicky-zpravodaj", wpId: 616, title: "Cholupický zpravodaj", permalink: "/cholupicky-zpravodaj/" },
  { slug: "v-reseni", wpId: 69, title: "V řešení", permalink: "/v-reseni/" },
  { slug: "cholupicky-statek", wpId: 831, title: "Cholupický statek", permalink: "/cholupicky-statek/" },
  { slug: "ze-zasedani-rady-a-zastupitelstva", wpId: 819, title: "Ze zasedání Rady a Zastupitelstva", permalink: "/ze-zasedani-rady-a-zastupitelstva/" },
  { slug: "dokoncene-cinnosti", wpId: 199, title: "Archiv", permalink: "/archiv/" },
  { slug: "kontakt", wpId: 77, title: "Kontakt", permalink: "/kontakt/" },
];

const EXTRA_IMAGE_URLS = [
  // Custom header / hero image shown behind the site title on every page
  "https://www.zitcholupice.cz/wp-content/uploads/2020/08/cropped-Ebibms7WAAIFx1A-2.jpeg",
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

function extractUploadUrls(html) {
  // Only the actually-used `src` (the srcset/sizes variants are stripped from
  // the output markup, so there's no point downloading every resized copy),
  // plus any `href` that points at an uploaded file (PDFs, docs, etc.).
  const urls = new Set();
  const attrRe = /\s(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = attrRe.exec(html))) {
    if (m[1].includes("/wp-content/uploads/")) urls.add(m[1]);
  }
  return [...urls];
}

function targetFolderFor(url) {
  const ext = path.extname(url.split("?")[0]).toLowerCase();
  return IMAGE_EXT.has(ext) ? { dir: IMAGES_DIR, kind: "images" } : { dir: FILES_DIR, kind: "files" };
}

function localName(url) {
  const clean = url.split("?")[0];
  return decodeURIComponent(path.basename(clean)).normalize("NFC");
}

function absoluteUrl(url) {
  // Content sometimes already has site-relative upload paths (no domain).
  return url.startsWith("/") ? `${SITE}${url}` : url;
}

async function downloadUpload(url) {
  const { dir, kind } = targetFolderFor(url);
  const name = localName(url);
  const dest = path.join(dir, name);
  try {
    await fs.access(dest);
    return { name, kind }; // already downloaded
  } catch {
    // not present, fetch it
  }
  const abs = absoluteUrl(url);
  const httpsUrl = abs.replace(/^http:\/\//, "https://");
  let res = await fetch(httpsUrl);
  if (!res.ok) res = await fetch(abs);
  if (!res.ok) {
    console.warn(`  ! could not download ${url} (${res.status})`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dest, buf);
  console.log(`  + [${kind}] ${name}`);
  return { name, kind };
}

function rewriteContent(html, urlToLocal) {
  let out = html;
  for (const [remote, local] of urlToLocal) {
    if (!local) continue;
    const escaped = remote.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "g"), `/assets/${local.kind}/${local.name}`);
  }
  // Drop the srcset/sizes attributes: we only keep the single downloaded (largest) image
  out = out.replace(/\s(srcset|sizes)="[^"]*"/g, "");
  // Normalise remaining internal links (nav, cross-links between pages) that still
  // point at the old domain -> make them root-relative. Upload links are already
  // rewritten above, so this only touches page-to-page links.
  out = out.replace(/https?:\/\/(www\.)?zitcholupice\.cz\/index\.php\//g, "/");
  out = out.replace(/https?:\/\/(www\.)?zitcholupice\.cz\//g, "/");
  return out.trim();
}

function toFrontMatter(entry) {
  const title = entry.title.replace(/"/g, '\\"');
  return `---
layout: page
title: "${title}"
permalink: ${entry.permalink}
nav_order: ${entry.navOrder}
---
`;
}

async function run() {
  console.log(`Fetching ${NAV.length} pages from ${SITE} ...`);
  const urlToLocal = new Map();

  // First pass: fetch all page content & collect every referenced image URL
  const pages = [];
  for (const entry of NAV) {
    const data = await fetchJson(`${SITE}/wp-json/wp/v2/pages/${entry.wpId}`);
    const html = data.content.rendered;
    pages.push({ ...entry, html, modified: data.modified });
    for (const u of extractUploadUrls(html)) urlToLocal.set(u, null);
  }
  for (const u of EXTRA_IMAGE_URLS) urlToLocal.set(u, null);

  console.log(`Found ${urlToLocal.size} unique files referenced in content. Downloading ...`);
  for (const url of urlToLocal.keys()) {
    const local = await downloadUpload(url);
    urlToLocal.set(url, local);
  }

  console.log("Writing Markdown pages ...");
  let navOrder = 0;
  for (const page of pages) {
    navOrder += 1;
    const rewritten = rewriteContent(page.html, [...urlToLocal].filter(([, l]) => l));
    const fm = toFrontMatter({ title: page.title, permalink: page.permalink, navOrder });
    const outPath =
      page.slug === "domu" ? path.join(ROOT, "index.md") : path.join(ROOT, page.slug, "index.md");
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, fm + "\n" + rewritten + "\n");
    console.log(`  wrote ${path.relative(ROOT, outPath)}`);
  }

  console.log("Writing _data/nav.yml ...");
  await fs.mkdir(path.dirname(PAGES_ORDER_FILE), { recursive: true });
  const navYml = NAV.map((n) => `  - title: "${n.title}"\n    url: "${n.permalink}"`).join("\n");
  await fs.writeFile(PAGES_ORDER_FILE, `nav:\n${navYml}\n`);

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
