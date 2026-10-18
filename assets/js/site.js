(() => {
  "use strict";

  const menus = [...document.querySelectorAll(".nav__group")];
  const closeMenus = (except) => menus.forEach((menu) => {
    if (menu !== except) menu.open = false;
  });
  menus.forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (menu.open) closeMenus(menu);
    });
    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) menu.open = false;
    });
  });
  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && !event.target.closest(".nav__group")) closeMenus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const menu = menus.find((item) => item.open && item.contains(document.activeElement));
    if (menu) {
      menu.open = false;
      menu.querySelector("summary").focus();
      event.preventDefault();
    }
  });

  const writeState = (values) => {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    window.history.replaceState(null, "", url);
  };
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs");

  document.querySelectorAll("[data-collection]").forEach((collection) => {
    const controls = collection.querySelector("[data-collection-controls]");
    const search = controls.querySelector('input[type="search"]');
    const year = controls.querySelector("select");
    const cards = [...collection.querySelectorAll("[data-entry]")];
    const status = collection.querySelector("[role='status']");
    const empty = collection.querySelector("[data-empty]");
    const reset = controls.querySelector("[data-reset]");
    const texts = cards.map((card) => normalize([...card.querySelectorAll("h2,h3,p,li,figcaption")].map((node) => node.textContent).join(" ")));
    const years = [...new Set(cards.flatMap((card) => (card.dataset.years || "").split(" ")).filter(Boolean))].sort().reverse();
    years.forEach((value) => year.add(new Option(value, value)));
    year.add(new Option("Bez uvedeného roku", "undated"));
    controls.hidden = false;

    const apply = (updateUrl) => {
      const query = normalize(search.value.trim());
      let count = 0;
      cards.forEach((card, index) => {
        const cardYears = (card.dataset.years || "").split(" ").filter(Boolean);
        const matchesYear = !year.value || (year.value === "undated" ? !cardYears.length : cardYears.includes(year.value));
        card.hidden = !matchesYear || !texts[index].includes(query);
        if (!card.hidden) count++;
      });
      status.textContent = `Zobrazené záznamy: ${count} z ${cards.length}.`;
      empty.hidden = count !== 0;
      if (updateUrl) writeState({ q: search.value.trim(), year: year.value });
    };
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      search.value = params.get("q") || "";
      const requestedYear = params.get("year") || "";
      year.value = [...year.options].some((option) => option.value === requestedYear) ? requestedYear : "";
      apply(false);
    };
    search.addEventListener("input", () => apply(true));
    year.addEventListener("change", () => apply(true));
    reset.addEventListener("click", () => {
      search.value = "";
      year.value = "";
      apply(true);
      search.focus();
    });
    window.addEventListener("popstate", restore);
    restore();
  });

  const meetings = document.querySelector(".meetings-filter");
  if (meetings) {
    const groups = [...document.querySelectorAll("[data-meeting-group]")];
    const status = document.querySelector("[data-meetings-status]");
    const empty = document.querySelector("[data-meetings-empty]");
    const controls = [...meetings.querySelectorAll("[data-filter-group]")];
    const state = {};
    const apply = (updateUrl) => {
      let count = 0;
      controls.forEach((group) => {
        const key = group.dataset.filterGroup;
        group.querySelectorAll("button").forEach((button) => {
          const active = button.dataset.value === state[key];
          button.classList.toggle("is-active", active);
          button.setAttribute("aria-pressed", String(active));
        });
      });
      groups.forEach((group) => {
        group.hidden = group.dataset.type !== state.type || group.dataset.year !== state.year;
        if (!group.hidden) count += group.children.length;
      });
      status.textContent = `${state.type === "rada" ? "Rada" : "Zastupitelstvo"}, ${state.year}. Počet jednání: ${count}.`;
      empty.hidden = count !== 0;
      if (updateUrl) writeState(state);
    };
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      controls.forEach((group) => {
        const key = group.dataset.filterGroup;
        const values = [...group.querySelectorAll("button")].map((button) => button.dataset.value);
        state[key] = values.includes(params.get(key)) ? params.get(key) : values[0];
      });
      apply(false);
    };
    controls.forEach((group) => {
      group.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
        state[group.dataset.filterGroup] = button.dataset.value;
        apply(true);
      }));
    });
    meetings.hidden = false;
    window.addEventListener("popstate", restore);
    restore();
  }

  const form = document.querySelector(".contact-form");
  if (form) {
    const next = form.querySelector("[data-next-path]");
    next.name = "_next";
    next.value = new URL(next.dataset.nextPath, window.location.origin).href;
    const fields = [...form.querySelectorAll("input[required], textarea[required]")];
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector(".form-status");
    let dirty = false;
    let submitting = false;
    const showError = (field) => {
      const error = document.getElementById(`${field.id}-error`);
      const invalid = !field.validity.valid;
      field.setAttribute("aria-invalid", String(invalid));
      error.hidden = !invalid;
      error.textContent = !invalid ? "" : field.validity.valueMissing
        ? "Vyplňte prosím toto pole."
        : field.type === "email" ? "Zadejte platnou e-mailovou adresu, například jmeno@example.cz."
          : "Zkontrolujte délku a obsah tohoto pole.";
      return invalid;
    };
    form.noValidate = true;
    form.addEventListener("input", (event) => {
      dirty = true;
      if (fields.includes(event.target) && event.target.getAttribute("aria-invalid") === "true") showError(event.target);
    });
    form.addEventListener("submit", (event) => {
      if (submitting) {
        event.preventDefault();
        return;
      }
      const invalid = fields.filter(showError);
      if (invalid.length) {
        event.preventDefault();
        invalid[0].focus();
        status.textContent = "Zpráva zatím nebyla odeslána. Opravte označená pole.";
        return;
      }
      submitting = true;
      dirty = false;
      form.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.textContent = "Odesílání…";
      status.textContent = "Přecházíte na službu FormSubmit. Případné ověření proti spamu dokončete na její stránce.";
    });
    window.addEventListener("beforeunload", (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    window.addEventListener("pageshow", () => {
      submitting = false;
      form.removeAttribute("aria-busy");
      dirty = fields.some((field) => field.value);
      button.disabled = false;
      button.textContent = "Odeslat zprávu";
      status.textContent = "";
    });
  }
})();
