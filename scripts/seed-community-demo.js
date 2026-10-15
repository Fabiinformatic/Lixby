// seed-community-demo.js
// Datos de EJEMPLO para previsualizar la Comunidad en local.
//
// Uso (con los emuladores corriendo):
//   node scripts/seed-community-demo.js
//
// SEGURIDAD: este script SOLO escribe en el emulador de Firestore. Fuerza
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 antes de inicializar el Admin SDK y
// comprueba que el emulador responde antes de escribir nada. No puede tocar la
// base de producción bajo ninguna circunstancia.
//
// Para los datos reales de producción, usa scripts/seed-community-spaces.js
// con credenciales (el de producción) — nunca este.
const admin = require("firebase-admin");

// 1) Siempre al emulador. Se fija ANTES de initializeApp, que es cuando el
//    Admin SDK decide hacia dónde apuntar.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const PROJECT = process.env.GCLOUD_PROJECT || "lixby0";

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const ts = admin.firestore.Timestamp;

const SPACES = [
  ["general", "General", "💬", "/es/images/Chat.png", 1,
    "Conversación general sobre Lixby y sus productos."],
  ["lixbuds", "LixBuds", "🎧", "/es/images/lixbuds-one-white.png", 2,
    "Auriculares LixBuds: dudas, trucos y experiencias."],
  ["lixney", "Lixney", "📱", "/es/images/lixneyicon2.webp", 3,
    "App Lixney para Android: uso, datos locales y preguntas."],
  ["lixfly", "Lixfly", "✈️", "/es/images/lixflyicon2.webp", 4,
    "Lixfly: planificación y acompañamiento de vuelo."],
  ["ideas", "Ideas y sugerencias", "💡", "/es/images/Bombilla.png", 5,
    "Propón mejoras y vota las ideas de la comunidad."],
  ["soporte", "Soporte entre usuarios", "🤝", "/es/images/Mano.png", 6,
    "Ayuda mutua entre usuarios de Lixby."],
];

// Hilos de ejemplo. Id determinista => re-ejecutable sin duplicar.
// IDs [A-Za-z0-9]{1,40} (el SSR los valida con ese patrón).
const POSTS = [
  ["demoWelcome01", "general", "Bienvenidos a la comunidad Lixby",
    "Este es el primer hilo de la comunidad. Aquí puedes preguntar, compartir ideas y ayudar a otros usuarios.\n\nLas normas están en el enlace de la portada; el filtro automático evita insultos y amenazas.",
    ["idea"], "Equipo Lixby", 42, 7, 214,
    6],
  ["demoBluetooth01", "lixbuds", "Los LixBuds se desconectan con el portátil",
    "Desde la última actualización del sistema me desconectan cada diez minutos en Windows, pero en el móvil van perfectos.\n\n¿A alguien más le pasa? He probado a olvidarlos y volver a emparejarlos.",
    ["pregunta"], "Marta", 17, 3, 96,
    5],
  ["demoEqualizer01", "lixbuds", "Preset de ecualizador para podcasts",
    "Comparto mi ecualizador para podcast: agudos +3, medios +2, bajos -1.\n\nSe oye mucho más claro el diálogo y no fatiga en trayectos largos.",
    ["showcase"], "Íñigo", 31, 4, 143,
    4],
  ["demoOffline01", "lixney", "¿Lixney guarda los datos sin conexión?",
    "Voy a viajar sin cobertura y necesito saber si las mediciones se guardan localmente para sincronizar después.\n\nNo encuentro la respuesta en la ayuda.",
    ["pregunta"], "Nuria", 9, 2, 61,
    3],
  ["demoFlight01", "lixfly", "Sugerencia: resumen del vuelo en PDF",
    "Estaría genial poder exportar el plan de vuelo y las notas en PDF para llevarlas en papel.\n\nAhora tengo que capturar pantallas.",
    ["idea"], "Álvaro", 25, 5, 118,
    3],
  ["demoBattery02", "ideas", "Batería removible en los futuros auriculares",
    "Las baterías se degradan en dos o tres años. Si fueran reemplazables, el producto duraría mucho más.\n\n¿Es técnicamente viable con el tamaño actual?",
    ["idea"], "Clara", 58, 12, 307,
    2],
  ["demoCrash01", "soporte", "La app se cierra al abrir el historial",
    "Paso para reproducirlo:\n\n1. Abrir Lixney\n2. Ir a Historial\n3. Deslizar hacia abajo rápidamente\n\nSe cierra sin aviso en Android 14.",
    ["bug"], "Rubén", 14, 6, 88,
    2],
  ["demoFirstUse01", "general", "Mi primer día con Lixfly",
    "Vengo de planificar rutas a mano y me ha sorprendido lo fácil que es.\n\nDejo por aquí mis primeras impresiones por si le sirve a alguien.",
    ["showcase"], "Leire", 36, 8, 175,
    1],
];

async function main() {
  // 2) Comprobación de que el emulador responde ANTES de escribir.
  try {
    await db.collection("spaces").limit(1).get();
  } catch (error) {
    console.error("El emulador de Firestore no responde en 127.0.0.1:8080.");
    console.error("Arráncalo con: firebase emulators:start --only functions,firestore,auth,hosting");
    console.error("Detalle:", error.message);
    process.exit(1);
  }
  console.log(`Conectado al EMULADOR (proyecto ${PROJECT}). No se escribe en producción.\n`);

  for (const [slug, name, icon, image, order, description] of SPACES) {
    const ref = db.collection("spaces").doc(slug);
    const snap = await ref.get();
    const presentation = {
      slug, name, description, icon, image, order,
      updatedAt: ts.now(),
    };
    if (snap.exists) {
      await ref.set(presentation, { merge: true });
      console.log(`  espacio actualizado: ${slug}`);
    } else {
      await ref.set({
        ...presentation, postCount: 0, createdAt: ts.now(),
      });
      console.log(`  espacio creado:     ${slug}`);
    }
  }

  console.log("");
  const stats = db.collection("postStats");
  for (const [id, spaceId, title, body, tags, authorName, score, commentCount, views, daysAgo] of POSTS) {
    const when = ts.fromMillis(Date.now() - daysAgo * 86400000);
    await db.collection("posts").doc(id).set({
      spaceId,
      status: "published",
      title,
      body,
      tags,
      authorName,
      authorId: "demo",
      score,
      commentCount,
      createdAt: when,
      lastActivityAt: ts.fromMillis(when.toMillis() + 3600000),
      updatedAt: when,
    }, { merge: true });
    await stats.doc(id).set({
      views,
      comments: {},
    }, { merge: true });
    console.log(`  hilo demo:          ${id} (${spaceId})`);
  }

  const snap = await db.collection("spaces").count().get();
  const posts = await db.collection("posts").count().get();
  console.log(`\nListo. Espacios: ${snap.data().count} · Hilos: ${posts.data().count}.`);
  console.log("Mira: http://127.0.0.1:5000/es/comunidad/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error en la semilla demo:", error);
    process.exit(1);
  });
