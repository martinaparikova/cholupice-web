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
├── index.md                   # stránka „O sdružení“
├── aktuality/index.md           # sloučený Cholupický zpravodaj a V řešení
├── cholupicky-statek/index.md     # Klíčová témata › Cholupický statek
├── kulturni-dum/index.md          # Klíčová témata › Kulturní dům
├── ostatni/index.md               # Klíčová témata › Ostatní
├── ze-zasedani-rady-a-zastupitelstva/index.md
├── dokoncene-cinnosti/index.md   # stránka „Archiv“
├── kontakt/index.md               # stránka „Kontakt“ (kontaktní formulář, členství)
├── scripts/migrate-from-wordpress.mjs   # jednorázový/opakovatelný import z WordPressu
└── scripts/update-meetings.mjs          # doplňování jednání Rady/Zastupitelstva z praha12.cz
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

1. Na GitHubu otevřete soubor, který chcete upravit (např. `aktuality/index.md`).
2. Klikněte na ikonu tužky (Edit).
3. Upravte text, dole zvolte „Commit directly to the main branch“ a potvrďte.
4. Do ~1 minuty se změna automaticky objeví na živém webu (záložka **Actions** v repozitáři
   ukazuje průběh publikování).

**Přidání nové fotky k článku:**

1. Fotku nahrajte do složky `assets/images/` (na GitHubu: `Add file → Upload files`).
2. Použijte popisný alternativní text a skutečné rozměry obrázku:

   ```html
   <a href="{{ '/assets/images/nazev-souboru.jpg' | relative_url }}">
     <img src="{{ '/assets/images/nazev-souboru.jpg' | relative_url }}"
          width="1024" height="768" loading="lazy"
          alt="Nový chodník mezi Kestřanskou a Podchýšskou">
   </a>
   ```

3. Pro aktuality, archiv, statek, kulturní dům a plakáty na stránce Ostatní
   spusťte `npm ci` a `npm run prepare-content`. Skript připraví WebP náhledy
   320/640 px, doplní skutečné rozměry a zachová odkaz na originál.
   Změněné stránky i soubory v `assets/images/optimized/` publikujte společně.
   Jekyll na GitHub Pages Node.js nespouští; náhledy jsou už součástí repozitáře.

Alternativní text musí vystihovat konkrétní obsah fotografie nebo dokumentu.
U čistě dekorativních obrázků (např. logo uvnitř již pojmenovaného odkazu)
zůstává `alt=""`. Nepřepisujte hotové popisky automaticky obecným názvem.
Skript sjednocuje názvy lokálních souborů s diakritikou do Unicode NFC, aby
odpovídaly URL generovaným Jekyllem.

**Karty, hledání a odkazy:**

- Karty jsou přímo v HTML; stránka zůstává čitelná i bez JavaScriptu.
- Novou aktualitu přidejte jako `<article class="update-card" data-entry>` s H2.
  Pak spusťte `npm run prepare-content`, který doplní kotvu a roky pro filtr.
- Filtr roku hledá roky zmíněné v celém záznamu, nikoli domnělé datum vydání.
  Hledání a filtry se ukládají do URL; odkazy na nadpisy umožňují sdílet záznam.
- Starší plány ponechte jako historické informace. Dokončení projektu doplňte
  až po ověření; nepoužívejte datum úpravy webu jako datum aktualizace zprávy.
- Archiv obsahuje datované zprávy nejpozději z roku 2023. Události od
  1. ledna 2024 patří do Aktualit, řazené od nejnovějších. Má-li téma
  starší historii i novější vývoj, rozdělte je a fotografie přiřaďte
  k odpovídajícímu stavu. U nedatovaných zpráv rok neodhadujte.
- Na stránkách používejte `relative_url`, aby odkazy fungovaly také pod
  podadresářem GitHub Pages. Pro projektovou adresu nastavte v `_config.yml`
  `baseurl: "/cholupice-web"`; pro vlastní doménu ponechte `baseurl: ""`.

**Kontaktní formulář:**

Formulář odesílá na FormSubmit; pole mají i bez JavaScriptu nativní validaci.
S JavaScriptem se chyby zobrazují u polí a opakované odeslání je blokováno.
Informace o předání údajů jsou u formuláře a v oddílu Kontakt. Aktivaci
služby a doručení do schránky musí správce ověřit skutečným zkušebním
odesláním; lokální testy žádnou zprávu neposílají. Text o osobních údajích
nenahrazuje ověření právních povinností provozovatele.
Pro návrat na vlastní děkovací stránku bez JavaScriptu nastavte také `url`
na skutečnou veřejnou adresu webu. Bez ní se použije potvrzení služby
FormSubmit; JavaScript návratovou adresu odvodí z právě otevřeného webu.

**Přidání zcela nové stránky:**

1. Vytvořte novou složku s `index.md` (např. `akce/index.md`) podle vzoru výše.
2. Přidejte položku do `_data/nav.yml`, pokud má být v menu. Do rozbalovací
   položky (např. „Klíčová témata“) ji přidáte odsazením pod její `children:`.

## Lokální náhled (volitelné)

Ke každodenním úpravám ho nepotřebujete — GitHub Pages sestaví web za vás. Pokud ale chcete
vidět změny dřív, než je nahrajete:

1. Nainstalujte [Ruby](https://www.ruby-lang.org/) (na Windows nejsnáz přes
   `winget install RubyInstallerTeam.RubyWithDevKit.3.3`).
2. `gem install jekyll`
3. V tomto adresáři: `jekyll serve` a otevřete `http://127.0.0.1:4000`.

Kontroly po změnách (Node.js 22.12+):

```powershell
npm ci
npm test
jekyll build
npm run check:site
```

Kontrola sestaveného webu ověřuje lokální cíle a kotvy, jediný H1,
nadpisy karet, popisy a rozměry obrázků i responzivní varianty.
Při sestavení s podadresářem použijte například `jekyll build --baseurl /cholupice-web`
a před kontrolou v PowerShellu nastavte `$env:SITE_BASEURL = "/cholupice-web"`.

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

## Doplnění jednání Rady a Zastupitelstva z praha12.cz

Stránka „Ze zasedání Rady a Zastupitelstva“ se neaktualizuje automaticky — nová jednání
je potřeba čas od času doplnit. Spusťte (vyžaduje [Node.js](https://nodejs.org/)):

```
node scripts/update-meetings.mjs
```

Skript:

1. zjistí z `ze-zasedani-rady-a-zastupitelstva/index.md`, jaké nejnovější datum jednání
   Rady a Zastupitelstva už na stránce je,
2. projde seznamy jednání na praha12.cz od toho data dál,
3. u každého jednání najde body programu zmiňující Cholupice (a odvozené názvy jako
   „Dolnocholupická“/„Hornocholupická“) a okolí,
4. nalezené body doplní na stránku (nejnovější nahoře), podle potřeby založí i nový
   rok ve filtru nahoře. Název bodu je přímým odkazem na veřejný dokument Prahy 12,
   který se otevře v nové záložce.

Stávající záznamy nikdy nemaže ani neupravuje, pouze přidává nové — je tedy bezpečné ho
spouštět opakovaně (např. jednou za pár týdnů). Pro náhled bez zápisu do souboru použijte
`node scripts/update-meetings.mjs --dry-run`.

Pro doplnění odkazů i ke starším záznamům spusťte
`node scripts/update-meetings.mjs --add-links` (lze kombinovat s `--dry-run`).
Skript přiřazuje dokumenty podle typu jednání, data a jednoznačné shody názvu.
Texty zachová; nejednoznačné nebo odlišně pojmenované body nechá bez odkazu.
Neprohledává obsah PDF a zveřejnění na živém webu vyžaduje obvyklou publikaci změn.

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

## Nedostupné dokumenty z původního webu

Původní odkaz na náhled petice u statku a dokument „Základy“ v archivu
nebyly dostupné. Texty zůstaly zachovány s označením nedostupnosti, ale
nevedou na chybové stránky. Stejně je označen chybný starý odkaz na IP adresu.
Před obnovením odkazu je třeba získat a ověřit skutečný dokument.
