const overlay = document.querySelector('#app-loading');
const error = document.querySelector('#app-loading-error');
const errorMessage = error.querySelector('p');
const shell = [...document.querySelectorAll('.sidebar-mobile-bar, .app-frame, #mobile-tab-bar')];
const tasks = new Map();
let activeView = location.hash.slice(1) || 'home';
let starting = true;
let shownAt = performance.now();
let previousFocus;
let showTimer;
let hideTimer;
let warningTimer;

function isBusy() {
  return starting || [...tasks.values()].some((views) => views.has(activeView));
}

function setVisible(visible) {
  if (visible && overlay.hidden) {
    previousFocus = document.activeElement;
    shownAt = performance.now();
    overlay.hidden = false;
    overlay.focus({ preventScroll: true });
  }
  for (const element of shell) element.inert = visible;
  document.querySelector('.app-frame').setAttribute('aria-busy', String(visible));
  document.body.dataset.loading = String(visible);
  if (visible) {
    warningTimer ??= window.setTimeout(() => {
      errorMessage.textContent = 'O carregamento está demorando. Tente recarregar o app.';
      error.hidden = false;
    }, 25000);
  } else {
    overlay.hidden = true;
    window.clearTimeout(warningTimer);
    warningTimer = undefined;
    error.hidden = true;
    if (previousFocus?.isConnected && !previousFocus.closest('[hidden], [inert]')) {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = undefined;
  }
}

function sync() {
  if (isBusy()) {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
    if (!overlay.hidden || showTimer) return;
    showTimer = window.setTimeout(() => {
      showTimer = undefined;
      if (isBusy()) setVisible(true);
    }, 400);
  } else {
    window.clearTimeout(showTimer);
    showTimer = undefined;
    if (overlay.hidden || hideTimer) return;
    hideTimer = window.setTimeout(() => {
      hideTimer = undefined;
      if (!isBusy()) setVisible(false);
    }, Math.max(0, 600 - (performance.now() - shownAt)));
  }
}

export const appLoading = {
  begin(views) {
    const token = Symbol();
    tasks.set(token, new Set(Array.isArray(views) ? views : [views]));
    sync();
    return () => {
      tasks.delete(token);
      sync();
    };
  },
  setView(view) {
    activeView = view;
    sync();
  },
  finishStartup() {
    starting = false;
    sync();
  },
  failStartup() {
    if (!starting) return;
    errorMessage.textContent = 'Não foi possível abrir o app. Recarregue para tentar novamente.';
    error.hidden = false;
    setVisible(true);
  },
  restartStartup() {
    starting = true;
    setVisible(true);
    sync();
  },
};

setVisible(true);
document.querySelector('#app-loading-retry').addEventListener('click', () => location.reload());
window.addEventListener('error', (event) => {
  if (event.error || event.target instanceof HTMLScriptElement) appLoading.failStartup();
}, true);
window.addEventListener('unhandledrejection', () => appLoading.failStartup());
