export async function transferSessionToApp(user) {
  // Trasferire la sessione solo quando viene eseguito all'interno dell'app nativa;
  // sul web la sessione Firebase persiste da sola.
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
    console.warn("Impossibile trasferire la sessione all'app:", error);
    return false;
  }
}

function isNativeApp() {
  return navigator.userAgent.includes("LixneyApp");
}

function redirectToApp(customToken) {
  // Deep link para Android nativo
  window.location.href = `Lixney://auth?token=${encodeURIComponent(customToken)}`;
}
