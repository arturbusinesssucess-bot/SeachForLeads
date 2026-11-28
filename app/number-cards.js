const numberSelector = [
  '.stat-card > strong',
  '.metric-card > strong',
  '.account-usage-amount > .account-usage-value',
  '.referral-balance-value > strong',
  '.referral-summary article > strong',
  '.ai-result-score > strong',
  '#analytics-contact-rate',
].join(', ');

export function initializeNumberCards() {
  const rendered = new WeakMap();

  function renderNumber(element) {
    const text = element.textContent.trim();
    const previous = rendered.get(element);
    if (previous?.text === text && element.contains(previous.visual)) return;
    if (!/^\d[\d.,\s]*%?$/.test(text)) return;

    const readable = document.createElement('span');
    readable.className = 'card-odometer-text';
    readable.textContent = text;
    const visual = document.createElement('span');
    visual.className = 'card-odometer-reels';
    visual.setAttribute('aria-hidden', 'true');
    let digitIndex = 0;

    for (const character of text) {
      const slot = document.createElement('span');
      if (/\d/.test(character)) {
        slot.className = 'card-odometer-digit';
        const tape = document.createElement('span');
        tape.className = 'card-odometer-tape';
        tape.style.setProperty('--odometer-position', `${-Number(character) * 1.08}em`);
        tape.style.setProperty('--odometer-delay', `${80 + Math.min(digitIndex, 4) * 90}ms`);
        slot.append(tape);
        digitIndex++;
      } else {
        slot.className = 'card-odometer-symbol';
        slot.dataset.symbol = character;
      }
      visual.append(slot);
    }

    rendered.set(element, { text, visual });
    element.classList.add('card-odometer');
    element.replaceChildren(readable, visual);
  }

  function collectNumbers(root, candidates) {
    if (!(root instanceof Element)) return;
    if (root.matches(numberSelector)) candidates.add(root);
    for (const number of root.querySelectorAll(numberSelector)) candidates.add(number);
  }

  const observer = new MutationObserver((mutations) => {
    const candidates = new Set();
    for (const mutation of mutations) {
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      const number = target?.closest(numberSelector);
      if (number) candidates.add(number);
      for (const added of mutation.addedNodes) collectNumbers(added, candidates);
    }
    for (const number of candidates) renderNumber(number);
  });

  for (const element of document.querySelectorAll(numberSelector)) renderNumber(element);
  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}
