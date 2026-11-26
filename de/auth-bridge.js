export async function transferSessionToApp(user) {
  // Die Sitzung nur übertragen, wenn die App nativ ausgeführt wird;
  // Im Web bleibt die Firebase-Sitzung bestehen.
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
    console.warn("Die Sitzung konnte nicht an die App übertragen werden:", error);
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
