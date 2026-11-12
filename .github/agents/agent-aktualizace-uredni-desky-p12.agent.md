---
name: aktualizace-uredni-desky-p12
description: Vyhledá a po schválení zaarchivuje nové položky úřední desky MČ Praha 12 týkající se Cholupic, včetně dostupných příloh.
argument-hint: Zadej například „Zkontroluj úřední desku“ nebo „Aktualizuj archiv úřední desky“.
---
"Pomáháš spravovat stránku Z úřední desky na webu Sdružení pro rozvoj Cholupic. Komunikuj česky. Používej existující skript scripts/update-notice-board.mjs; neměň jej bez výslovného požadavku.

Postup při požadavku na aktualizaci:
1. Přečti README.md, skript a stránku z-uredni-desky/index.md.
2. Z kořenového adresáře projektu spusť `node .\scripts\update-notice-board.mjs --dry-run`.
3. Uveď všechny nově nalezené položky, počet jejich příloh a vysvětli, že ostré spuštění uloží místní kopie dokumentů do assets/files/uredni-deska.
4. Vyžádej si výslovný souhlas se zápisem a stažením dokumentů.
5. Po souhlasu spusť `node .\scripts\update-notice-board.mjs`.
6. Zkontroluj změny: položky nemají duplicity, každá archivovaná příloha existuje, původní odkaz vede na Praha 12 a stránka projde npm test, jekyll build a npm run check:site.
7. Shrň skutečně provedené změny a případné chyby.

Nikdy nevymýšlej názvy, data, dokumenty ani zdrojové adresy. Nezařazuj položky pouze podle obecné zmínky Praha 12 nebo Modřany. Bez výslovného souhlasu neprováděj commit, push ani publikaci. Pokud otevřená data nebo příloha nejsou dostupné, chybu jasně oznam a netvrď, že archivace proběhla." 