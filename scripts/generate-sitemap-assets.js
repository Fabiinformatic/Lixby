const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const functionsDir = path.join(rootDir, "functions");
const dynamicOutputDir = path.join(functionsDir, "generated");
const staticOutputPath = path.join(rootDir, "sitemap.xml");
const dynamicOutputPath = path.join(dynamicOutputDir, "sitemap.xml");
const siteOrigin = "https://lixby.es";

const ignoredTopLevel = new Set([
  ".git",
  ".github",
  ".firebase",
  ".config",
  ".stripe",
  "node_modules",
  "functions",
  "src",
  "dataconnect",
  "y",
  "scripts"
]);

const excludedPageNames = new Set([
  "admin",
  "account",
  "cambiar-contrasena",
  "cart",
  "cesta",
  "change-password",
  "cuenta",
  "forget-password",
  "gracias",
  "iniciar-sesion",
  "login",
  "olvidar-contrasena",
  "thank-you",
  "thankyou",
  "track",
  "two-step verification",
  "verificado",
  "verificacion-2-pasos",
  "verified"
]);

function collectHtmlFiles(currentDir, relativeDir = "") {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    const absolutePath = path.join(currentDir, entry.name);
    const topLevel = relativePath.split("/")[0];

    if (ignoredTopLevel.has(topLevel) || topLevel.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push({
        absolutePath,
        relativePath
      });
    }
  }

  return files;
}

function isNoindex(html) {
  const getHtmlAttribute = (tag, attributeName) => {
    const attributeMatch = tag.match(
      new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i")
    );

    if (!attributeMatch) {
      return null;
    }

    return (attributeMatch[1] || attributeMatch[2] || "").trim();
  };

  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const name = getHtmlAttribute(tag, "name");
    if (!name || name.toLowerCase() !== "robots") {
      continue;
    }

    const content = getHtmlAttribute(tag, "content");
    if (content && /(^|[\s,])noindex([\s,]|$)/i.test(content)) {
      return true;
    }
  }

  return false;
}

function toUrlPath(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, "/");

  if (normalizedPath === "index.html") {
    return "/";
  }

  if (normalizedPath.endsWith("/index.html")) {
    return `/${normalizedPath.slice(0, -"index.html".length)}`;
  }

  return `/${normalizedPath.slice(0, -".html".length)}`;
}

function toAbsoluteUrl(relativePath) {
  const urlPath = toUrlPath(relativePath);
  const encodedPath = urlPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
    .replace(/%2F/g, "/");

  return new URL(encodedPath, siteOrigin).toString();
}

function isExcludedFromSitemap(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, "/");
  const fileName = path.posix.basename(normalizedPath, ".html").toLowerCase();
  return excludedPageNames.has(fileName);
}

function getSitemapMeta(urlPath) {
  if (urlPath === "/" || /^\/[a-z]{2}\/?$/.test(urlPath)) {
    return { changefreq: "weekly", priority: "1.0" };
  }

  if (
    /\/(centro-ayuda|help-center|centre-aide|pagalbos-centras|помощен-център)(\/|$)/u.test(urlPath) ||
    /\/(support|поддръжка|střední)$/.test(urlPath)
  ) {
    return { changefreq: "weekly", priority: "0.7" };
  }

  if (
    /\/(comprar-cascos|buy-headphones)\/lixbuds-one\/?$/.test(urlPath) ||
    /\/pages\/products\//.test(urlPath)
  ) {
    return { changefreq: "monthly", priority: "0.8" };
  }

  return { changefreq: "monthly", priority: "0.5" };
}

function xmlEscape(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemapEntries() {
  const seenUrls = new Set();
  const entries = [];

  for (const file of collectHtmlFiles(rootDir)) {
    if (isExcludedFromSitemap(file.relativePath)) continue;

    const html = fs.readFileSync(file.absolutePath, "utf8");
    if (isNoindex(html)) continue;

    const canonicalUrl = toAbsoluteUrl(file.relativePath);
    if (seenUrls.has(canonicalUrl)) continue;

    seenUrls.add(canonicalUrl);

    const stat = fs.statSync(file.absolutePath);
    const urlPath = new URL(canonicalUrl).pathname;
    const meta = getSitemapMeta(urlPath);

    entries.push({
      canonicalUrl,
      lastmod: stat.mtime.toISOString().slice(0, 10),
      changefreq: meta.changefreq,
      priority: meta.priority
    });
  }

  entries.sort((a, b) => a.canonicalUrl.localeCompare(b.canonicalUrl));
  return entries;
}

function buildXml(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ];

  for (const entry of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${xmlEscape(entry.canonicalUrl)}</loc>`);
    lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    lines.push(`    <priority>${entry.priority}</priority>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>", "");
  return lines.join("\n");
}

function main() {
  const entries = buildSitemapEntries();
  const xml = buildXml(entries);

  fs.mkdirSync(dynamicOutputDir, { recursive: true });
  fs.writeFileSync(staticOutputPath, xml, "utf8");
  fs.writeFileSync(dynamicOutputPath, xml, "utf8");

  console.log(`Generated sitemap assets with ${entries.length} URLs.`);
}

main();
