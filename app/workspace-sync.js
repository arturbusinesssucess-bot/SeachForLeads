import { doc, getFirestore, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function workspace(uid) {
  return doc(getFirestore(), "sflWorkspaces", uid);
}

export function watchWorkspace(uid, receive, failed) {
  let unsubscribe;
  let generation = 0;
  let stopped = false;
  const connect = () => {
    if (stopped) return;
    const current = ++generation;
    unsubscribe?.();
    unsubscribe = onSnapshot(workspace(uid), { includeMetadataChanges: true }, (snapshot) => {
      if (current !== generation || stopped) return;
      if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
        receive(snapshot.data() ?? {});
      }
    }, (error) => {
      if (current === generation && !stopped) failed?.(error);
    });
  };
  const resume = () => { if (!document.hidden) connect(); };
  const restore = (event) => { if (event.persisted) resume(); };
  connect();
  window.addEventListener("online", resume);
  window.addEventListener("pageshow", restore);
  document.addEventListener("visibilitychange", resume);
  return () => {
    stopped = true;
    generation++;
    unsubscribe?.();
    window.removeEventListener("online", resume);
    window.removeEventListener("pageshow", restore);
    document.removeEventListener("visibilitychange", resume);
  };
}

export function updateWorkspace(uid, change) {
  const reference = workspace(uid);
  return runTransaction(reference.firestore, async (transaction) => {
    const current = (await transaction.get(reference)).data() ?? {};
    const patch = change(current);
    if (patch) transaction.set(reference, patch, { merge: true });
    return patch ? { ...current, ...patch } : current;
  });
}
