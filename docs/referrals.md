# Programa de indicações — estado e contrato de ativação

## Entregue

A aba Indique e ganhe oferece um link para a landing com `?ref=`, QR Code preto em fundo branco gerado localmente e download PNG. O código estável é SHA-256 de `sfl-referral-v1:{uid}`, truncado a 128 bits. Não contém email nem o UID em claro. Esse código ainda não está registrado no servidor. A página informa expressamente que o programa está em preparação, usa `—` para saldos desconhecidos e mantém o resgate desabilitado.

**Não há atribuição de cadastros, saldo real, trial de 14 dias nem cancelamento automático implementados nesta entrega.** O parâmetro da landing ainda não é persistido ou validado. Copiar um link não garante indicação ou recompensa.

## Fluxo solicitado para a integração de cobrança

1. Registrar no servidor um código único por UID autenticado; verificar unicidade e propriedade. Nunca confiar em UID ou saldo enviado pelo navegador.
2. Na chegada à landing, validar o código no servidor e associar um token opaco ao cadastro novo. Fechar a atribuição no momento da criação da conta; impedir autoindicação, conta preexistente, troca posterior de indicador e repetição de recompensa para o mesmo novo cliente. A política de janela de atribuição ainda precisa ser definida.
3. Registrar início e fim do teste de 14 dias em horário do servidor. Receber o primeiro pagamento confirmado após o teste por webhook Cakto autenticado. Um cadastro ou retorno do checkout não concede bônus.
4. Creditar 30 dias uma única vez por cliente elegível, em transação com ledger de eventos. Validar oferta, conta, valor e status; tratar eventos duplicados e fora de ordem, recusas, estornos e chargebacks. Definir política para estorno depois do resgate antes de ativar o programa.
5. Resgatar mediante solicitação autenticada. Reservar o saldo e solicitar o cancelamento da renovação na Cakto. Só confirmar o resgate após verificar o cancelamento; em erro, manter o saldo disponível. Definir previamente como os dias já pagos e o acúmulo de bônus serão tratados. Não consumir nem sobrescrever tempo pago silenciosamente.
6. Persistir a validade dos dias grátis no servidor. Ao expirar, exibir aviso de assinatura e bloquear operações protegidas no backend até novo pagamento. Preservar conta e dados. Não excluir automaticamente a conta.

## Dependências pendentes

- Backend de assinaturas, trial e permissões no Firebase/Vercel.
- Autenticação de servidor, segredo do webhook e credenciais Cakto próprias da aplicação.
- Fonte de leads real e limites dos planos pagos.
- Testes com replay, concorrência de resgate e falha de cancelamento antes de habilitar o programa.
