// Cole aqui as credenciais do app Web do seu projeto Firebase.
// Elas ficam no frontend por design; a segurança vem das regras do Firebase.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

