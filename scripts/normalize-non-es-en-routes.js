const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const TARGET_LOCALES = [
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'et',
  'fi',
  'fr',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
];

const SITE_HOSTS = new Set(['lixby.es', 'www.lixby.es']);
const DUPLICATE_FALLBACK_BASENAMES = new Set(['cesta.html']);

const DIRECTORY_MAP = new Map([
  ['centro-ayuda', 'help-center'],
  ['centre-aide', 'help-center'],
  ['pagalbos-centras', 'help-center'],
  ['помощен-център', 'help-center'],
  ['comprar-cascos', 'buy-headphones'],
]);

const ENGLISH_SEGMENT_MAP = new Map([
  ['about', 'about'],
  ['относно', 'about'],
  ['apie', 'about'],
  ['cambiar-contrasena', 'change-password'],
  ['changer-le-mot-de-passe', 'change-password'],
  ['cambiare-la-password', 'change-password'],
  ['pakeisti-slaptažodį', 'change-password'],
  ['alterar-password', 'change-password'],
  ['промяна-на-паролата', 'change-password'],
  ['cesta', 'cart'],
  ['korb', 'cart'],
  ['panier', 'cart'],
  ['cestino', 'cart'],
  ['krepšelis', 'cart'],
  ['кошница', 'cart'],
  ['comprar', 'buy'],
  ['kaufen', 'buy'],
  ['acheter', 'buy'],
  ['acquistare', 'buy'],
  ['pirkti', 'buy'],
  ['купувам', 'buy'],
  ['cuenta', 'account'],
  ['konto', 'account'],
  ['compte', 'account'],
  ['account', 'account'],
  ['sąskaitą', 'account'],
  ['conta', 'account'],
  ['сметка', 'account'],
  ['iniciar-sesion', 'login'],
  ['einloggen', 'login'],
  ['se-connecter', 'login'],
  ['login', 'login'],
  ['prisijungti', 'login'],
  ['conecte-se', 'login'],
  ['влизане', 'login'],
  ['olvidar-contrasena', 'forget-password'],
  ['pamiršti-slaptažodį', 'forget-password'],
  ['regalo', 'gift'],
  ['dovana', 'gift'],
  ['tienda', 'shop'],
  ['obchod', 'shop'],
  ['speichern', 'shop'],
  ['magasin', 'shop'],
  ['negozio', 'shop'],
  ['parduotuvė', 'shop'],
  ['loja', 'shop'],
  ['магазин', 'shop'],
  ['support', 'support'],
  ['střední', 'support'],
  ['поддръжка', 'support'],
  ['verificacion-2-pasos', 'two-step verification'],
  ['zwei-schritt-verifizierung', 'two-step verification'],
  ['dvoufázové-ověření', 'two-step verification'],
  ['vérification-en-deux-étapes', 'two-step verification'],
  ['verifica-in-due-passaggi', 'two-step verification'],
  ['dviejų-pakopų-patvirtinimas', 'two-step verification'],
  ['verificação-em-duas-etapas', 'two-step verification'],
  ['двуетапна-проверка', 'two-step verification'],
  ['verificado', 'verified'],
  ['verifiziert', 'verified'],
  ['ověřeno', 'verified'],
  ['vérifié', 'verified'],
  ['verificato', 'verified'],
  ['patikrinta', 'verified'],
  ['потвърден', 'verified'],
  ['thank-you', 'thank-you'],
  ['merci', 'thank-you'],
  ['ačiū', 'thank-you'],
  ['track', 'track'],
  ['contacto', 'contact'],
  ['contact', 'contact'],
  ['contatto', 'contact'],
  ['susisiekti', 'contact'],
  ['контакт', 'contact'],
  ['devoluciones', 'returns'],
  ['retours', 'returns'],
  ['resi', 'returns'],
  ['grįžta', 'returns'],
  ['връщания', 'returns'],
  ['returns', 'returns'],
  ['faq', 'faq'],
  ['garantia', 'warranty'],
  ['garantie', 'warranty'],
  ['garanzia', 'warranty'],
  ['garantija', 'warranty'],
  ['гаранция', 'warranty'],
  ['warranty', 'warranty'],
  ['solucion-problemas', 'troubleshooting'],
  ['résolution-de-problèmes', 'troubleshooting'],
  ['risoluzione-dei-problemi', 'troubleshooting'],
  ['problemų-sprendimas', 'troubleshooting'],
  ['решаване-на-проблеми', 'troubleshooting'],
  ['avis-juridique', 'legal-notice'],
  ['legal-notice', 'legal-notice'],
  ['cookies', 'cookies'],
  ['privacy', 'privacy'],
  ['terms', 'terms'],
  ['lixbuds-one', 'lixbuds-one'],
  ['index', 'index'],
]);

const HELP_CENTER_SEGMENT_MAP = new Map([
  ['lixbuds', 'lixbuds-support'],
  ['lixney', 'lixney-support'],
]);

const NON_HELP_CENTER_FIXUP_MAP = new Map([
  ['lixbuds-support', 'lixbuds'],
  ['lixney-support', 'lixney'],
]);

const GLOBAL_TEXT_FILE_REPLACEMENTS = [
  ['cambiar-contrasena.html', 'change-password.html'],
  ['changer-le-mot-de-passe.html', 'change-password.html'],
  ['cambiare-la-password.html', 'change-password.html'],
  ['pakeisti-slaptažodį.html', 'change-password.html'],
  ['alterar-password.html', 'change-password.html'],
  ['промяна-на-паролата.html', 'change-password.html'],
  ['cesta.html', 'cart.html'],
  ['korb.html', 'cart.html'],
  ['panier.html', 'cart.html'],
  ['cestino.html', 'cart.html'],
  ['krepšelis.html', 'cart.html'],
  ['кошница.html', 'cart.html'],
  ['comprar.html', 'buy.html'],
  ['kaufen.html', 'buy.html'],
  ['acheter.html', 'buy.html'],
  ['acquistare.html', 'buy.html'],
  ['pirkti.html', 'buy.html'],
  ['купувам.html', 'buy.html'],
  ['cuenta.html', 'account.html'],
  ['konto.html', 'account.html'],
  ['compte.html', 'account.html'],
  ['conta.html', 'account.html'],
  ['sąskaitą.html', 'account.html'],
  ['сметка.html', 'account.html'],
  ['iniciar-sesion.html', 'login.html'],
  ['einloggen.html', 'login.html'],
  ['se-connecter.html', 'login.html'],
  ['prisijungti.html', 'login.html'],
  ['conecte-se.html', 'login.html'],
  ['влизане.html', 'login.html'],
  ['olvidar-contrasena.html', 'forget-password.html'],
  ['pamiršti-slaptažodį.html', 'forget-password.html'],
  ['regalo.html', 'gift.html'],
  ['dovana.html', 'gift.html'],
  ['tienda.html', 'shop.html'],
  ['obchod.html', 'shop.html'],
  ['speichern.html', 'shop.html'],
  ['magasin.html', 'shop.html'],
  ['negozio.html', 'shop.html'],
  ['parduotuvė.html', 'shop.html'],
  ['loja.html', 'shop.html'],
  ['магазин.html', 'shop.html'],
  ['střední.html', 'support.html'],
  ['поддръжка.html', 'support.html'],
  ['verificacion-2-pasos.html', 'two-step verification.html'],
  ['zwei-schritt-verifizierung.html', 'two-step verification.html'],
  ['dvoufázové-ověření.html', 'two-step verification.html'],
  ['vérification-en-deux-étapes.html', 'two-step verification.html'],
  ['verifica-in-due-passaggi.html', 'two-step verification.html'],
  ['dviejų-pakopų-patvirtinimas.html', 'two-step verification.html'],
  ['verificação-em-duas-etapas.html', 'two-step verification.html'],
  ['двуетапна-проверка.html', 'two-step verification.html'],
  ['verificado.html', 'verified.html'],
  ['verifiziert.html', 'verified.html'],
  ['ověřeno.html', 'verified.html'],
  ['vérifié.html', 'verified.html'],
  ['verificato.html', 'verified.html'],
  ['patikrinta.html', 'verified.html'],
  ['потвърден.html', 'verified.html'],
  ['merci.html', 'thank-you.html'],
  ['ačiū.html', 'thank-you.html'],
  ['contacto.html', 'contact.html'],
  ['contatto.html', 'contact.html'],
  ['susisiekti.html', 'contact.html'],
  ['контакт.html', 'contact.html'],
  ['devoluciones.html', 'returns.html'],
  ['retours.html', 'returns.html'],
  ['resi.html', 'returns.html'],
  ['grįžta.html', 'returns.html'],
  ['връщания.html', 'returns.html'],
  ['garantia.html', 'warranty.html'],
  ['garantie.html', 'warranty.html'],
  ['garanzia.html', 'warranty.html'],
  ['garantija.html', 'warranty.html'],
  ['гаранция.html', 'warranty.html'],
  ['solucion-problemas.html', 'troubleshooting.html'],
  ['résolution-de-problèmes.html', 'troubleshooting.html'],
  ['risoluzione-dei-problemi.html', 'troubleshooting.html'],
  ['problemų-sprendimas.html', 'troubleshooting.html'],
  ['решаване-на-проблеми.html', 'troubleshooting.html'],
  ['avis-juridique.html', 'legal-notice.html'],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeKey(value) {
  return decodeURIComponent(value).normalize('NFC').toLocaleLowerCase('en-US');
}

function splitSuffix(value) {
  const hashIndex = value.indexOf('#');
  const queryIndex = value.indexOf('?');
  const indexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  const splitIndex = indexes.length ? Math.min(...indexes) : -1;

  if (splitIndex === -1) {
    return { base: value, suffix: '' };
  }

  return {
    base: value.slice(0, splitIndex),
    suffix: value.slice(splitIndex),
  };
}

function mapSegmentToEnglish(segment, { isFile = false, inHelpCenterContext = false } = {}) {
  const decoded = decodeURIComponent(segment).normalize('NFC');
  const segmentKey = normalizeKey(decoded);

  if (!isFile) {
    if (DIRECTORY_MAP.has(segmentKey)) {
      return DIRECTORY_MAP.get(segmentKey);
    }

    if (inHelpCenterContext && HELP_CENTER_SEGMENT_MAP.has(segmentKey)) {
      return HELP_CENTER_SEGMENT_MAP.get(segmentKey);
    }

    if (!inHelpCenterContext && NON_HELP_CENTER_FIXUP_MAP.has(segmentKey)) {
      return NON_HELP_CENTER_FIXUP_MAP.get(segmentKey);
    }

    if (ENGLISH_SEGMENT_MAP.has(segmentKey)) {
      return ENGLISH_SEGMENT_MAP.get(segmentKey);
    }

    return decoded;
  }

  const extension = path.extname(decoded);
  if (!extension) {
    return decoded;
  }

  const basename = decoded.slice(0, -extension.length);
  const basenameKey = normalizeKey(basename);

  if (inHelpCenterContext && HELP_CENTER_SEGMENT_MAP.has(basenameKey)) {
    return `${HELP_CENTER_SEGMENT_MAP.get(basenameKey)}${extension}`;
  }

  if (!inHelpCenterContext && NON_HELP_CENTER_FIXUP_MAP.has(basenameKey)) {
    return `${NON_HELP_CENTER_FIXUP_MAP.get(basenameKey)}${extension}`;
  }

  if (ENGLISH_SEGMENT_MAP.has(basenameKey)) {
    return `${ENGLISH_SEGMENT_MAP.get(basenameKey)}${extension}`;
  }

  return decoded;
}

function normalizePathSegments(segments) {
  const normalized = [];
  let inHelpCenterContext = false;

  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') {
      normalized.push(segment);
      continue;
    }

    const decoded = decodeURIComponent(segment).normalize('NFC');
    if (segment.endsWith('.html')) {
      normalized.push(
        mapSegmentToEnglish(decoded, { isFile: true, inHelpCenterContext }),
      );
      continue;
    }

    const mappedSegment = mapSegmentToEnglish(decoded, { inHelpCenterContext });
    normalized.push(mappedSegment);

    if (mappedSegment === 'help-center') {
      inHelpCenterContext = true;
    }
  }

  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (normalized[index] === 'pages' && normalized[index + 1] === 'support.html') {
      normalized.splice(index, 1);
      index -= 1;
    }
  }

  return normalized;
}

function normalizeRelativeUrl(value) {
  if (!value) {
    return value;
  }

  if (/^(mailto:|tel:|javascript:|data:|#)/i.test(value)) {
    return value;
  }

  const refreshMatch = value.match(/^([^;]*;\s*url=)(.+)$/i);
  if (refreshMatch) {
    return `${refreshMatch[1]}${normalizeRelativeUrl(refreshMatch[2])}`;
  }

  if (/^https?:\/\//i.test(value)) {
    return normalizeSiteUrl(value);
  }

  if (/^\/\//.test(value)) {
    return value;
  }

  const { base, suffix } = splitSuffix(value);
  const normalizedBase = normalizePathSegments(base.split('/')).join('/');
  return `${normalizedBase}${suffix}`;
}

function normalizeSiteUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return value;
  }

  if (!SITE_HOSTS.has(url.hostname)) {
    return value;
  }

  const segments = url.pathname.split('/');
  const locale = segments[1];

  if (!locale || locale === 'es') {
    return value;
  }

  const trailingSlash = url.pathname.endsWith('/');
  const rest = segments.slice(2).filter((segment) => segment !== '');
  const normalizedRest = normalizePathSegments(rest);
  const rebuilt = ['', locale, ...normalizedRest].join('/');

  url.pathname = trailingSlash ? `${rebuilt}/` : rebuilt;
  return url.toString();
}

function rewriteHtmlContent(filePath, locale) {
  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;

  updated = updated.replace(
    /(\b(?:href|src|action|content|poster)\s*=\s*["'])([^"']+)(["'])/gi,
    (match, prefix, value, suffix) => `${prefix}${normalizeRelativeUrl(value)}${suffix}`,
  );

  updated = updated.replace(
    /https?:\/\/(?:www\.)?lixby\.es[^\s"'`<>)]+/gi,
    (match) => normalizeSiteUrl(match),
  );

  updated = updated.replace(
    /((?:\.\.\/)*)pages\/support\.html/g,
    (match, prefix) => `${prefix}support.html`,
  );

  updated = updated.replace(
    /\/es\/verificado\.html/g,
    `/${locale}/verified.html`,
  );

  for (const [from, to] of GLOBAL_TEXT_FILE_REPLACEMENTS) {
    updated = updated.replace(new RegExp(escapeRegExp(from), 'gi'), to);
  }

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
}

function walkHtmlFiles(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkHtmlFiles(absolutePath, results);
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.html')) {
      results.push(absolutePath);
    }
  }

  return results;
}

function normalizeRelativeFilePath(relativePath) {
  return normalizePathSegments(relativePath.split('/')).join('/');
}

function choosePreferredEntry(entries) {
  return [...entries].sort((left, right) => {
    const leftBase = path.basename(left.sourcePath).toLocaleLowerCase('en-US');
    const rightBase = path.basename(right.sourcePath).toLocaleLowerCase('en-US');
    const leftPenalty = DUPLICATE_FALLBACK_BASENAMES.has(leftBase) ? 1 : 0;
    const rightPenalty = DUPLICATE_FALLBACK_BASENAMES.has(rightBase) ? 1 : 0;

    if (leftPenalty !== rightPenalty) {
      return leftPenalty - rightPenalty;
    }

    return left.sourceRelativePath.localeCompare(right.sourceRelativePath);
  })[0];
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function removeEmptyDirectories(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeEmptyDirectories(absolutePath);
    }
  }

  if (dir === ROOT_DIR) {
    return;
  }

  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

function collectRenamePlan(localeDir) {
  const files = walkHtmlFiles(localeDir);
  const groupedByTarget = new Map();

  for (const sourcePath of files) {
    const sourceRelativePath = path.relative(localeDir, sourcePath).replace(/\\/g, '/');
    const targetRelativePath = normalizeRelativeFilePath(sourceRelativePath);
    const entry = { sourcePath, sourceRelativePath, targetRelativePath };
    const entries = groupedByTarget.get(targetRelativePath) || [];
    entries.push(entry);
    groupedByTarget.set(targetRelativePath, entries);
  }

  const renamePlan = [];
  const deletePlan = [];

  for (const entries of groupedByTarget.values()) {
    const winner = choosePreferredEntry(entries);
    renamePlan.push(winner);

    for (const entry of entries) {
      if (entry !== winner) {
        deletePlan.push(entry.sourcePath);
      }
    }
  }

  renamePlan.sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath));
  deletePlan.sort((left, right) => left.localeCompare(right));

  return { renamePlan, deletePlan };
}

function executeLocale(locale) {
  const localeDir = path.join(ROOT_DIR, locale);
  const { renamePlan, deletePlan } = collectRenamePlan(localeDir);

  for (const entry of renamePlan) {
    const targetPath = path.join(localeDir, ...entry.targetRelativePath.split('/'));
    ensureParentDirectory(targetPath);

    if (entry.sourcePath !== targetPath) {
      fs.renameSync(entry.sourcePath, targetPath);
    }
  }

  for (const filePath of deletePlan) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  removeEmptyDirectories(localeDir);

  const normalizedFiles = walkHtmlFiles(localeDir).sort((left, right) => left.localeCompare(right));
  for (const filePath of normalizedFiles) {
    rewriteHtmlContent(filePath, locale);
  }

  return {
    locale,
    renamed: renamePlan.filter((entry) => entry.sourceRelativePath !== entry.targetRelativePath).length,
    removedDuplicates: deletePlan.length,
  };
}

function main() {
  const summary = TARGET_LOCALES.map(executeLocale);

  for (const item of summary) {
    process.stdout.write(
      `${item.locale}: renamed ${item.renamed} HTML route files, removed ${item.removedDuplicates} duplicate leftovers\n`,
    );
  }
}

main();
