export async function transferSessionToApp(user) {
  // Alleen de sessie overdragen wanneer deze binnen de native app wordt uitgevoerd;
  // op het web blijft de Firebase-sessie vanzelf bestaan.
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
    console.warn("De sessie kon niet naar de app worden overgedragen:", error);
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
