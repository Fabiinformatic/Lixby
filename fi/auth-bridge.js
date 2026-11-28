export async function transferSessionToApp(user) {
  // Siirrä istunto vain natiivisovelluksen sisällä suoritettaessa;
  // en la web la sesion de Firebase persiste por si sola.
  if (!user || !isNativeApp()) return false;

  try {
    const idToken = await user.getIdToken();

    const res = await fetch("/auth/custom-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    if (!data || !data.customToken) return false;

    redirectToApp(data.customToken);
    return true;
  } catch (error) {
    console.warn("Istunnon siirto sovellukseen epäonnistui:", error);
    return false;
  }
}

function isNativeApp() {
  return navigator.userAgent.includes("LixneyApp");
}

function redirectToApp(customToken) {
  // Deep link para Android nativo
  window.location.href = `lixney://auth?token=${encodeURIComponent(customToken)}`;
}
