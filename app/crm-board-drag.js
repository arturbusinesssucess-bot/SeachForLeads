const dragDistance = 7;
const touchHoldMs = 280;
const scrollEdge = 54;

export function initializeBoardDrag(board, onDrop) {
  let gesture;
  let frameId = 0;
  let suppressClick = false;

  function findCard(target) {
    const card = target.closest(".crm-lead-card[data-crm-lead-id]");
    return card && board.contains(card) && !card.disabled && !card.hasAttribute("aria-busy") ? card : null;
  }

  function revealColumns(show) {
    for (const column of board.querySelectorAll("[data-crm-filtered-column]")) column.hidden = !show;
  }

  function dropTarget(x, y) {
    const column = document.elementFromPoint(x, y)?.closest("[data-crm-drop-stage]");
    return column && board.contains(column) && column !== gesture.card.closest("[data-crm-column]") ? column : null;
  }

  function cancel() {
    if (!gesture) return;
    clearTimeout(gesture.timer);
    cancelAnimationFrame(frameId);
    if (gesture.preview) {
      gesture.target?.removeAttribute("data-crm-drop-active");
      gesture.card.removeAttribute("data-crm-dragging");
      gesture.preview.remove();
      board.removeAttribute("data-crm-dragging");
      revealColumns(false);
      suppressClick = true;
    }
    gesture = undefined;
  }

  function draw() {
    const active = gesture;
    if (!active?.preview) return;
    if (!active.card.isConnected || !board.getClientRects().length) {
      cancel();
      return;
    }

    const { x, y, offsetX, offsetY, preview } = active;
    preview.style.transform = `translate3d(${x - offsetX}px, ${y - offsetY}px, 0)`;

    const bounds = board.getBoundingClientRect();
    const left = Math.max(0, bounds.left);
    const right = Math.min(window.innerWidth, bounds.right);
    if (y >= bounds.top && y <= bounds.bottom && x >= left && x <= right) {
      const back = Math.max(0, scrollEdge - (x - left));
      const forward = Math.max(0, scrollEdge - (right - x));
      if (back || forward) board.scrollLeft += (forward - back) * .3;
    }

    const column = dropTarget(x, y);
    if (active.target !== column) {
      active.target?.removeAttribute("data-crm-drop-active");
      column?.setAttribute("data-crm-drop-active", "");
      active.target = column;
    }
    frameId = requestAnimationFrame(draw);
  }

  function begin() {
    const active = gesture;
    if (!active || !active.card.isConnected || !active.card.getClientRects().length) {
      cancel();
      return;
    }

    const bounds = active.card.getBoundingClientRect();
    active.offsetX = active.startX - bounds.left;
    active.offsetY = active.startY - bounds.top;
    const preview = active.card.cloneNode(true);
    preview.classList.add("crm-drag-preview");
    preview.removeAttribute("data-crm-lead-id");
    preview.setAttribute("aria-hidden", "true");
    preview.tabIndex = -1;
    preview.style.width = `${bounds.width}px`;
    preview.style.height = `${bounds.height}px`;
    active.preview = preview;
    active.card.setAttribute("data-crm-dragging", "");
    board.setAttribute("data-crm-dragging", "");
    document.body.append(preview);
    revealColumns(true);
    draw();
  }

  function arm(card, kind, id, x, y) {
    gesture = { card, kind, id, startX: x, startY: y, x, y };
    if (kind === "touch") gesture.timer = window.setTimeout(begin, touchHoldMs);
  }

  function track(x, y) {
    if (!gesture) return;
    gesture.x = x;
    gesture.y = y;
    if (gesture.preview || Math.hypot(x - gesture.startX, y - gesture.startY) < dragDistance) return;
    if (gesture.kind === "touch") cancel();
    else begin();
  }

  function finish(x, y) {
    const active = gesture;
    const column = active?.preview ? dropTarget(x, y) : null;
    cancel();
    if (column) onDrop(active.card, column);
  }

  board.addEventListener("pointerdown", (event) => {
    suppressClick = false;
    if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0 || gesture) return;
    const card = findCard(event.target);
    if (card) arm(card, "pointer", event.pointerId, event.clientX, event.clientY);
  });
  window.addEventListener("pointermove", (event) => {
    if (gesture?.kind === "pointer" && gesture.id === event.pointerId) track(event.clientX, event.clientY);
  });
  window.addEventListener("pointerup", (event) => {
    if (gesture?.kind === "pointer" && gesture.id === event.pointerId) finish(event.clientX, event.clientY);
  });
  window.addEventListener("pointercancel", (event) => {
    if (gesture?.kind === "pointer" && gesture.id === event.pointerId) cancel();
  });

  board.addEventListener("touchstart", (event) => {
    suppressClick = false;
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const card = findCard(event.target);
    const touch = event.changedTouches[0];
    if (card && touch && !gesture) arm(card, "touch", touch.identifier, touch.clientX, touch.clientY);
  }, { passive: true });
  board.addEventListener("touchmove", (event) => {
    if (gesture?.kind !== "touch") return;
    if (event.touches.length !== 1) {
      cancel();
      return;
    }
    const touch = event.touches[0];
    if (touch.identifier !== gesture.id) return;
    if (gesture.preview) {
      if (!event.cancelable) {
        cancel();
        return;
      }
      event.preventDefault();
    }
    track(touch.clientX, touch.clientY);
  }, { passive: false });
  board.addEventListener("touchend", (event) => {
    if (gesture?.kind !== "touch") return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === gesture.id);
    if (!touch) return;
    if (gesture.preview && event.cancelable) event.preventDefault();
    finish(touch.clientX, touch.clientY);
  }, { passive: false });
  board.addEventListener("touchcancel", () => { if (gesture?.kind === "touch") cancel(); });

  board.addEventListener("contextmenu", (event) => {
    if (gesture?.kind === "touch") event.preventDefault();
  });
  board.addEventListener("click", (event) => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener("blur", cancel);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") cancel();
  });

  return { cancel };
}
