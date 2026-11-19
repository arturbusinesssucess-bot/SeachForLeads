import { updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { createCustomStage, getPipeline, getDefaultPipeline, isCustomStage, isOpenStage, MAX_PIPELINE_STAGES, MAX_STAGE_NAME_LENGTH, savePipeline, STAGE_COLOR_OPTIONS, validatePipeline, validateStageName } from "./pipeline.js?v=status-length";

const SECTIONS = new Set(["general", "profile", "security", "account", "plans", "pipeline"]);
const RIGHT_ARROW = "M12.97 3.97a.75.75 0 0 1 1.06 0l7.5 7.5a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 1 1-1.06-1.06l6.22-6.22H3a.75.75 0 0 1 0-1.5h16.19l-6.22-6.22a.75.75 0 0 1 0-1.06Z";
const copyStages = (stages) => stages.map(({ key, label, color }) => ({ key, label, color }));
const equalStages = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function moveArrow() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", RIGHT_ARROW);
  path.setAttribute("fill-rule", "evenodd");
  path.setAttribute("clip-rule", "evenodd");
  svg.append(path);
  return svg;
}

export function initializeSettings({ getAuthInstance = () => null, onProfileUpdated, isStageInUse = () => false } = {}) {
  const root = document.querySelector('[data-view="settings"]');
  if (!root) return null;
  const tabs = [...root.querySelectorAll("[data-settings-tab]")];
  const panels = [...root.querySelectorAll("[data-settings-panel]")];
  const tablist = root.querySelector('[role="tablist"]');
  const profileForm = root.querySelector("#settings-profile-form");
  const nameInput = root.querySelector("#settings-display-name");
  const emailInput = root.querySelector("#settings-email");
  const profileSave = root.querySelector("#settings-profile-save");
  const profileCancel = root.querySelector("#settings-profile-cancel");
  const profileStatus = root.querySelector("#settings-profile-status");
  const signInMethod = root.querySelector("#settings-sign-in-method");
  const passwordHelp = root.querySelector("#settings-password-help");
  const resetButton = root.querySelector("#settings-password-reset");
  const googlePasswordLink = root.querySelector("#settings-password-google");
  const securityStatus = root.querySelector("#settings-security-status");
  const pipelineList = root.querySelector("#settings-pipeline-list");
  const pipelineAdd = root.querySelector("#settings-pipeline-add");
  const pipelineCount = root.querySelector("#settings-pipeline-count");
  const pipelineSave = root.querySelector("#settings-pipeline-save");
  const pipelineCancel = root.querySelector("#settings-pipeline-cancel");
  const pipelineDefault = root.querySelector("#settings-pipeline-default");
  const pipelineStatus = root.querySelector("#settings-pipeline-status");
  if (!tablist || !profileForm || !nameInput || !emailInput || !profileSave || !profileCancel || !profileStatus || !signInMethod || !passwordHelp || !resetButton || !googlePasswordLink || !securityStatus || !pipelineList || !pipelineAdd || !pipelineCount || !pipelineSave || !pipelineCancel || !pipelineDefault || !pipelineStatus || tabs.length !== SECTIONS.size || panels.length !== SECTIONS.size) return null;

  const mobile = window.matchMedia("(max-width: 767px)");
  const coarsePointer = window.matchMedia("(pointer: coarse)");
  let currentUser = null;
  let userRevision = 0;
  let savedName = "";
  let profileBusy = false;
  let passwordBusy = false;
  let resetSent = false;
  let savedStages = [];
  let draftStages = [];
  let pipelineBusy = false;
  let draggingKey = null;

  function showSection(section) {
    const selected = SECTIONS.has(section) ? section : "general";
    for (const tab of tabs) {
      const active = tab.dataset.settingsTab === selected;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.settingsPanel !== selected;
    return selected;
  }

  function updateOrientation() { tablist.setAttribute("aria-orientation", mobile.matches ? "horizontal" : "vertical"); }
  updateOrientation();
  mobile.addEventListener("change", updateOrientation);
  for (const tab of tabs) tab.addEventListener("click", () => showSection(tab.dataset.settingsTab));
  tablist.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-settings-tab]");
    if (!target || event.altKey || event.ctrlKey || event.metaKey) return;
    const index = tabs.indexOf(target);
    let next = index;
    const forward = mobile.matches ? "ArrowRight" : "ArrowDown";
    const backward = mobile.matches ? "ArrowLeft" : "ArrowUp";
    if (event.key === forward) next = (index + 1) % tabs.length;
    else if (event.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    showSection(tabs[next].dataset.settingsTab);
    tabs[next].focus();
  });
  for (const shortcut of root.querySelectorAll("[data-settings-open]")) shortcut.addEventListener("click", () => {
    const selected = showSection(shortcut.dataset.settingsOpen);
    panels.find((panel) => panel.dataset.settingsPanel === selected)?.focus({ preventScroll: true });
  });

  function refreshProfileButtons() {
    const dirty = nameInput.value !== savedName;
    nameInput.disabled = !currentUser || profileBusy;
    profileSave.disabled = !currentUser || profileBusy || !dirty;
    profileCancel.disabled = !currentUser || profileBusy || !dirty;
    profileSave.setAttribute("aria-busy", String(profileBusy));
    const label = profileSave.querySelector(".app-button-label");
    if (label) label.textContent = profileBusy ? "Salvando…" : "Salvar alterações";
  }

  function renderIdentity() {
    const display = currentUser?.displayName?.trim() || currentUser?.email?.split("@")[0] || "Sua conta";
    const email = currentUser?.email || "";
    root.querySelector("#settings-profile-name").textContent = display;
    root.querySelector("#settings-profile-email").textContent = email;
    root.querySelector("#settings-account-name").textContent = display;
    root.querySelector("#settings-account-email").textContent = email || "E-mail não informado";
    root.querySelector("#settings-profile-avatar").textContent = display.split(/\s+/u).slice(0, 2).map((part) => Array.from(part)[0] || "").join("").toLocaleUpperCase("pt-BR");
    emailInput.value = email;
  }

  nameInput.addEventListener("input", () => {
    nameInput.setCustomValidity("");
    nameInput.removeAttribute("aria-invalid");
    profileStatus.textContent = "";
    refreshProfileButtons();
  });
  nameInput.addEventListener("invalid", () => {
    profileStatus.textContent = "Use um nome de 2 a 80 caracteres.";
    nameInput.setAttribute("aria-invalid", "true");
  });
  profileCancel.addEventListener("click", () => {
    if (profileBusy) return;
    nameInput.value = savedName;
    nameInput.setCustomValidity("");
    nameInput.removeAttribute("aria-invalid");
    profileStatus.textContent = "Alterações descartadas.";
    refreshProfileButtons();
  });
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || profileBusy) return;
    const displayName = nameInput.value.trim();
    if (displayName.length < 2 || displayName.length > 80) {
      nameInput.setCustomValidity("Use um nome de 2 a 80 caracteres.");
      nameInput.setAttribute("aria-invalid", "true");
      profileStatus.textContent = "Use um nome de 2 a 80 caracteres.";
      nameInput.reportValidity();
      return;
    }
    const user = currentUser, revision = userRevision;
    profileBusy = true;
    profileStatus.textContent = "Salvando seu nome…";
    refreshProfileButtons();
    try {
      await updateProfile(user, { displayName });
      if (revision !== userRevision || user !== currentUser) return;
      savedName = displayName;
      nameInput.value = displayName;
      renderIdentity();
      profileStatus.textContent = "Nome atualizado.";
      try { onProfileUpdated?.(displayName); } catch {}
    } catch {
      if (revision === userRevision) profileStatus.textContent = "Não foi possível salvar seu nome. Tente novamente.";
    } finally {
      if (revision === userRevision) { profileBusy = false; refreshProfileButtons(); }
    }
  });

  function canResetPassword() {
    return Boolean(currentUser?.email && currentUser.providerData?.some(({ providerId }) => providerId === "password"));
  }

  function refreshSecurity() {
    const providers = currentUser?.providerData || [];
    const names = [...new Set(providers.map((provider) => provider.providerId === "google.com" ? "Google" : provider.providerId === "password" ? "E-mail e senha" : "Outro provedor"))];
    signInMethod.textContent = currentUser ? names.join(", ") || "Sua conta" : "Entre na sua conta para continuar.";
    const canReset = canResetPassword();
    const usesGoogle = providers.some(({ providerId }) => providerId === "google.com");
    resetButton.hidden = !canReset;
    resetButton.disabled = !canReset || passwordBusy || resetSent;
    resetButton.setAttribute("aria-busy", String(passwordBusy));
    googlePasswordLink.hidden = !usesGoogle;
    const label = resetButton.querySelector(".app-button-label");
    if (label) label.textContent = passwordBusy ? "Enviando…" : resetSent ? "E-mail enviado" : "Enviar e-mail para redefinir senha";
    const instructions = [];
    if (canReset) instructions.push("Enviaremos um link para redefinir sua senha do SearchForLeads ao e-mail da conta.");
    if (usesGoogle) instructions.push("Para mudar a senha do Google, abra as configurações da sua Conta Google.");
    const fallback = currentUser ? "A redefinição de senha está indisponível para o método de acesso da sua conta." : "Entre na sua conta para ver as opções de acesso.";
    passwordHelp.textContent = instructions.join(" ") || fallback;
  }
  resetButton.addEventListener("click", async () => {
    if (!canResetPassword() || passwordBusy || resetSent) return;
    const auth = getAuthInstance();
    if (!auth) { securityStatus.textContent = "Não foi possível confirmar sua sessão. Entre novamente."; return; }
    const user = currentUser, revision = userRevision;
    passwordBusy = true;
    securityStatus.textContent = "Enviando o e-mail de redefinição…";
    refreshSecurity();
    try {
      await sendPasswordResetEmail(auth, user.email);
      if (revision !== userRevision || user !== currentUser) return;
      resetSent = true;
      securityStatus.textContent = "E-mail enviado. Confira sua caixa de entrada e a pasta de spam.";
    } catch (error) {
      if (revision === userRevision) securityStatus.textContent = error?.code === "auth/too-many-requests" ? "Muitas tentativas em pouco tempo. Aguarde antes de solicitar outro e-mail." : "Não foi possível enviar o e-mail. Tente novamente.";
    } finally {
      if (revision === userRevision) { passwordBusy = false; refreshSecurity(); }
    }
  });

  function pipelineDirty() { return !equalStages(draftStages, savedStages); }
  function openStageCount() { return draftStages.filter(({ key }) => isOpenStage(key)).length; }
  function refreshPipelineButtons() {
    const dirty = pipelineDirty();
    pipelineSave.disabled = !currentUser || pipelineBusy || !dirty;
    pipelineCancel.disabled = !currentUser || pipelineBusy || !dirty;
    pipelineDefault.disabled = !currentUser || pipelineBusy || equalStages(draftStages, getDefaultPipeline());
    pipelineAdd.disabled = !currentUser || pipelineBusy || draftStages.length >= MAX_PIPELINE_STAGES;
    pipelineCount.textContent = `${draftStages.length} de ${MAX_PIPELINE_STAGES} etapas`;
    pipelineSave.setAttribute("aria-busy", String(pipelineBusy));
  }

  function stageRow(key) { return [...pipelineList.children].find((row) => row.dataset.stageKey === key); }
  function updateMoveLabels(row, stage, index) {
    const name = stage.label.trim() || "etapa";
    const lastOpenIndex = openStageCount() - 1;
    for (const button of row.querySelectorAll("[data-move]")) {
      const up = button.dataset.move === "up";
      button.disabled = !currentUser || pipelineBusy || (up ? index === 0 : index === lastOpenIndex);
      const label = `Mover ${name} para ${up ? "cima" : "baixo"}`;
      button.setAttribute("aria-label", label);
      button.title = label;
    }
    row.querySelector("[data-remove-stage]")?.setAttribute("aria-label", `Remover ${name}`);
  }

  function colorDot(color) {
    const dot = node("span", "stage-color-dot");
    dot.dataset.stageColor = color;
    dot.setAttribute("aria-hidden", "true");
    return dot;
  }

  function updateColorPicker(picker, stage) {
    const summary = picker.querySelector("summary");
    const color = STAGE_COLOR_OPTIONS.find((option) => option.key === stage.color);
    const label = `Cor de ${stage.label.trim() || "etapa"}: ${color.label}`;
    summary.setAttribute("aria-label", label);
    summary.title = label;
    summary.firstElementChild.dataset.stageColor = stage.color;
    for (const button of picker.querySelectorAll("[data-pick-color]")) {
      button.setAttribute("aria-pressed", String(button.dataset.pickColor === stage.color));
    }
  }

  function createColorPicker(stage) {
    const picker = node("details", "settings-stage-colors");
    picker.name = "settings-stage-colors";
    const summary = node("summary", "settings-color-trigger");
    summary.append(colorDot(stage.color));
    const palette = node("div", "settings-stage-palette");
    palette.setAttribute("role", "group");
    palette.setAttribute("aria-label", "Cores da etapa");
    for (const option of STAGE_COLOR_OPTIONS) {
      const button = node("button", "settings-color-choice");
      button.type = "button";
      button.dataset.pickColor = option.key;
      button.append(colorDot(option.key), node("span", "", option.label));
      palette.append(button);
    }
    picker.append(summary, palette);
    updateColorPicker(picker, stage);
    return picker;
  }

  function renderPipeline(focusKey, direction, scroll = false) {
    const fragment = document.createDocumentFragment();
    draftStages.forEach((stage, index) => {
      const row = node("li", "settings-pipeline-row");
      row.dataset.stageKey = stage.key;
      const number = node("span", "settings-stage-number", String(index + 1).padStart(2, "0"));
      number.setAttribute("aria-hidden", "true");
      const open = isOpenStage(stage.key);
      if (open) {
        number.draggable = !!currentUser && !coarsePointer.matches;
        number.dataset.dragStage = stage.key;
        number.title = "Arraste para reordenar";
      }
      row.append(number);
      const colorPicker = createColorPicker(stage);
      if (open) {
        const field = node("div", "settings-stage-main");
        const label = node("label", "", `Etapa ${index + 1}`);
        label.htmlFor = `settings-stage-${stage.key}`;
        const input = node("input");
        input.id = label.htmlFor;
        input.type = "text";
        input.value = stage.label;
        input.minLength = 2;
        input.maxLength = MAX_STAGE_NAME_LENGTH;
        input.required = true;
        input.autocomplete = "off";
        input.disabled = !currentUser || pipelineBusy;
        input.dataset.stageInput = stage.key;
        input.setAttribute("aria-describedby", "settings-pipeline-status");
        const fieldHeading = node("div", "settings-stage-heading");
        fieldHeading.append(label);
        if (isCustomStage(stage.key)) {
          const remove = node("button", "settings-stage-remove", "Remover");
          remove.type = "button";
          remove.dataset.removeStage = "";
          remove.disabled = !currentUser || pipelineBusy;
          fieldHeading.append(remove);
        }
        field.append(fieldHeading, input);
        const controls = node("div", "settings-move-controls");
        for (const direction of ["up", "down"]) {
          const button = node("button", "settings-move");
          button.type = "button";
          button.dataset.move = direction;
          button.append(moveArrow());
          controls.append(button);
        }
        row.append(field, colorPicker, controls);
        updateMoveLabels(row, stage, index);
      } else {
        row.dataset.fixed = "true";
        const fixed = node("div", "settings-stage-final");
        fixed.append(node("strong", "", stage.label), node("span", "", "Etapa fixa"));
        row.append(fixed, colorPicker);
      }
      fragment.append(row);
    });
    pipelineList.replaceChildren(fragment);
    refreshPipelineButtons();
    if (focusKey) {
      const row = stageRow(focusKey);
      const target = direction ? row?.querySelector(`[data-move="${direction}"]:not([disabled])`) : null;
      const control = target || row?.querySelector("input");
      control?.focus({ preventScroll: !scroll });
      if (scroll) control?.select();
    }
  }

  function moveStage(key, targetIndex, direction) {
    const openCount = openStageCount();
    if (!currentUser || pipelineBusy || !isOpenStage(key) || targetIndex < 0 || targetIndex >= openCount) return;
    const index = draftStages.findIndex((stage) => stage.key === key);
    if (index < 0 || index === targetIndex) return;
    const [stage] = draftStages.splice(index, 1);
    draftStages.splice(targetIndex, 0, stage);
    renderPipeline(key, direction);
    pipelineStatus.textContent = `${stage.label.trim() || "Etapa"} agora está na posição ${targetIndex + 1} de ${openCount}.`;
  }

  pipelineAdd.addEventListener("click", () => {
    if (!currentUser || pipelineBusy || draftStages.length >= MAX_PIPELINE_STAGES) return;
    const stage = createCustomStage(draftStages);
    draftStages.splice(openStageCount(), 0, stage);
    renderPipeline(stage.key, null, true);
    pipelineStatus.textContent = "Etapa adicionada ao rascunho. Salve o funil para aplicar.";
  });

  pipelineList.addEventListener("input", (event) => {
    const input = event.target.closest("[data-stage-input]");
    if (!input || pipelineBusy) return;
    const index = draftStages.findIndex((stage) => stage.key === input.dataset.stageInput);
    if (index < 0 || !isOpenStage(draftStages[index].key)) return;
    draftStages[index].label = input.value;
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
    pipelineStatus.textContent = "";
    const row = input.closest("li");
    updateMoveLabels(row, draftStages[index], index);
    updateColorPicker(row.querySelector(".settings-stage-colors"), draftStages[index]);
    refreshPipelineButtons();
  });
  pipelineList.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-stage]");
    if (remove && currentUser && !pipelineBusy) {
      const key = remove.closest("li").dataset.stageKey;
      if (!isCustomStage(key)) return;
      if (isStageInUse(key)) {
        pipelineStatus.textContent = "Mova os leads dessa etapa antes de removê-la.";
        return;
      }
      const index = draftStages.findIndex((stage) => stage.key === key);
      draftStages.splice(index, 1);
      renderPipeline(draftStages[Math.max(0, index - 1)].key);
      pipelineStatus.textContent = "Etapa removida do rascunho. Salve o funil para aplicar.";
      return;
    }
    const choice = event.target.closest("[data-pick-color]");
    if (choice && currentUser && !pipelineBusy) {
      const picker = choice.closest("details");
      const stage = draftStages.find((item) => item.key === picker.closest("li").dataset.stageKey);
      stage.color = choice.dataset.pickColor;
      updateColorPicker(picker, stage);
      picker.open = false;
      picker.querySelector("summary").focus({ preventScroll: true });
      pipelineStatus.textContent = "";
      refreshPipelineButtons();
      return;
    }
    const button = event.target.closest("[data-move]");
    if (!button || button.disabled) return;
    const key = button.closest("[data-stage-key]")?.dataset.stageKey;
    const index = draftStages.findIndex((stage) => stage.key === key);
    moveStage(key, index + (button.dataset.move === "up" ? -1 : 1), button.dataset.move);
  });
  document.addEventListener("click", (event) => {
    for (const picker of pipelineList.querySelectorAll(".settings-stage-colors[open]")) {
      if (!picker.contains(event.target)) picker.open = false;
    }
  });
  pipelineList.addEventListener("toggle", (event) => {
    const picker = event.target;
    if (picker.open) picker.querySelector(".settings-stage-palette").scrollIntoView({ block: "nearest", inline: "nearest" });
  }, true);
  pipelineList.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const picker = event.target.closest(".settings-stage-colors[open]");
    if (!picker) return;
    event.preventDefault();
    picker.open = false;
    picker.querySelector("summary").focus({ preventScroll: true });
  });
  pipelineList.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-drag-stage]");
    const key = handle?.dataset.dragStage;
    if (!currentUser || pipelineBusy || coarsePointer.matches || !isOpenStage(key) || !event.dataTransfer) { event.preventDefault(); return; }
    draggingKey = key;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  });
  pipelineList.addEventListener("dragover", (event) => {
    const row = event.target.closest("[data-stage-key]");
    if (!draggingKey || !row || !isOpenStage(row.dataset.stageKey)) return;
    event.preventDefault();
    for (const item of pipelineList.children) item.dataset.dropTarget = String(item === row);
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  function clearDrag() { draggingKey = null; for (const row of pipelineList.children) delete row.dataset.dropTarget; }
  pipelineList.addEventListener("drop", (event) => {
    const row = event.target.closest("[data-stage-key]");
    if (!draggingKey || !row || !isOpenStage(row.dataset.stageKey)) return;
    event.preventDefault();
    const key = draggingKey, target = draftStages.findIndex((stage) => stage.key === row.dataset.stageKey);
    clearDrag();
    moveStage(key, target);
  });
  pipelineList.addEventListener("dragend", clearDrag);
  pipelineCancel.addEventListener("click", () => {
    if (pipelineBusy) return;
    savedStages = copyStages(getPipeline());
    draftStages = copyStages(savedStages);
    renderPipeline();
    pipelineStatus.textContent = "Alterações descartadas.";
  });
  pipelineDefault.addEventListener("click", () => {
    if (!currentUser || pipelineBusy) return;
    draftStages = copyStages(getDefaultPipeline());
    renderPipeline();
    pipelineStatus.textContent = "Etapas padrão preparadas. Salve o funil para aplicar.";
  });
  pipelineSave.addEventListener("click", async () => {
    if (!currentUser || pipelineBusy || !pipelineDirty()) return;
    const removedInUse = savedStages.find(({ key }) => !draftStages.some((stage) => stage.key === key) && isStageInUse(key));
    if (removedInUse) {
      pipelineStatus.textContent = `Mova os leads de “${removedInUse.label}” antes de remover a etapa.`;
      return;
    }
    for (const input of pipelineList.querySelectorAll("input")) {
      const previousLabel = savedStages.find(({ key }) => key === input.dataset.stageInput)?.label;
      let message = "";
      try { validateStageName(input.value, previousLabel); }
      catch (error) { message = error.message; }
      input.setCustomValidity(message);
      if (!input.reportValidity()) {
        input.setAttribute("aria-invalid", "true");
        pipelineStatus.textContent = input.validationMessage;
        return;
      }
    }
    let normalized;
    try { normalized = validatePipeline(draftStages, savedStages); }
    catch (error) { pipelineStatus.textContent = error.message || "Revise os nomes e a ordem das etapas."; return; }
    const revision = userRevision;
    pipelineBusy = true;
    refreshPipelineButtons();
    try {
      await savePipeline(normalized, savedStages);
      if (revision !== userRevision) return;
      savedStages = copyStages(getPipeline());
      draftStages = copyStages(savedStages);
      pipelineStatus.textContent = "Funil sincronizado com sua conta.";
    } catch (error) {
      if (revision === userRevision) pipelineStatus.textContent = error.message || "Não foi possível sincronizar o funil. Tente novamente.";
    } finally {
      if (revision === userRevision) { pipelineBusy = false; renderPipeline(); }
    }
  });
  window.addEventListener("sfl:pipeline-changed", (event) => {
    if (pipelineBusy || !currentUser || event.detail?.uid !== currentUser.uid) return;
    const dirty = pipelineDirty();
    if (dirty) { pipelineStatus.textContent = "O funil mudou em outro dispositivo. Descarte o rascunho para carregar a versão atual."; }
    else {
      savedStages = copyStages(getPipeline());
      draftStages = copyStages(savedStages);
      renderPipeline();
    }
  });
  window.addEventListener("sfl:pipeline-sync-error", (event) => {
    if (event.detail?.uid === currentUser?.uid) pipelineStatus.textContent = "Não foi possível sincronizar o funil. Verifique sua conexão e recarregue a página.";
  });

  showSection("general");
  return {
    open(section = "general") { showSection(section); },
    setUser(user) {
      userRevision++;
      currentUser = user || null;
      savedName = currentUser?.displayName || "";
      profileBusy = false;
      passwordBusy = false;
      resetSent = false;
      nameInput.value = savedName;
      nameInput.setCustomValidity("");
      nameInput.removeAttribute("aria-invalid");
      profileStatus.textContent = "";
      securityStatus.textContent = "";
      pipelineStatus.textContent = "";
      renderIdentity();
      refreshProfileButtons();
      refreshSecurity();
      savedStages = copyStages(getPipeline());
      draftStages = copyStages(savedStages);
      renderPipeline();
    },
  };
}

