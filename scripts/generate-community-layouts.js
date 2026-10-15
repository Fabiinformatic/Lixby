// Extrae el <header> y el <footer> de cada <idioma>/index.html y los guarda en
// functions/community-layouts.json para que el SSR de la comunidad los use en
// todos los idiomas (así el nav y el pie salen ya traducidos, sin duplicarlos).
//
// El nav de las páginas de inicio usa rutas relativas (images/…, ./) y anclas
// de la portada (#apps). Aquí se convierten a rutas absolutas del idioma
// (/{lang}/…) para que funcionen desde /{lang}/comunidad/…; las anclas pasan a
// /{lang}/#ancla (llevan a la sección correspondiente de la portada).
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "functions", "community-layouts.json");

// Idiomas del sitio con página de inicio propia.
const LANGS = [
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "ga", "hr",
  "hu", "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "sk", "sl", "sv",
];

const NAV_RE = /<header class="nav"[^>]*>[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="footer[^"]*"[^>]*>[\s\S]*?<\/footer>/;

// Convierte una URL relativa (o ancla) en absoluta para el idioma dado.
function absolutize(lang, attr, val) {
  if (val === "" || val === "./" || val === ".") return `/${lang}/`;
  if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(val)) return val;
  if (val.startsWith("//")) return val; // protocolo-relativa: dejar como está
  if (val.startsWith("#")) return `/${lang}/${val}`; // ancla de la portada
  if (val.startsWith("/")) return val; // ya es absoluta
  return `/${lang}/${val.replace(/^\.?\//, "")}`; // images/…, ../…, pagina.html
}

function rewriteUrls(html, lang) {
  return html.replace(
    /\b(src|href)=(")([^"]*)(")/g,
    (_m, attr, _q1, val, _q2) => `${attr}="${absolutize(lang, attr, val)}"`
  );
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[0] : "";
}

function main() {
  const layouts = {};
  const missing = [];

  for (const lang of LANGS) {
    const file = path.join(rootDir, lang, "index.html");
    if (!fs.existsSync(file)) {
      missing.push(lang);
      continue;
    }
    const html = fs.readFileSync(file, "utf8");
    const nav = extract(html, NAV_RE);
    const footer = extract(html, FOOTER_RE);
    if (!nav || !footer) {
      missing.push(lang);
      continue;
    }
    layouts[lang] = {
      nav: rewriteUrls(nav, lang),
      footer: rewriteUrls(footer, lang),
    };
  }

  fs.writeFileSync(outputPath, JSON.stringify(layouts, null, 0) + "\n", "utf8");
  const ok = Object.keys(layouts).length;
  console.log(`community-layouts.json: ${ok}/${LANGS.length} idiomas`);
  if (missing.length) console.log(`Sin nav/footer: ${missing.join(", ")}`);
}

main();
