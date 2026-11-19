const widgets = new WeakMap();
let activeWidget = null;
let listening = false;
let nextId = 0;
const normalize = (text) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function focusAdjacent(control, direction) {
  const elements = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest('.app-select-panel, [hidden], [inert]'));
  const index = elements.indexOf(control);
  const target = elements[index + direction];
  if (target) target.focus();
  else control.focus({ preventScroll: true });
}

function enhanceSelect(select) {
  if (widgets.has(select) || select.hasAttribute("data-native-select") || select.multiple || select.size > 1) return;
  const searchable = select.dataset.selectSearch === "true";
  const id = select.id || `app-select-${++nextId}`;
  select.id = id;
  const label = [...select.labels][0];
  const fieldName = (label?.textContent || select.getAttribute("aria-label") || "Opção").replace(/\s*\(opcional\)/, "").trim();
  const wrapper = document.createElement("div");
  wrapper.className = "app-select";
  wrapper.dataset.selectFor = id;
  const control = document.createElement("button");
  control.type = "button";
  control.id = `${id}-control`;
  control.className = "app-select-trigger";
  control.setAttribute("aria-expanded", "false");
  control.setAttribute("aria-haspopup", searchable ? "dialog" : "listbox");
  if (!searchable) control.setAttribute("role", "combobox");
  if (label) { label.id ||= `${id}-label`; label.htmlFor = control.id; control.setAttribute("aria-labelledby", `${label.id} ${id}-value`); }
  else control.setAttribute("aria-label", fieldName);
  const valueLabel = document.createElement("span");
  valueLabel.id = `${id}-value`;
  control.append(valueLabel);
  const error = document.createElement("p");
  error.id = `${id}-error`;
  error.className = "app-select-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const panel = document.createElement("div");
  panel.id = `${id}-popup`;
  panel.className = "app-select-panel";
  panel.hidden = true;
  if (searchable) { panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", `Selecionar ${fieldName}`); }
  const filter = searchable ? document.createElement("input") : null;
  if (filter) {
    filter.type = "search";
    filter.className = "app-select-filter";
    filter.placeholder = select.dataset.selectSearchPlaceholder || `Pesquisar ${fieldName.toLocaleLowerCase("pt-BR")}`;
    filter.setAttribute("aria-label", filter.placeholder);
    filter.setAttribute("role", "combobox");
    filter.setAttribute("aria-autocomplete", "list");
    filter.setAttribute("aria-expanded", "true");
    filter.autocomplete = "off";
    filter.spellcheck = false;
    panel.append(filter);
  }
  const list = document.createElement("div");
  list.id = `${id}-options`;
  list.className = "app-select-options";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", fieldName);
  const empty = document.createElement("p");
  empty.className = "app-select-empty";
  empty.setAttribute("role", "status");
  empty.textContent = "Nenhum resultado encontrado.";
  empty.hidden = true;
  panel.append(list, empty);
  control.setAttribute("aria-controls", searchable ? panel.id : list.id);
  filter?.setAttribute("aria-controls", list.id);
  select.before(wrapper);
  wrapper.append(select, control, error);
  // Modal dialogs sit above the rest of the page in the browser's top layer.
  const dialog = select.closest("dialog");
  (dialog ?? document.body).append(panel);
  select.classList.add("app-select-native");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  let options = [];
  let filtered = [];
  let activeIndex = -1;
  let isOpen = false;
  let typeahead = "";
  let lastType = 0;
  const events = new AbortController();
  const eventOptions = { signal: events.signal };

  function position() {
    if (!isOpen) return;
    const rect = control.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    const left = viewport?.offsetLeft || 0;
    const height = viewport?.height || window.innerHeight;
    const width = viewport?.width || window.innerWidth;
    if (!control.isConnected || !control.getClientRects().length) { close(false); return; }
    if (searchable && window.matchMedia("(max-width: 767px)").matches) {
      panel.style.width = `${Math.max(1, width - 24)}px`;
      panel.style.maxHeight = `${Math.max(0, Math.min(344, height - 24))}px`;
      panel.style.left = `${left + 12}px`;
      const actualHeight = panel.getBoundingClientRect().height;
      panel.style.top = `${Math.max(top + 12, top + height - actualHeight - 12)}px`;
      return;
    }
    if (rect.bottom < top || rect.top > top + height) { close(false); return; }
    const popupWidth = Math.min(Math.max(rect.width, 270), width - 24);
    const below = top + height - rect.bottom - 16;
    const above = rect.top - top - 16;
    const upward = below < 200 && above > below;
    const available = Math.max(80, Math.min(344, upward ? above : below));
    panel.style.width = `${popupWidth}px`;
    panel.style.maxHeight = `${available}px`;
    panel.style.left = `${Math.max(left + 12, Math.min(rect.left, left + width - popupWidth - 12))}px`;
    const actualHeight = panel.getBoundingClientRect().height;
    panel.style.top = `${Math.max(top + 8, Math.min(upward ? rect.top - actualHeight - 8 : rect.bottom + 8, top + height - actualHeight - 8))}px`;
  }

  function setActive(index, scroll = true) {
    const previous = list.children[activeIndex];
    if (previous) previous.dataset.active = "false";
    activeIndex = index;
    const option = list.children[index];
    const owner = filter || control;
    if (!option) { owner.removeAttribute("aria-activedescendant"); return; }
    option.dataset.active = "true";
    owner.setAttribute("aria-activedescendant", option.id);
    if (scroll) {
      const optionTop = option.offsetTop;
      if (optionTop < list.scrollTop) list.scrollTop = optionTop;
      else if (optionTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = optionTop + option.offsetHeight - list.clientHeight;
    }
  }

  function render() {
    const query = normalize(filter?.value.trim() || "").split(/\s+/).filter(Boolean);
    filtered = options.filter((option) => query.every((word) => option.search.includes(word)));
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < filtered.length; index++) {
      const option = filtered[index];
      const element = document.createElement("div");
      element.id = `${id}-option-${index}`;
      element.className = "app-select-option";
      element.dataset.index = String(index);
      element.setAttribute("role", "option");
      element.setAttribute("aria-selected", String(option.value === select.value));
      element.textContent = option.label;
      fragment.append(element);
    }
    list.replaceChildren(fragment);
    empty.hidden = filtered.length > 0;
    activeIndex = -1;
    const selected = filtered.findIndex((option) => option.value === select.value);
    setActive(selected >= 0 && !filter?.value ? selected : filtered.length ? 0 : -1, false);
    position();
    if (activeIndex >= 0) setActive(activeIndex);
  }

  function sync() {
    options = [...select.options].filter((option) => !option.disabled && !option.hidden && !(select.required && !option.value) && !option.closest('optgroup[disabled]')).map((option) => ({ value: option.value, label: option.textContent.trim(), search: normalize(option.textContent) }));
    const selected = select.selectedOptions[0];
    valueLabel.textContent = selected?.textContent.trim() || "Selecione uma opção";
    control.title = valueLabel.textContent;
    control.dataset.placeholder = String(!select.value && (select.required || !!selected?.disabled));
    control.disabled = select.disabled;
    if (!searchable) control.setAttribute("aria-required", String(select.required));
    const descriptions = [select.getAttribute("aria-describedby"), !error.hidden ? error.id : null].filter(Boolean).join(" ");
    if (descriptions) control.setAttribute("aria-describedby", descriptions); else control.removeAttribute("aria-describedby");
    if (select.validity.valid) { error.hidden = true; error.textContent = ""; control.removeAttribute("aria-invalid"); }
    if (select.disabled && isOpen) close(false);
    else if (isOpen) render();
  }

  function open() {
    if (control.disabled || isOpen) return;
    activeWidget?.close(false);
    isOpen = true;
    activeWidget = widget;
    if (filter) filter.value = "";
    panel.hidden = false;
    control.setAttribute("aria-expanded", "true");
    render();
    (filter || control).focus({ preventScroll: true });
  }

  function close(restoreFocus = true) {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    control.setAttribute("aria-expanded", "false");
    control.removeAttribute("aria-activedescendant");
    filter?.removeAttribute("aria-activedescendant");
    if (activeWidget === widget) activeWidget = null;
    if (restoreFocus && !control.disabled && control.getClientRects().length) control.focus({ preventScroll: true });
  }

  function commit(index) {
    const option = filtered[index];
    if (!option) return;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    window.queueMicrotask(sync);
  }

  function keydown(event) {
    if (event.key === "Escape" && isOpen) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === "Tab" && isOpen) { event.preventDefault(); close(false); focusAdjacent(control, event.shiftKey ? -1 : 1); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) open();
      else setActive(Math.max(0, Math.min(filtered.length - 1, activeIndex + (event.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (isOpen && (event.key === "Enter" || (!filter && event.key === " "))) { event.preventDefault(); commit(activeIndex); return; }
    if (!filter && (event.key === "Home" || event.key === "End")) { event.preventDefault(); if (!isOpen) open(); setActive(event.key === "Home" ? 0 : filtered.length - 1); return; }
    if (!filter && event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      typeahead = (now - lastType < 600 ? typeahead : "") + normalize(event.key);
      lastType = now;
      if (!isOpen) open();
      const index = filtered.findIndex((option) => option.search.startsWith(typeahead));
      if (index >= 0) setActive(index);
    }
  }

  const widget = { control, panel, close, position };
  widgets.set(select, widget);
  control.addEventListener("click", () => isOpen ? close() : open(), eventOptions);
  control.addEventListener("keydown", keydown, eventOptions);
  filter?.addEventListener("input", render, eventOptions);
  filter?.addEventListener("keydown", keydown, eventOptions);
  list.addEventListener("pointerdown", (event) => { if (event.pointerType === "mouse") event.preventDefault(); }, eventOptions);
  list.addEventListener("click", (event) => {
    const option = event.target.closest('[role="option"]');
    if (option && list.contains(option)) commit(Number(option.dataset.index));
  }, eventOptions);
  dialog?.addEventListener("close", () => close(false), eventOptions);
  dialog?.addEventListener("animationend", position, eventOptions);
  select.addEventListener("change", () => window.queueMicrotask(sync), eventOptions);
  select.addEventListener("focus", () => control.focus({ preventScroll: true }), eventOptions);
  select.addEventListener("invalid", (event) => {
    event.preventDefault();
    error.textContent = select.validity.valueMissing ? "Selecione uma opção para continuar." : select.validationMessage;
    error.hidden = false;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("aria-describedby", [select.getAttribute("aria-describedby"), error.id].filter(Boolean).join(" "));
    control.focus();
  }, eventOptions);
  select.form?.addEventListener("reset", () => { close(false); window.queueMicrotask(sync); }, eventOptions);
  new MutationObserver(sync).observe(select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled", "required", "aria-busy", "aria-describedby", "label", "selected"] });
  sync();
}

export function initializeAppSelects(root = document) {
  if (!document.querySelector('link[data-app-select-styles]')) return;
  for (const select of root.querySelectorAll("select")) enhanceSelect(select);
  if (listening) return;
  listening = true;
  document.addEventListener("pointerdown", (event) => {
    if (activeWidget && !activeWidget.panel.contains(event.target) && !activeWidget.control.contains(event.target)) activeWidget.close(false);
  }, { passive: true });
  document.addEventListener("focusin", (event) => {
    if (activeWidget && !activeWidget.panel.contains(event.target) && event.target !== activeWidget.control) activeWidget.close(false);
  });
  const reposition = (event) => {
    if (activeWidget && !(event?.target instanceof Element && activeWidget.panel.contains(event.target))) activeWidget.position();
  };
  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { capture: true, passive: true });
  window.visualViewport?.addEventListener("resize", reposition, { passive: true });
  window.visualViewport?.addEventListener("scroll", reposition, { passive: true });
  window.addEventListener("hashchange", () => activeWidget?.close(false));
  window.addEventListener("pagehide", () => activeWidget?.close(false));
}
