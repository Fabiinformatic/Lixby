// community-i18n.js
// Traducciones y layout (nav/pie) de la Comunidad Lixby por idioma.
// - Los textos viven en ./i18n/<idioma>.json (una clave por cadena). Si falta
//   una clave o un idioma, se cae a inglés y luego a español (t() hace el
//   fallback clave a clave).
// - El nav y el pie NO se traducen aquí: se extraen de cada <idioma>/index.html
//   con scripts/generate-community-layouts.js a ./community-layouts.json.
const fs = require("fs");
const path = require("path");

// Layout (nav + pie) extraído de cada <idioma>/index.html por
// scripts/generate-community-layouts.js. Si el artefacto no existe (repo nuevo
// o build incompleto) no se tira el arranque de la función: se renderiza sin
// chrome y la página sigue siendo usable.
let LAYOUTS = {};
try {
  LAYOUTS = require("./community-layouts.json");
} catch (err) {
  console.error("community-layouts.json no disponible", err.message);
}

// Idiomas del sitio (mismo orden que el menú de idiomas del propio sitio).
const LANGS = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
];

const DICT_DIR = path.join(__dirname, "i18n");
const DICTS = {};
if (fs.existsSync(DICT_DIR)) {
  for (const file of fs.readdirSync(DICT_DIR)) {
    if (!file.endsWith(".json")) continue;
    const lang = file.slice(0, -".json".length);
    try {
      DICTS[lang] = JSON.parse(fs.readFileSync(path.join(DICT_DIR, file), "utf8"));
    } catch (err) {
      console.error(`i18n: ${file} no se pudo leer`, err);
    }
  }
}

// Rutas del sitio que cambian de nombre según el idioma (login, verificado,
// cuenta, cesta, ayuda). El resto de idiomas usan el slug inglés.
const PATHS = {
  es: {
    login: "iniciar-sesion",
    verified: "verificado",
    account: "cuenta",
    cart: "cesta",
    help: "centro-ayuda",
    contact: "centro-ayuda/contacto",
  },
};
const DEFAULT_PATHS = {
  login: "login",
  verified: "verified",
  account: "account",
  cart: "cart",
  help: "help-center",
  contact: "support",
};

function sitePath(lang, key) {
  const map = PATHS[lang] || DEFAULT_PATHS;
  return map[key] ?? DEFAULT_PATHS[key];
}

function dict(lang) {
  return DICTS[lang] || DICTS.en || DICTS.es || {};
}

// t(lang, clave, vars): busca la cadena y sustituye {placeholders}.
function t(lang, key, vars) {
  const d = dict(lang);
  let s = d[key];
  if (s == null) {
    const en = DICTS.en || {};
    const es = DICTS.es || {};
    s = en[key] != null ? en[key] : es[key] != null ? es[key] : key;
  }
  if (vars) {
    s = String(s).replace(/\{(\w+)\}/g, (m, k) =>
      vars[k] != null ? String(vars[k]) : m
    );
  }
  return String(s);
}

function layoutFor(lang) {
  return LAYOUTS[lang] || LAYOUTS.en || LAYOUTS.es || { nav: "", footer: "" };
}

// Etiquetas de las etiquetas (tags) del compositor: coinciden con las del
// cliente (pregunta/idea/bug/showcase) y las traduce la clave tag_<slug>.
const TAGS = ["pregunta", "idea", "bug", "showcase"];
const tagLabel = (lang, tag) => t(lang, `tag_${tag}`);

module.exports = {
  LANGS,
  DICTS,
  t,
  dict,
  layoutFor,
  sitePath,
  TAGS,
  tagLabel,
};
