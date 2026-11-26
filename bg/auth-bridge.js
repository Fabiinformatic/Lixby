export async function transferSessionToApp(user) {
  // Предавайте сесията само при работа в нативното приложение;
  // В уеб версията Firebase запазва сесията сам.
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
    console.warn("Сесията не може да бъде предадена на приложението:", error);
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
