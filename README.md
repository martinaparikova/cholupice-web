# Web Sdružení pro rozvoj Cholupic

Tento repozitář obsahuje statický web (postavený na [Jekyllu](https://jekyllrb.com/)),
který nahrazuje původní WordPress na [zitcholupice.cz](https://www.zitcholupice.cz/).
GitHub Pages stránky automaticky sestaví a publikuje při každém `push` do větve `main` —
žádný vlastní server ani databázi už není potřeba provozovat.

## Jak je to poskládané

```
.
├── _config.yml              # název webu, popis, e-mail, hlavička
├── _data/nav.yml             # položky hlavního menu (pořadí = pořadí v souboru)
├── _layouts/                 # šablony stránek (default.html, page.html)
├── _includes/                 # hlavička (site-header.html) a patička (site-footer.html)
├── assets/css/style.scss      # veškerý vzhled webu (barvy, písma, rozvržení)
├── assets/images/             # fotky použité v obsahu stránek
├── assets/files/               # PDF dokumenty (stanovy, přihláška, petice, ...)
├── index.md                   # stránka „Domů“
├── cholupicky-zpravodaj/index.md
├── v-reseni/index.md
├── cholupicky-statek/index.md
├── ze-zasedani-rady-a-zastupitelstva/index.md
├── dokoncene-cinnosti/index.md   # stránka „Archiv“
├── dokumenty/index.md             # stránka „Kontakt“
└── scripts/migrate-from-wordpress.mjs   # jednorázový/opakovatelný import z WordPressu
```

Každá stránka je `.md` soubor s "front matterem" (text mezi `---`) nahoře:

```
---
layout: page
title: "Cholupický statek"
permalink: /cholupicky-statek/
nav_order: 4
---
```

Pod tím následuje samotný obsah (může být čisté HTML, jak byl exportován z WordPressu,
nebo klidně i Markdown — oboje funguje).

## Jak upravit obsah

**Nejjednodušší cesta (bez instalace čehokoli):**

1. Na GitHubu otevřete soubor, který chcete upravit (např. `cholupicky-zpravodaj/index.md`).
2. Klikněte na ikonu tužky (Edit).
3. Upravte text, dole zvolte „Commit directly to the main branch“ a potvrďte.
4. Do ~1 minuty se změna automaticky objeví na živém webu (záložka **Actions** v repozitáři
   ukazuje průběh publikování).

**Přidání nové fotky k článku:**

1. Fotku nahrajte do složky `assets/images/` (na GitHubu: `Add file → Upload files`).
2. V příslušném `.md` souboru přidejte `<img src="/assets/images/nazev-souboru.jpg" alt="">`.

**Přidání zcela nové stránky:**

1. Vytvořte novou složku s `index.md` (např. `akce/index.md`) podle vzoru výše.
2. Přidejte položku do `_data/nav.yml`, pokud má být v menu.

## Lokální náhled (volitelné)

Ke každodenním úpravám ho nepotřebujete — GitHub Pages sestaví web za vás. Pokud ale chcete
vidět změny dřív, než je nahrajete:

1. Nainstalujte [Ruby](https://www.ruby-lang.org/) (na Windows nejsnáz přes
   `winget install RubyInstallerTeam.RubyWithDevKit.3.3`).
2. `gem install jekyll`
3. V tomto adresáři: `jekyll serve` a otevřete `http://127.0.0.1:4000`.

## Opětovné stažení obsahu z WordPressu

Pokud byste do úplného přechodu ještě přidávaly obsah na starém WordPressu a chtěly ho
znovu natáhnout sem, spusťte (vyžaduje [Node.js](https://nodejs.org/)):

```
node scripts/migrate-from-wordpress.mjs
```

Skript stáhne aktuální obsah všech 7 stránek a nové obrázky/dokumenty z
`www.zitcholupice.cz` a přepíše odpovídající `.md` soubory. Dejte si na to pozor —
přepíše i ruční úpravy provedené přímo v `.md` souborech (formátování obsahu
z WordPressu zůstane zachováno, ale cokoliv, co jste dopsaly navíc jen v Jekyllu,
by se tím ztratilo).

## Publikace na GitHub Pages

V nastavení repozitáře (**Settings → Pages**) zvolte:
- **Source**: `Deploy from a branch`
- **Branch**: `main` / `(root)`

Web pak poběží na `https://martinaparikova.github.io/cholupice-web/`.

### Vlastní doména (zitcholupice.cz)

Chcete-li web provozovat na stávající doméně:

1. Vytvořte v kořeni repozitáře soubor `CNAME` s obsahem `www.zitcholupice.cz`.
2. U poskytovatele domény nastavte DNS záznam `CNAME` pro `www` směřující na
   `martinaparikova.github.io`, a pro samotnou doménu (`@`) `A` záznamy podle
   [návodu GitHubu](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
3. V **Settings → Pages** doménu zadejte a počkejte na ověření HTTPS certifikátu.

## Známé drobnosti z původního webu

Dva odkazy v obsahu byly nefunkční (vracely 404) už na původním WordPressu, takže je
import přenesl tak, jak byly — časem je může stačit opravit nebo smazat:
- `cholupicky-statek/index.md`: odkaz na petici "Nahled-Petice.jpeg"
- `dokoncene-cinnosti/index.md`: odkaz `03_zaklady.pdfdf` (překlep v příponě na starém webu)
