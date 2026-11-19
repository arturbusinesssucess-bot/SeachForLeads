import { doc, getFirestore, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function workspace(uid) {
  return doc(getFirestore(), "sflWorkspaces", uid);
}

export function watchWorkspace(uid, receive, failed) {
  return onSnapshot(workspace(uid), { includeMetadataChanges: true }, (snapshot) => {
    if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
      receive(snapshot.data() ?? {});
    }
  }, failed);
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
