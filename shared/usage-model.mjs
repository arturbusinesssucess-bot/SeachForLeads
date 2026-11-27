export const USAGE_LIMITS = Object.freeze({ crm: 10, search: 10, pipeline: 15, ai: 5 });

export function remainingCapacity(used, limit) {
  if (!Number.isInteger(used) || used < 0 || !Number.isInteger(limit) || limit < 0) return null;
  return Math.max(0, limit - used);
}

function capacityCard(key, label, used, limit, unit, confirmed = true) {
  const remaining = remainingCapacity(used, limit);
  return {
    key, label,
    value: remaining === null ? '—' : String(used),
    suffix: `de ${limit} ${unit}`,
    detail: remaining === null ? 'Aguardando os dados da conta.'
      : !confirmed ? 'Aguardando atualização da conta.'
        : remaining === 0 ? 'Limite atingido.' : `${remaining} ${remaining === 1 ? 'vaga disponível' : 'vagas disponíveis'}.`,
    progress: remaining === null ? null : { used, limit },
    state: !confirmed ? 'pending' : remaining === 0 ? 'full' : 'ready',
  };
}

export function buildUsageCards({ signedIn = false, access = null, crmCount = null, crmConfirmed = false, search = null, pipelineCount = null, ai = null } = {}) {
  const plan = !signedIn ? 'Entre na sua conta' : access === null ? 'Verificando acesso'
    : !access.available ? 'Acesso indisponível' : access.mode === 'live' ? 'Acesso antecipado' : 'Acesso de teste';
  const lastSearch = Number.isInteger(search?.count) && search.count >= 0 ? search.count : null;
  return [
    { key: 'access', label: 'Plano em uso', value: plan, suffix: '', detail: 'Assinaturas dos planos Start, Reach e Expansion ainda não estão disponíveis.', state: 'plan' },
    capacityCard('crm', 'Leads salvos no CRM', signedIn ? crmCount : null, USAGE_LIMITS.crm, 'leads', crmConfirmed),
    { key: 'search', label: 'Prospecção de leads', value: String(USAGE_LIMITS.search), suffix: 'leads por busca',
      detail: !signedIn || lastSearch === null ? 'Nenhuma busca recente neste aparelho.' : `Última busca neste aparelho: ${lastSearch} ${lastSearch === 1 ? 'lead encontrado' : 'leads encontrados'}.`,
      note: 'O limite vale para cada busca.', state: 'ready' },
    capacityCard('pipeline', 'Etapas do funil', signedIn ? pipelineCount : null, USAGE_LIMITS.pipeline, 'etapas'),
    { key: 'ai', label: 'Análise com IA', value: String(USAGE_LIMITS.ai), suffix: 'leads por análise',
      detail: !signedIn ? 'Entre para conferir a disponibilidade.' : ai === null ? 'Verificando disponibilidade.' : ai.available ? 'Disponível para sua conta.' : 'Indisponível para sua conta no momento.',
      note: 'O limite vale para cada análise.', state: 'ready' },
  ];
}
