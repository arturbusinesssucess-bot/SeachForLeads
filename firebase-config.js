// Configuração pública do app Web do Firebase.
// As credenciais do SDK ficam no frontend por design; proteja os dados com as regras do Firebase.
export const firebaseConfig = {
  apiKey: "AIzaSyDg245NnaFOwjNdMcgV1YcsN-4RIoTPhPs",
  authDomain: "seachforleads.firebaseapp.com",
  projectId: "seachforleads",
  storageBucket: "seachforleads.firebasestorage.app",
  messagingSenderId: "453201297178",
  appId: "1:453201297178:web:8c743cbea83c0bef4236a3",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
