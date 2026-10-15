// Semilla idempotente de los espacios (subforos) de la Comunidad Lixby.
//
// Uso:
//   node scripts/seed-community-spaces.js
//
// Credenciales: usa la variable FIREBASE_SERVICE_ACCOUNT o, si no existe,
// el fichero firebase-service-account.json de la raíz (igual que server.js).
//
// Es seguro re-ejecutarlo: crea los que falten y actualiza sólo los campos
// de presentación (name/slug/description/icon/image/order), preservando los
// contadores (postCount) y la fecha de creación.

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const rootDir = path.resolve(__dirname, "..");

let serviceAccount;
try {
  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    fs.readFileSync(path.join(rootDir, "firebase-service-account.json"), "utf8");
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (error) {
  console.error("No se pudieron cargar las credenciales:", error.message);
  process.exit(1);
}

if (!admin.apps || admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// El id del documento es el slug => estable y re-ejecutable.
const SPACES = [
  {
    slug: "general",
    name: "General",
    icon: "💬",
    image: "/es/images/Chat.png",
    order: 1,
    description: "Conversación general sobre Lixby y sus productos.",
  },
  {
    slug: "lixbuds",
    name: "LixBuds",
    icon: "🎧",
    image: "/es/images/lixbuds-one-white.png",
    order: 2,
    description: "Auriculares LixBuds: dudas, trucos y experiencias.",
  },
  {
    slug: "lixney",
    name: "Lixney",
    icon: "📱",
    image: "/es/images/lixneyicon2.webp",
    order: 3,
    description: "App Lixney para Android: uso, datos locales y preguntas.",
  },
  {
    slug: "lixfly",
    name: "Lixfly",
    icon: "✈️",
    image: "/es/images/lixflyicon2.webp",
    order: 4,
    description: "Lixfly: planificación y acompañamiento de vuelo.",
  },
  {
    slug: "ideas",
    name: "Ideas y sugerencias",
    icon: "💡",
    image: "/es/images/Bombilla.png",
    order: 5,
    description: "Propón mejoras y vota las ideas de la comunidad.",
  },
  {
    slug: "soporte",
    name: "Soporte entre usuarios",
    icon: "🤝",
    image: "/es/images/Mano.png",
    order: 6,
    description: "Ayuda mutua entre usuarios de Lixby.",
  },
];

async function seed() {
  for (const space of SPACES) {
    const ref = db.collection("spaces").doc(space.slug);
    const snap = await ref.get();

    const presentation = {
      slug: space.slug,
      name: space.name,
      description: space.description,
      icon: space.icon,
      order: space.order,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Cada espacio lleva `image` (el SSR la usa en vez del emoji).
    if (space.image) presentation.image = space.image;

    if (snap.exists) {
      await ref.set(presentation, { merge: true });
      console.log(`Actualizado: ${space.slug}`);
    } else {
      await ref.set({
        ...presentation,
        postCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`Creado: ${space.slug}`);
    }
  }

  console.log(`Listo. Espacios sincronizados: ${SPACES.length}.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error en la semilla:", error);
    process.exit(1);
  });
