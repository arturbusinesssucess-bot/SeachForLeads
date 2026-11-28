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
    <section class="referral-invite" aria-labelledby="referral-share-title">
      <div class="referral-invite-main">
        <div class="referral-qr">
          <canvas id="referral-qr-canvas" width="768" height="768" role="img" aria-label="QR Code do seu link pessoal"></canvas>
        </div>
        <div class="referral-share">
          <h2 id="referral-share-title"><label for="referral-link">Seu link de indicação</label></h2>
          <input id="referral-link" readonly type="url" spellcheck="false">
          <div class="referral-share-actions">
            <button type="button" class="app-button app-button--primary" id="referral-copy">
              <span class="app-button-label">Copiar link</span>
            </button>
            <a class="app-button referral-whatsapp" id="referral-whatsapp" target="_blank" rel="noopener noreferrer">
              <span class="app-button-label">Compartilhar no WhatsApp</span>
            </a>
            <button class="referral-secondary" id="referral-download" type="button" disabled>Baixar QR Code</button>
          </div>
          <p class="referral-share-help">Envie o convite para quem ainda não tem conta no SearchForLeads.</p>
          <p class="referral-feedback" id="referral-feedback" role="status"></p>
        </div>
      </div>

      <ol class="referral-steps" role="list" aria-label="Como funciona a indicação">
        <li>
          <span aria-hidden="true">1</span>
          <div><h3>Convide alguém novo</h3><p>A pessoa cria uma conta pelo seu link.</p></div>
        </li>
        <li>
          <span aria-hidden="true">2</span>
          <div><h3>14 dias de teste</h3><p>Depois do teste, ela faz o primeiro pagamento.</p></div>
        </li>
        <li>
          <span aria-hidden="true">3</span>
          <div><h3>Ganhe 30 dias</h3><p>Com o pagamento confirmado, você pode resgatar o bônus.</p></div>
        </li>
      </ol>
    </section>
    <section class="referral-balance referral-card" aria-labelledby="referral-balance-title"><div><span class="referral-eyebrow">Suas recompensas</span><h2 id="referral-balance-title">Dias extras para ir mais longe</h2><p>Quando o programa estiver ativo, suas indicações e bônus aparecerão aqui.</p></div><div class="referral-balance-value"><strong>—</strong><span>dias disponíveis</span></div><button class="app-button app-button--primary" type="button" disabled><span class="app-button-label">Resgatar dias grátis</span></button></section>
    <div class="referral-summary"><article><span>Novos clientes</span><strong>—</strong><small>Aguardando ativação</small></article><article><span>Pagamentos confirmados</span><strong>—</strong><small>Aguardando ativação</small></article><article><span>Dias resgatados</span><strong>—</strong><small>Aguardando ativação</small></article></div>
    `;
  const giftIcon = document.querySelector('[data-view-link="referrals"] svg');
  for (const button of host.querySelectorAll('.app-button--primary')) {
    if (giftIcon) {
      const icon = giftIcon.cloneNode(true);
      icon.setAttribute('class', 'app-button-icon');
      icon.setAttribute('aria-hidden', 'true');
      button.prepend(icon);
    }
  }

  const input = host.querySelector('#referral-link');
  const feedback = host.querySelector('#referral-feedback');
  const canvas = host.querySelector('#referral-qr-canvas');
  const download = host.querySelector('#referral-download');
  const whatsapp = host.querySelector('#referral-whatsapp');
  const whatsappIcon = document.querySelector('#trial-result-template')?.content.querySelector('[data-result-whatsapp] svg');
  if (whatsappIcon) whatsapp.prepend(whatsappIcon.cloneNode(true));

  input.value = url;
  whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`Conheça o SearchForLeads pelo meu link de indicação: ${url}`)}`;

  host.querySelector('#referral-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      feedback.textContent = 'Link copiado.';
    } catch {
      input.focus();
      input.select();
      feedback.textContent = 'Copie o link selecionado.';
    }
  });

  download.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'searchforleads-convite.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    feedback.textContent = 'Download iniciado.';
  });

  try {
    await QRCode.toCanvas(canvas, url, {
      width: 768,
      margin: 4,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#ffffff' },
    });
    // Keep the PNG resolution independent from the size of the preview.
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    download.disabled = false;
  } catch {
    canvas.hidden = true;
    feedback.textContent = 'Não foi possível gerar o QR Code. Recarregue a página para tentar novamente.';
  }
}
