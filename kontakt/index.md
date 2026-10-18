---
layout: page
title: "Kontakt"
description: "Napište Sdružení pro rozvoj Cholupic, zapojte se do činnosti nebo se staňte členem."
wide: true
permalink: /kontakt/
nav_order: 7
---

<div class="contact-page">
  <section class="contact-page__intro" aria-labelledby="contact-heading">
    <div>
      <p class="eyebrow">Ozvěte se nám</p>
      <h2 id="contact-heading">Máte nápad, dotaz<br>nebo chcete pomoci?</h2>
      <p class="contact-page__lead">Napište nám přes formulář nebo přímo na e-mail.</p>
      <p class="contact-page__email">
        <span>E-mail</span>
        <a href="mailto:{{ site.email }}">{{ site.email }}</a>
      </p>
    </div>
    {% include contact-form.html %}
  </section>

  <section class="contact-page__join" aria-labelledby="join-heading">
    <div>
      <p class="eyebrow">Přidejte se</p>
      <h2 id="join-heading">Staňte se členem</h2>
    </div>
    <div>
      <p>Rádi mezi sebou přivítáme každého, komu záleží na tom, jak se v Cholupicích žije.</p>
      <ol class="contact-page__steps">
        <li>Přečtěte si <a href="{{ '/assets/files/Stanovy.pdf' | relative_url }}">stanovy spolku</a>.</li>
        <li>Vyplňte <a href="{{ '/assets/files/Přihláška-k-členství-a.pdf' | relative_url }}">přihlášku k členství</a> a připište, co byste rádi v obci zlepšili nebo s čím byste chtěli pomoci.</li>
        <li>Pošlete přihlášku na <a href="mailto:{{ site.email }}">{{ site.email }}</a>.</li>
      </ol>
      <p class="contact-page__downloads">
        <a class="home-about__link" href="{{ '/assets/files/Přihláška-k-členství-a.pdf' | relative_url }}">Stáhnout přihlášku <span aria-hidden="true">↓</span></a>
        <a href="{{ '/assets/files/Stanovy.pdf' | relative_url }}">Stanovy (PDF) <span aria-hidden="true">→</span></a>
      </p>
    </div>
  </section>

  <section class="contact-page__members" aria-labelledby="members-heading">
    <div>
      <p class="eyebrow">Kdo jsme</p>
      <h2 id="members-heading">Naši členové</h2>
    </div>
    <div class="contact-page__groups">
      <div>
        <h3>Zakládající členky</h3>
        <ul>
          <li>Martina Rázus Paříková</li>
          <li>Lucie Šmídlová</li>
          <li>Alžběta Pitelková</li>
        </ul>
      </div>
      <div>
        <h3>Členové</h3>
        <ul>
          <li>Lucie Sokolová</li>
          <li>Martina Tupá</li>
          <li>Kamil Macák</li>
          <li>Kateřina Hanzlíková</li>
          <li>Lucie Kramárová Zahorcová</li>
        </ul>
      </div>
    </div>
  </section>
  <section class="contact-page__privacy" aria-labelledby="osobni-udaje">
    <h2 id="osobni-udaje">Údaje v kontaktním formuláři</h2>
    <p>Formulář slouží k zaslání dotazu Sdružení pro rozvoj Cholupic. Odesílá jméno, e-mailovou adresu a text zprávy přes externí službu <a href="https://formsubmit.co/privacy.pdf">FormSubmit (informace o ochraně údajů, PDF)</a> na e-mail sdružení. Služba vás může před odesláním požádat o ověření proti spamu.</p>
    <p>Pokud tuto službu nechcete použít, napište přímo na <a href="mailto:{{ site.email }}">{{ site.email }}</a>. Na stejné adrese se můžete zeptat na zpracování své zprávy nebo požádat o přístup k údajům, jejich opravu či výmaz.</p>
  </section>
</div>
