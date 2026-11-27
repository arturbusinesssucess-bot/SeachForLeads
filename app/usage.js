import { getPipeline } from './pipeline.js?v=mobile-sync-20261126';
import { buildUsageCards } from '../shared/usage-model.mjs';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const cardScopes = { crm: 'Total da conta', search: 'Por busca', pipeline: 'Total do funil', ai: 'Por análise' };
const cardViews = { crm: 'crm', search: 'search', pipeline: 'analytics', ai: 'search' };

function usageIcon(key) {
  const source = document.querySelector(`[data-view-link="${cardViews[key]}"] svg`);
  if (!source) return null;
  const icon = source.cloneNode(true);
  icon.removeAttribute('id');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  return icon;
}

function accessPresentation(signedIn, access) {
  if (!signedIn) return { label: 'Sem sessão', tone: 'pending', description: 'Entre para acompanhar os recursos da sua conta.' };
  if (access == null) return { label: 'Verificando', tone: 'pending', description: 'Estamos conferindo a disponibilidade do seu acesso.' };
  if (!access.available) return { label: 'Indisponível', tone: 'unavailable', description: 'A busca ainda não está liberada para esta conta.' };
  return access.mode === 'live'
    ? { label: 'Antecipado', tone: 'ready', description: 'Seu acesso à busca de empresas está liberado.' }
    : { label: 'Demonstração', tone: 'ready', description: 'Explore o app com os recursos do acesso de teste.' };
}

export function initializeUsage() {
  const hosts = [...document.querySelectorAll('[data-usage-panel]')];
  let uid = null;
  let state = {};
  const panels = hosts.map((host, index) => {
    const section = element('section', 'account-usage');
    const heading = element('header', 'account-usage-heading');
    const title = element('h2', '', 'Seu plano e uso');
    title.id = `account-usage-title-${index}`;
    section.setAttribute('aria-labelledby', title.id);
    heading.append(title, element('p', '', 'Seu acesso atual e os limites disponíveis em um só lugar.'));
    const grid = element('div', 'account-usage-grid');
    const rules = element('div', 'account-usage-rules');
    rules.append(element('h3', '', 'Entenda seus limites'));
    const list = element('ul');
    for (const [label, description] of [
      ['Leads no CRM', 'Todos os leads salvos contam, em qualquer etapa do funil.'],
      ['Buscas e análises', 'O limite vale a cada busca ou análise com IA, sem cota mensal.'],
      ['Etapas do funil', 'Fechado e Perdido também fazem parte do total de etapas.'],
    ]) {
      const item = element('li');
      item.append(element('strong', '', label), element('p', '', description));
      list.append(item);
    }
    rules.append(list);
    section.append(heading, grid, rules);
    host.replaceChildren(section);
    return grid;
  });

  function render() {
    const cards = buildUsageCards({ ...state, signedIn: Boolean(uid) });
    for (const grid of panels) {
      const content = document.createDocumentFragment();
      for (const card of cards) {
        const article = element('article', 'account-usage-card');
        article.dataset.usageCard = card.key;
        article.dataset.state = card.state;
        const label = element('h3', 'account-usage-label', card.label);
        if (card.key === 'access') {
          const access = accessPresentation(Boolean(uid), state.access);
          article.dataset.accessState = access.tone;
          const main = element('div', 'account-usage-access-main');
          const brand = element('span', 'account-usage-brand');
          const logo = element('img');
          logo.src = '/public/loupe-logo.svg';
          logo.alt = '';
          logo.width = 40;
          logo.height = 40;
          brand.append(logo);
          const copy = element('div', 'account-usage-access-copy');
          const top = element('div', 'account-usage-access-top');
          top.append(label, element('span', 'account-usage-status', access.label));
          copy.append(top, element('p', 'account-usage-value', card.value), element('p', 'account-usage-access-description', access.description));
          main.append(brand, copy);
          const note = element('div', 'account-usage-access-note');
          note.append(element('span', 'account-usage-note-label', 'Assinaturas'), element('p', 'account-usage-detail', card.detail));
          article.append(main, note);
          content.append(article);
          continue;
        }
        const top = element('div', 'account-usage-card-top');
        const iconWrap = element('span', 'account-usage-icon');
        const icon = usageIcon(card.key);
        if (icon) iconWrap.append(icon);
        iconWrap.setAttribute('aria-hidden', 'true');
        top.append(iconWrap, element('span', 'account-usage-scope', cardScopes[card.key]));
        const amount = element('div', 'account-usage-amount');
        amount.append(element('p', 'account-usage-value', card.value));
        if (card.suffix) amount.append(element('p', 'account-usage-suffix', card.suffix));
        article.append(top, label, amount);
        if (card.progress) {
          const progress = element('div', 'account-usage-progress');
          progress.setAttribute('role', 'progressbar');
          progress.setAttribute('aria-label', card.label);
          progress.setAttribute('aria-valuemin', '0');
          progress.setAttribute('aria-valuemax', String(card.progress.limit));
          progress.setAttribute('aria-valuenow', String(Math.min(card.progress.used, card.progress.limit)));
          progress.setAttribute('aria-valuetext', `${card.progress.used} de ${card.progress.limit}`);
          const fill = element('span');
          fill.style.width = `${Math.min(100, 100 * card.progress.used / card.progress.limit)}%`;
          progress.append(fill);
          article.append(progress);
        }
        const footer = element('div', 'account-usage-card-footer');
        footer.append(element('p', 'account-usage-detail', card.detail));
        if (card.note) footer.append(element('p', 'account-usage-note', card.note));
        article.append(footer);
        content.append(article);
      }
      grid.replaceChildren(content);
    }
  }

  window.addEventListener('sfl:pipeline-changed', (event) => {
    if (!uid || event.detail?.uid !== uid) return;
    state.pipelineCount = getPipeline().length;
    render();
  });
  render();
  return {
    setUser(user) {
      uid = user?.uid ?? null;
      state = {};
      render();
    },
    setAccess(access) {
      if (!uid) return;
      state.access = access;
      render();
    },
    setCRM(leads, { confirmed = false } = {}) {
      if (!uid) return;
      const count = Array.isArray(leads) ? new Set(leads.map((lead) => lead.id).filter(Boolean)).size : null;
      state.crmCount = count === 0 && !confirmed ? null : count;
      state.crmConfirmed = confirmed;
      render();
    },
    setSearch(search) {
      if (!uid) return;
      state.search = search ? { count: search.count } : null;
      render();
    },
    setAI(ai) {
      if (!uid) return;
      state.ai = ai;
      render();
    },
  };
}
