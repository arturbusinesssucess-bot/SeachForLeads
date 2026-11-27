import { getPipeline } from './pipeline.js?v=mobile-sync-20261126';
import { buildUsageCards } from '../shared/usage-model.mjs';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initializeUsage() {
  const hosts = [...document.querySelectorAll('[data-usage-panel]')];
  let uid = null;
  let state = {};
  const panels = hosts.map((host, index) => {
    const section = element('section', 'account-usage');
    const heading = element('header', 'account-usage-heading');
    const title = element('h2', '', 'Uso da conta');
    title.id = `account-usage-title-${index}`;
    section.setAttribute('aria-labelledby', title.id);
    heading.append(title, element('p', '', 'Acompanhe os limites do seu acesso e quanto ainda pode usar.'));
    const grid = element('div', 'account-usage-grid');
    const rules = element('div', 'account-usage-rules');
    rules.append(element('h3', '', 'Como funcionam os limites'));
    const list = element('ul');
    for (const rule of [
      'CRM: o limite considera todos os leads salvos na conta, independentemente da etapa.',
      'Prospecção e IA: os limites são por busca e por análise; não são uma cota mensal.',
      'Funil: as etapas Fechado e Perdido também entram no limite de etapas.',
    ]) list.append(element('li', '', rule));
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
        const value = element('p', 'account-usage-value', card.value);
        article.append(label, value);
        if (card.suffix) article.append(element('p', 'account-usage-suffix', card.suffix));
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
        article.append(element('p', 'account-usage-detail', card.detail));
        if (card.note) article.append(element('p', 'account-usage-note', card.note));
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
