"use strict";

// Filtro de moderación de la comunidad Lixby.
// Sin dependencias: se ejecuta en las Cloud Functions antes de escribir nada.
// NUNCA guardar el texto bloqueado; si se quiere medir, contar por categoría.
//
// Qué hace:
//   - Quita acentos y pasa a minúsculas (la ñ -> "ny": coño -> conyo).
//   - Detecta letras sustituidas por símbolos: m13rd4, put@, p3t4.
//   - Colapsa letras repetidas: puuuuta.
//   - Une letras separadas: p u t a, p.u.t.a.
//   - Compara por palabra completa (evita "computadora" o "Scunthorpe").
//   - Frases de amenaza e incitación al suicidio.
//   - Nombres reservados para evitar suplantaciones en el perfil.

const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };
const collapse = (s) => s.replace(/(.)\1+/g, "$1");

// Insultos y términos discriminatorios: siempre se bloquean.
// Sin acentos, en minúsculas. La ñ se escribe "ny" (coño -> conyo).
// AÑADE AQUÍ los términos que quieras bloquear.
const STRONG_WORDS = [
  "puta", "puto", "putas", "putos", "putada", "putadas", "hijoputa", "hijoputas",
  "cabron", "cabrona", "cabrones", "gilipollas", "gilipuertas", "soplapollas",
  "capullo", "capulla", "imbecil", "imbeciles", "idiota", "idiotas",
  "subnormal", "subnormales", "retrasado", "retrasada", "mamon", "mamona",
  "zorra", "zorras", "polla", "pollas", "maricon", "maricona", "estupido", "estupida",
];

// Lenguaje soez: se bloquea solo si blockMild es true.
const MILD_WORDS = [
  "mierda", "mierdas", "joder", "jodete", "jodido", "conyo", "conyazo",
  "hostia", "hostias", "carajo", "cojones",
];

// Amenazas y autolesión (sobre texto ya normalizado).
const PHRASES = [
  ["amenaza", /\b(te voy a|voy a|vamos a) (matar|reventar|violar|destrozar|punyalar)\b/],
  ["amenaza", /\bojala (te )?(mueras|mueres|mates)\b/],
  ["autolesion", /\b(matate|suicidate|muerete)\b/],
];

const RESERVED_NAMES = ["admin", "administrador", "moderador", "soporte", "lixby", "staff", "owner", "ceo"];

const STRONG = new Set(STRONG_WORDS.map(collapse));
const MILD = new Set(MILD_WORDS.map(collapse));

function variants(text) {
  const base = String(text ?? "")
    .replace(/ñ/gi, "ny")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .toLowerCase()
    // Allowlist: se quita la palabra permitida ANTES de colapsar, para que
    // "pola" pase y "polla" (que colapsa a "pola") siga bloqueada. Si aparecen
    // más casos, se añaden a este mismo patrón.
    .replace(/\b(pola|polas)\b/g, " ");
  const leet = base.replace(/[013457@$]/g, (c) => LEET[c]);
  return [base, leet].map((v) =>
    collapse(
      v.replace(/\b(?:[a-z][\s.\-_*]+){2,}[a-z]\b/g, (m) => m.replace(/[\s.\-_*]+/g, ""))
    )
  );
}

function checkText(text, { blockMild = true } = {}) {
  for (const v of variants(text)) {
    for (const t of v.split(/[^a-z]+/)) {
      if (!t) continue;
      if (STRONG.has(t)) return { ok: false, category: "insulto" };
      if (blockMild && MILD.has(t)) return { ok: false, category: "lenguaje_ofensivo" };
    }
    for (const [category, re] of PHRASES) {
      if (re.test(v)) return { ok: false, category };
    }
  }
  return { ok: true };
}

function isReservedName(name) {
  return variants(name).some((v) => {
    const n = v.replace(/[^a-z]/g, "");
    return RESERVED_NAMES.some((r) => n === r || n.startsWith(r));
  });
}

module.exports = { checkText, isReservedName };
