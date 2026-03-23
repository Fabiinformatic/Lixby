export async function transferSessionToApp(auth) {
  const user = auth.currentUser;
  if (!user) return false;

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
    console.warn("No se pudo transferir la sesión a la app:", error);
    return false;
  }
}

function redirectToApp(customToken) {
  // Deep link para Android nativo
  window.location.href = `lixney://auth?token=${encodeURIComponent(customToken)}`;
}
