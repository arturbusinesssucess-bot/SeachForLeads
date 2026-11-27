import QRCode from 'qrcode';

export async function createReferralCode(uid) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sfl-referral-v1:${uid}`));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function mountReferrals(host, user) {
  if (!host || !user) return;
  const code = await createReferralCode(user.uid);
  if (!host.isConnected || host.dataset.referralUser !== user.uid) return;
  const url = `https://searchforleads.vercel.app/?ref=${code}`;
  host.innerHTML = `
    <header class="referral-heading"><h1 id="referrals-title">Boas conexões.<br><span>Mais dias para prospectar.</span></h1><p>Convide novos clientes para o SearchForLeads e ganhe 30 dias grátis quando a primeira assinatura deles for confirmada.</p></header>
    <aside class="referral-notice"><strong>Programa em preparação</strong><p>Seu link e QR Code já estão disponíveis. O registro de novos clientes, a confirmação de pagamentos e o resgate de bônus ainda não estão ativos.</p></aside>
    <div class="referral-layout">
      <section class="referral-card referral-share" aria-labelledby="referral-share-title"><span class="referral-eyebrow">Seu convite</span><h2 id="referral-share-title">Uma conexão que vale 30 dias</h2><p>Compartilhe com quem ainda não tem uma conta no SearchForLeads.</p>
        <label for="referral-link">Seu link pessoal</label><div class="referral-link-row"><input id="referral-link" readonly type="url" spellcheck="false"><button type="button" class="app-button app-button--primary" id="referral-copy"><span class="app-button-label">Copiar link</span></button></div><p class="referral-hint">O convite abre nossa página inicial. A recompensa depende da ativação do programa.</p>
        <ol class="referral-steps"><li><span>01</span><div><h3>Convide alguém novo</h3><p>Seu amigo usa o link para conhecer o app e criar uma conta.</p></div></li><li><span>02</span><div><h3>Ele testa e depois assina</h3><p>Após os 14 dias de teste, o primeiro pagamento precisa ser confirmado.</p></div></li><li><span>03</span><div><h3>Você recebe 30 dias</h3><p>O bônus fica disponível para resgate na sua conta.</p></div></li></ol>
      </section>
      <section class="referral-card referral-qr" aria-labelledby="referral-qr-title"><h2 id="referral-qr-title">Seu convite em QR Code</h2><p>Baixe e compartilhe seu convite.</p><div class="referral-qr-preview"><canvas id="referral-qr-canvas" role="img" aria-label="QR Code do seu link pessoal"></canvas><strong>Conheça o SearchForLeads</strong></div>
        <button class="referral-secondary" id="referral-download" type="button" disabled>Baixar QR Code em PNG</button><p class="referral-hint">Imagem com fundo branco para facilitar a leitura.</p>
      </section>
    </div>
    <p class="referral-feedback" id="referral-feedback" role="status" aria-live="polite"></p>
    <section class="referral-balance referral-card" aria-labelledby="referral-balance-title"><div><span class="referral-eyebrow">Suas recompensas</span><h2 id="referral-balance-title">Dias extras para ir mais longe</h2><p>Quando o programa estiver ativo, suas indicações e bônus aparecerão aqui.</p></div><div class="referral-balance-value"><strong>—</strong><span>dias disponíveis</span></div><button class="app-button app-button--primary" type="button" disabled><span class="app-button-label">Resgatar dias grátis</span></button></section>
    <div class="referral-summary"><article><span>Novos clientes</span><strong>—</strong><small>Aguardando ativação</small></article><article><span>Pagamentos confirmados</span><strong>—</strong><small>Aguardando ativação</small></article><article><span>Dias resgatados</span><strong>—</strong><small>Aguardando ativação</small></article></div>
    `;
  host.querySelector('#referral-link').value = url;
  const giftIcon = document.querySelector('[data-view-link="referrals"] svg');
  for (const button of host.querySelectorAll('.app-button')) {
    if (giftIcon) { const icon = giftIcon.cloneNode(true); icon.setAttribute('class', 'app-button-icon'); icon.setAttribute('aria-hidden', 'true'); button.prepend(icon); }
  }
  const feedback = host.querySelector('#referral-feedback');
  const input = host.querySelector('#referral-link');
  const canvas = host.querySelector('#referral-qr-canvas');
  const download = host.querySelector('#referral-download');
  let revision = 0;
  async function renderQR() {
    const current = ++revision;
    download.disabled = true;
    try {
      const scratch = document.createElement('canvas');
      await QRCode.toCanvas(scratch, url, { width: 768, margin: 4, errorCorrectionLevel: 'H', color: { dark: '#000000', light: '#ffffff' } });
      if (current !== revision || !canvas.isConnected) return;
      canvas.width = scratch.width; canvas.height = scratch.height;
      canvas.getContext('2d').drawImage(scratch, 0, 0);
      download.disabled = false;
    } catch { feedback.textContent = 'Não foi possível gerar o QR Code. Recarregue a página para tentar novamente.'; }
  }
  host.querySelector('#referral-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); feedback.textContent = 'Link copiado. O programa de recompensas ainda está em preparação.'; }
    catch { input.focus(); input.select(); feedback.textContent = 'Selecione e copie o link acima.'; }
  });
  download.addEventListener('click', () => {
    const link = document.createElement('a'); link.download = 'searchforleads-convite.png'; link.href = canvas.toDataURL('image/png'); link.click();
    feedback.textContent = 'QR Code baixado.';
  });
  await renderQR();
}
