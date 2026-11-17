# IA do SearchForLeads

A integração usa OpenRouter no servidor em `/api/ai`. O navegador envia somente o ID token de login e os dados necessários à ação.

## Funções disponíveis

- Busca: interpretar uma oferta e sugerir nichos genéricos. Aplicar uma sugestão preenche o campo de nicho; não executa uma busca automaticamente.
- CRM: avaliar a compatibilidade dos primeiros cinco leads visíveis com a oferta. A análise não modifica etapas nem indicadores e não inventa empresas ou contatos.
- Geração de mensagens não está incluída.

## Configuração

Na Vercel, configure `OPENROUTER_API_KEY` como Secret em Production e `AI_ALLOWED_EMAILS` com os e-mails verificados autorizados, separados por vírgula. Sem essas configurações, a API permanece indisponível. Use limite de crédito na chave do OpenRouter.

O modelo padrão é `google/gemini-2.5-flash`; `OPENROUTER_MODEL` permite alterá-lo no servidor. O cliente não pode escolher modelo, endpoint ou instruções de sistema.

## Controles e limites

Os tokens são verificados com as chaves públicas do Firebase para o projeto `seachforleads`. O acesso inicial usa uma lista explícita de contas verificadas. Essa verificação não consulta revogação de tokens; o token de login tem validade curta. Para abrir o recurso a todos os cadastros, adicione cotas distribuídas por usuário antes de remover a lista.

Cada requisição aceita no máximo 16 KiB, uma oferta de 2.000 caracteres e cinco leads. As respostas são validadas pelo servidor, têm limite de tamanho e timeout; erros não retornam chaves ou respostas internas do provedor. A chave nunca é enviada ao navegador.

As análises ficam apenas na tela e são invalidadas quando a oferta ou os leads visíveis mudam. Não substituem uma fonte de empresas reais nem confirmam intenção de compra.

## Validação

Execute `npm run test:ai`. Os testes usam tokens assinados em memória e respostas simuladas, sem consumir créditos do OpenRouter.
