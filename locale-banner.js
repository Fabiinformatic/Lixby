/*!
 * Lixby - Banner de sugerencia de idioma segun pais
 * ---------------------------------------------------
 * Un unico archivo compartido por todas las paginas.
 *
 * Funcionamiento:
 *   1. Consulta /cdn-cgi/trace (endpoint nativo de Cloudflare, mismo
 *      dominio, sin API key) y extrae loc=XX (pais ISO).
 *   2. Si el fetch falla, usa navigator.language como respaldo.
 *   3. Mapea pais -> idioma y, si no coincide con el prefijo de la URL,
 *      muestra una barra inferior con un dropdown de los 24 idiomas
 *      (preseleccionado el sugerido) y un boton "Continuar" que redirige
 *      al idioma elegido, manteniendo el resto de la ruta intacto.
 *   4. El cierre/interaccion se guarda en sessionStorage (NO localStorage):
 *      la sugerencia reaparece en una nueva sesion/pestaña.
 *
 * Escape hatch: anyadir data-lixby-locale-off="1" a <html> desactiva
 * el banner en esa pagina (p.ej. checkout).
 *
 * Diseno: tarjeta flotante como el nav y el aviso de cookies (superficie
 * blanca con blur, borde --line, radio --radius-lg) y CTA con el degradado
 * azul del sitio (--primary -> --primary-2), todo via variables CSS con
 * valores de respaldo iguales.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "lixby_locale_prompt_dismissed";
  var STYLE_ID = "lixby-locale-css";
  var TRACE_TIMEOUT = 2500;

  /* Prefijos de idioma del sitio */
  var LANGS = ["de", "bg", "cs", "hr", "da", "sk", "sl", "es", "et", "fi",
    "fr", "el", "hu", "en", "ga", "it", "lv", "lt", "mt", "nl",
    "pl", "pt", "ro", "sv"];
  var DEFAULT_LANG = "es";

  /* Pais ISO -> prefijo de idioma sugerido */
  var COUNTRY_TO_LANG = {
    DE: "de", AT: "de", CH: "de",
    BG: "bg", CZ: "cs", HR: "hr", DK: "da", SK: "sk", SI: "sl",
    ES: "es", EE: "et", FI: "fi", FR: "fr", GR: "el", HU: "hu",
    GB: "en", IE: "en",
    IT: "it", LV: "lv", LT: "lt", MT: "mt",
    NL: "nl", BE: "fr", LU: "fr",
    PL: "pl", PT: "pt", RO: "ro", SE: "sv"
  };

  /* Textos por idioma de la pagina actual ({country} y {lang} se
     rellenan con Intl.DisplayNames cuando esta disponible). */
  var TEXTS = {
    es: { title: "Parece que estás en {country}. ¿Quieres ver Lixby en {lang}?", generic: "¿Quieres ver Lixby en {lang}?", action: "Continuar", close: "Cerrar", choose: "Elegir idioma", aria: "Sugerencia de idioma" },
    en: { title: "It looks like you're in {country}. Would you like to browse Lixby in {lang}?", generic: "Would you like to browse Lixby in {lang}?", action: "Continue", close: "Close", choose: "Choose language", aria: "Language suggestion" },
    de: { title: "Es sieht so aus, als befindest du dich in {country}. Möchtest du Lixby auf {lang} sehen?", generic: "Möchtest du Lixby auf {lang} sehen?", action: "Weiter", close: "Schließen", choose: "Sprache wählen", aria: "Sprachhinweis" },
    fr: { title: "Il semble que vous soyez en {country}. Souhaitez-vous consulter Lixby en {lang}\u00A0?", generic: "Souhaitez-vous consulter Lixby en {lang}\u00A0?", action: "Continuer", close: "Fermer", choose: "Choisir la langue", aria: "Suggestion de langue" },
    it: { title: "Sembra che tu sia in {country}. Vuoi vedere Lixby in {lang}?", generic: "Vuoi vedere Lixby in {lang}?", action: "Continua", close: "Chiudi", choose: "Scegli lingua", aria: "Suggerimento lingua" },
    pt: { title: "Parece que estás em {country}. Queres ver a Lixby em {lang}?", generic: "Queres ver a Lixby em {lang}?", action: "Continuar", close: "Fechar", choose: "Escolher idioma", aria: "Sugestão de idioma" },
    nl: { title: "Het lijkt erop dat je in {country} bent. Wil je Lixby in het {lang} bekijken?", generic: "Wil je Lixby in het {lang} bekijken?", action: "Doorgaan", close: "Sluiten", choose: "Taal kiezen", aria: "Taalvoorstel" },
    pl: { title: "Wygląda na to, że jesteś w {country}. Chcesz przejść do Lixby w języku {lang}?", generic: "Chcesz przejść do Lixby w języku {lang}?", action: "Dalej", close: "Zamknij", choose: "Wybierz język", aria: "Sugestia języka" },
    sv: { title: "Det verkar som att du är i {country}. Vill du se Lixby på {lang}?", generic: "Vill du se Lixby på {lang}?", action: "Fortsätt", close: "Stäng", choose: "Välj språk", aria: "Språkförslag" },
    da: { title: "Det ser ud til, at du er i {country}. Vil du se Lixby på {lang}?", generic: "Vil du se Lixby på {lang}?", action: "Fortsæt", close: "Luk", choose: "Vælg sprog", aria: "Sprogforslag" },
    fi: { title: "Näyttää siltä, että olet maassa {country}. Haluatko vaihtaa Lixbyn kieleksi: {lang}?", generic: "Haluatko vaihtaa Lixbyn kieleksi: {lang}?", action: "Jatka", close: "Sulje", choose: "Valitse kieli", aria: "Kieliehdotus" },
    el: { title: "Φαίνεται ότι βρίσκεστε σε {country}. Θέλετε να δείτε το Lixby στα {lang};", generic: "Θέλετε να δείτε το Lixby στα {lang};", action: "Συνέχεια", close: "Κλείσιμο", choose: "Επιλογή γλώσσας", aria: "Πρόταση γλώσσας" },
    hu: { title: "Úgy tűnik, hogy {country} vagy. Megnézed a Lixby oldalt {lang} nyelven?", generic: "Megnézed a Lixby oldalt {lang} nyelven?", action: "Folytatás", close: "Bezárás", choose: "Nyelv választása", aria: "Nyelvi javaslat" },
    cs: { title: "Vypadá to, že jste v zemi {country}. Chcete zobrazit Lixby v jazyce {lang}?", generic: "Chcete zobrazit Lixby v jazyce {lang}?", action: "Pokračovat", close: "Zavřít", choose: "Zvolit jazyk", aria: "Návrh jazyka" },
    sk: { title: "Zdá sa, že sa nachádzate v krajine {country}. Chcete zobraziť Lixby v jazyku {lang}?", generic: "Chcete zobraziť Lixby v jazyku {lang}?", action: "Pokračovať", close: "Zavrieť", choose: "Zvoliť jazyk", aria: "Návrh jazyka" },
    sl: { title: "Zdi se, da ste v državi {country}. Želite si ogledati Lixby v jeziku {lang}?", generic: "Želite si ogledati Lixby v jeziku {lang}?", action: "Naprej", close: "Zapri", choose: "Izberi jezik", aria: "Predlog jezika" },
    hr: { title: "Čini se da se nalazite u {country}. Želite li koristiti Lixby na jeziku: {lang}?", generic: "Želite li koristiti Lixby na jeziku: {lang}?", action: "Nastavi", close: "Zatvori", choose: "Odaberi jezik", aria: "Prijedlog jezika" },
    ro: { title: "Se pare că te afli în {country}. Vrei să vezi Lixby în limba {lang}?", generic: "Vrei să vezi Lixby în limba {lang}?", action: "Continuă", close: "Închide", choose: "Alege limba", aria: "Sugestie de limbă" },
    bg: { title: "Изглежда, че се намирате в {country}. Искате ли да прегледате Lixby на {lang}?", generic: "Искате ли да прегледате Lixby на {lang}?", action: "Напред", close: "Затваряне", choose: "Избор на език", aria: "Предложение за език" },
    et: { title: "Tundub, et oled riigis {country}. Kas soovid näha Lixby lehekülge keeles: {lang}?", generic: "Kas soovid näha Lixby lehekülge keeles: {lang}?", action: "Jätka", close: "Sulge", choose: "Vali keel", aria: "Keeleettepanek" },
    lv: { title: "Šķiet, ka atrodaties valstī {country}. Vai vēlaties skatīties Lixby {lang} valodā?", generic: "Vai vēlaties skatīties Lixby {lang} valodā?", action: "Tālāk", close: "Aizvērt", choose: "Izvēlēties valodu", aria: "Valodas ieteikums" },
    lt: { title: "Panašu, kad esate {country}. Ar norite peržiūrėti Lixby {lang} kalba?", generic: "Ar norite peržiūrėti Lixby {lang} kalba?", action: "Toliau", close: "Uždaryti", choose: "Pasirinkti kalbą", aria: "Kalbos pasiūlymas" },
    ga: { title: "Is cosúil go bhfuil tú i {country}. Ar mhaith leat Lixby a fheiceáil i {lang}?", generic: "Ar mhaith leat Lixby a fheiceáil i {lang}?", action: "Lean ar aghaidh", close: "Dún", choose: "Roghnaigh teanga", aria: "Moladh teanga" },
    mt: { title: "Jidher li qiegħed f'{country}. Trid tara Lixby bil-{lang}?", generic: "Trid tara Lixby bil-{lang}?", action: "Kompli", close: "Agħlaq", choose: "Agħżel lingwa", aria: "Suġġeriment ta' lingwa" }
  };

  /* ---------- Persistencia (sessionStorage) ---------- */

  function readDismissed() {
    try { return sessionStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { return false; }
  }

  function markDismissed() {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch (e) { /* noop */ }
  }

  /* Util para pruebas: lixbyLocaleReset() */
  window.lixbyLocaleReset = function () {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  };

  /* ---------- Idioma actual de la URL ---------- */

  function currentLang(pathname) {
    var segs = String(pathname || location.pathname).split("/");
    var seg = (segs[1] || "").toLowerCase();
    return LANGS.indexOf(seg) !== -1 ? seg : DEFAULT_LANG;
  }

  /* ---------- Deteccion de pais ---------- */

  function parseTrace(text) {
    var m = /(^|\n)loc=([A-Za-z]{2})(\r?\n|$)/.exec(String(text || ""));
    return m ? m[2].toUpperCase() : null;
  }

  function detectCountry() {
    var opts = {};
    var timer = null;
    if (typeof AbortController !== "undefined") {
      var ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, TRACE_TIMEOUT);
    }
    return fetch("/cdn-cgi/trace", opts)
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (t) {
        if (timer !== null) clearTimeout(timer);
        return parseTrace(t);
      })
      .catch(function () {
        if (timer !== null) clearTimeout(timer);
        return null;
      });
  }

  /* Respaldo: navigator.language ("de-AT" -> pais; "pt" -> idioma) */
  function fallbackFromNavigator(navLang) {
    var tag = String(navLang != null ? navLang : navigator.language || "").toLowerCase();
    if (!tag) return null;
    var parts = tag.split("-");
    var region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
    if (region && COUNTRY_TO_LANG[region]) return { country: region, lang: COUNTRY_TO_LANG[region] };
    if (LANGS.indexOf(parts[0]) !== -1) return { country: "", lang: parts[0] };
    return null;
  }

  /* ---------- Nombres localizados (sin tablas propias) ---------- */

  function intlName(code, locale, type) {
    try {
      if (typeof Intl === "undefined" || !Intl.DisplayNames) return "";
      var name = new Intl.DisplayNames([locale], { type: type }).of(code);
      return name && name !== code ? name : "";
    } catch (e) { return ""; }
  }

  function langLabel(sug, cur) {
    return intlName(sug, cur, "language") ||
           intlName(sug, sug, "language") || /* endonimo: Deutsch, English... */
           sug.toUpperCase();
  }

  function countryLabel(code, cur) {
    return intlName(code, cur, "region") || code;
  }

  /* ---------- Redireccion: solo cambia el primer segmento ---------- */

  function buildTargetPath(pathname, search, hash, lang) {
    if (pathname === "/" || pathname === "") {
      return "/" + lang + "/" + (search || "") + (hash || "");
    }
    var segs = pathname.split("/");
    if (segs.length > 1 && LANGS.indexOf((segs[1] || "").toLowerCase()) !== -1) {
      segs[1] = lang;
      return segs.join("/") + (search || "") + (hash || "");
    }
    return "/" + lang + pathname + (search || "") + (hash || "");
  }

  /* ---------- Estilos ---------- */

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      "#lixby-locale-banner{position:fixed;left:0;right:0;bottom:calc(16px + env(safe-area-inset-bottom));",
      "z-index:2147483000;display:flex;justify-content:center;pointer-events:none;",
      "font-family:var(--font-family,\"Inter\"),\"Manrope\",system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;",
      "animation:lixby-locale-in .35s ease both;}",
      ".lixby-locale-inner{pointer-events:auto;width:min(1120px,92vw);display:flex;align-items:center;gap:14px;",
      "padding:13px 18px;color:var(--text,#111827);background:var(--surface,#ffffff);",
      "-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);",
      "border:1px solid var(--line,#dbe3ef);border-radius:var(--radius-lg,18px);",
      "box-shadow:inset 0 1px 0 rgba(255,255,255,.65),var(--shadow-lg,0 20px 50px rgba(16,24,40,.12));}",
      ".lixby-locale-text{flex:1 1 auto;min-width:0;margin:0;font-size:14px;font-weight:600;line-height:1.45;}",
      ".lixby-locale-select{flex-shrink:0;height:38px;max-width:230px;padding:0 8px 0 14px;border-radius:999px;",
      "border:1px solid var(--line,#dbe3ef);background:var(--surface,#ffffff);color:var(--text,#111827);",
      "font-family:inherit;font-size:14px;font-weight:400;cursor:pointer;}",
      ".lixby-locale-select:focus-visible{outline:2px solid var(--primary,#0f3dff);outline-offset:2px;}",
      ".lixby-locale-btn{flex-shrink:0;border:none;cursor:pointer;height:38px;padding:0 22px;border-radius:999px;",
      "color:#fff;font-family:inherit;font-size:14px;font-weight:700;",
      "background:linear-gradient(120deg,var(--primary,#0f3dff),var(--primary-2,#16a7ff));",
      "box-shadow:0 12px 24px rgba(15,61,255,.3);transition:transform .2s ease,box-shadow .2s ease;}",
      ".lixby-locale-btn:hover{transform:translateY(-2px);box-shadow:0 16px 30px rgba(15,61,255,.38);}",
      ".lixby-locale-close{flex-shrink:0;border:none;background:transparent;cursor:pointer;",
      "color:var(--muted,#5f6b7a);font-size:20px;line-height:1;padding:6px 10px;border-radius:8px;}",
      ".lixby-locale-close:hover{color:var(--text,#111827);}",
      "@media (max-width:640px){",
      ".lixby-locale-inner{flex-direction:column;text-align:center;gap:10px;padding-top:16px;position:relative;}",
      ".lixby-locale-select,.lixby-locale-btn{width:100%;max-width:none;}",
      ".lixby-locale-close{position:absolute;top:-2px;right:-4px;}}",
      "@keyframes lixby-locale-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}",
      "@media (prefers-reduced-motion:reduce){#lixby-locale-banner{animation:none}}"
    ].join("");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- Banner ---------- */

  function showBanner(country, sug, cur) {
    ensureStyles();
    if (document.getElementById("lixby-locale-banner")) return;

    var T = textsFor(cur);
    var msg = (country ? T.title : (T.generic || T.title))
      .replace("{country}", countryLabel(country, cur))
      .replace("{lang}", langLabel(sug, cur));

    var bar = document.createElement("div");
    bar.id = "lixby-locale-banner";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", T.aria);

    var inner = document.createElement("div");
    inner.className = "lixby-locale-inner";

    var text = document.createElement("p");
    text.className = "lixby-locale-text";
    text.textContent = msg;

    /* Dropdown: los 24 idiomas, preseleccionado el sugerido */
    var sel = document.createElement("select");
    sel.className = "lixby-locale-select";
    sel.setAttribute("aria-label", T.choose);
    for (var i = 0; i < LANGS.length; i++) {
      var opt = document.createElement("option");
      opt.value = LANGS[i];
      var name = langLabel(LANGS[i], cur);
      opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
      if (LANGS[i] === sug) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.value = sug;

    var go = document.createElement("button");
    go.type = "button";
    go.className = "lixby-locale-btn";
    go.textContent = T.action;
    go.addEventListener("click", function () {
      markDismissed();
      /* Valida contra la lista blanca de idiomas (los options del select
         se construyen desde LANGS), de modo que el valor leido del DOM
         no pueda inyectar una URL arbitraria al redirigir. */
      var chosen = sel.value;
      var lang = LANGS.indexOf(chosen) !== -1 ? chosen : sug;
      /* Redirige al idioma elegido en el dropdown (o al sugerido) */
      window.location.replace(
        buildTargetPath(location.pathname, location.search, location.hash, lang)
      );
    });

    var x = document.createElement("button");
    x.type = "button";
    x.className = "lixby-locale-close";
    x.setAttribute("aria-label", T.close);
    x.textContent = "\u00D7";
    x.addEventListener("click", function () {
      markDismissed();
      bar.remove();
    });

    inner.appendChild(text);
    inner.appendChild(sel);
    inner.appendChild(go);
    inner.appendChild(x);
    bar.appendChild(inner);

    if (document.body) {
      document.body.appendChild(bar);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        document.body.appendChild(bar);
      });
    }
  }

  function textsFor(lang) {
    return TEXTS[lang] || TEXTS.en || TEXTS.es;
  }

  /* ---------- Arranque ---------- */

  function init() {
    if (readDismissed()) return;
    if ((document.documentElement.getAttribute("data-lixby-locale-off") || "") === "1") return;

    var cur = currentLang(location.pathname);
    detectCountry().then(function (cc) {
      var hit = cc && COUNTRY_TO_LANG[cc] ? COUNTRY_TO_LANG[cc] : null;
      var country = hit ? cc : "";
      if (!hit) {
        var fb = fallbackFromNavigator();
        if (!fb) return;
        hit = fb.lang;
        country = fb.country;
      }
      if (hit === cur) return;
      showBanner(country, hit, cur);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
