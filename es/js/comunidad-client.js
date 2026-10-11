// comunidad-client.js
// Sesión y perfil de la Comunidad Lixby (solo cliente).
// El SSR sirve HTML público y cacheado; el estado de sesión se pinta aquí, en
// el hueco <div id="lx-session"> del layout. La caché nunca ve datos de usuario.
// - DOM seguro: textContent, nunca innerHTML.
// - El cliente jamás envía el uid: communitySaveProfile lo saca del token.
// - avatarUrl: el callable lo acepta, pero aquí NO se pinta (una URL externa
//   permitiría rastrear a quien ve el hilo; img-src ya lo bloquearía).

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

// Config pública (igual que es/cuenta/index.html).
const firebaseConfig = {
  apiKey: "AIzaSyCPU-jsIupu3lsRrknmlv04A3YnBwXeePU",
  authDomain: "lixby0.firebaseapp.com",
  projectId: "lixby0",
  storageBucket: "lixby0.firebasestorage.app",
  messagingSenderId: "1058088945026",
  appId: "1:1058088945026:web:c56eaa9c71f1ca625fbb9b",
  measurementId: "G-689VDV93C2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, "europe-west1"); // los callables de comunidad
const saveProfile = httpsCallable(functions, "communitySaveProfile");

const root = document.getElementById("lx-session");

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...children);
  return n;
}

function loginUrl() {
  const next = location.pathname + location.search;
  return `/es/iniciar-sesion/?next=${encodeURIComponent(next)}`;
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "profiles", uid));
  return snap.exists() ? snap.data() : null;
}

function renderSignedOut() {
  root.replaceChildren(el("a", { href: loginUrl(), textContent: "Iniciar sesión" }));
}

function renderProfileForm(user) {
  const input = el("input", {
    type: "text", id: "lx-name", maxLength: 40, minLength: 2,
    required: true, placeholder: "Nombre de usuario", autocomplete: "nickname",
  });
  const btn = el("button", { type: "button", textContent: "Guardar" });
  const status = el("p", { role: "alert" });

  btn.addEventListener("click", async () => {
    const displayName = input.value.trim();
    if (displayName.length < 2) {
      status.textContent = "El nombre es demasiado corto.";
      return;
    }
    btn.disabled = true;
    status.textContent = "";
    try {
      await saveProfile({ displayName });
      const profile = await loadProfile(user.uid);
      renderSignedIn(user, profile);
    } catch (e) {
      status.textContent = e?.message || "No se pudo guardar el perfil.";
      btn.disabled = false;
    }
  });

  root.replaceChildren(
    el("label", { htmlFor: "lx-name", textContent: "Elige tu nombre en la comunidad " }),
    input, btn, status
  );
}

function renderSignedIn(user, profile) {
  if (!profile?.displayName) return renderProfileForm(user);

  const out = el("button", { type: "button", textContent: "Cerrar sesión" });
  out.addEventListener("click", () => signOut(auth));
  root.replaceChildren(el("span", { textContent: profile.displayName }), " · ", out);

  document.dispatchEvent(
    new CustomEvent("lx:session", { detail: { uid: user.uid, displayName: profile.displayName } })
  );
}

if (root) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return renderSignedOut();
    try {
      renderSignedIn(user, await loadProfile(user.uid));
    } catch (e) {
      console.error("perfil", e);
      renderSignedOut();
    }
  });
}