/*!
 * Lixby - Google Tag Manager + Consent Mode v2 (RGPD)
 * ---------------------------------------------------
 * Un unico archivo compartido por todas las paginas.
 *
 * Modo basico (AEPD-friendly):
 *   1. Consentimiento DENEGADO por defecto (Consent Mode v2).
 *   2. Si el usuario ya decidio (localStorage), se aplica su decision.
 *   3. GTM solo se carga tras un "Aceptar" explícito.
 *      Con "Rechazar" GTM nunca llega a cargar.
 *   4. Sin decision previa se muestra un mini-banner (ES si la pagina
 *      esta en espanol, EN como neutro para el resto de idiomas),
 *      con boton "Configurar" que despliega un panel de preferencias.
 *   5. El enlace "Configurar cookies" del pie abre el mismo panel
 *      reflejando la decision guardada; al guardar cambia y recarga.
 *
 * Diseno: reutiliza las variables CSS del sitio (--primary, --line,
 * --radius-lg, --font-family...) con valores de respaldo iguales.
 */
(function () {
  "use strict";

  var GTM_ID = "GTM-KB2GQBDR";
  var STORAGE_KEY = "lixby-consent";
  var STYLE_ID = "lixby-consent-css";

  /* dataLayer debe existir antes que nada */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  /* 1. Default denegado (Consent Mode v2 completo) */
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
    wait_for_update: 500
  });

  var GRANTED = {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
    functionality_storage: "granted",
    personalization_storage: "granted"
  };

  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* noop */ }
  }

  function loadGTM() {
    if (document.getElementById("lixby-gtm")) return;
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.id = "lixby-gtm";
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + GTM_ID;
    (document.head || document.documentElement).appendChild(s);
  }

  function applyDecision(choice) {
    saveChoice(choice);
    if (choice === "granted") {
      gtag("consent", "update", GRANTED);
      loadGTM();
    }
    /* "denied": no cargamos GTM en absoluto */
  }

  /* Util para pruebas desde consola: lixbyConsentReset() */
  window.lixbyConsentReset = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  };

  /* 2. Decision previa del usuario */
  var stored = readChoice();
  var needsBanner = false;
  if (stored === "granted") {
    applyDecision("granted");
  } else if (stored === "denied") {
    applyDecision("denied");
  } else {
    needsBanner = true;
  }

  /* 3. Textos (ES si la pagina es española, EN como neutro) */
  var isSpanish = (document.documentElement.lang || "").toLowerCase().slice(0, 2) === "es";
  var T = isSpanish
    ? {
        aria: "Aviso de cookies",
        msg: "Usamos cookies de anal\u00EDtica para mejorar Lixby. \u00BFLas aceptas?",
        more: "M\u00E1s info",
        link: "/es/pages/legal/cookies/",
        accept: "Aceptar",
        reject: "Rechazar",
        settings: "Configurar",
        settingsTitle: "Preferencias de cookies",
        analyticsLabel: "Cookies anal\u00EDticas",
        save: "Guardar preferencias"
      }
    : {
        aria: "Cookie notice",
        msg: "We use analytics cookies to improve Lixby. Do you accept them?",
        more: "More info",
        link: "/en/pages/legal/cookies/",
        accept: "Accept",
        reject: "Reject",
        settings: "Configure",
        settingsTitle: "Cookie preferences",
        analyticsLabel: "Analytics cookies",
        save: "Save preferences"
      };

  /* Estilos propios, alineados con el design system de la web */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ".lixby-card{position:fixed;left:16px;right:16px;bottom:16px;margin:0 auto;",
      "max-width:640px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;",
      "background:var(--surface,#ffffff);color:var(--text,#111827);",
      "font-family:var(--font-family,\"Inter\"),\"Manrope\",system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;",
      "font-size:14px;line-height:1.45;padding:18px 22px;",
      "border:1px solid var(--line,#dbe3ef);border-radius:var(--radius-lg,18px);",
      "box-shadow:var(--shadow-lg,0 20px 50px rgba(16,24,40,.12));z-index:2147483647;}",
      ".lixby-card.lixby-col{flex-direction:column;align-items:stretch;}",
      ".lixby-text{flex:1 1 auto;min-width:0;}",
      ".lixby-actions{display:flex;gap:10px;flex-shrink:0;}",
      "@media (max-width:520px){",
      ".lixby-card{flex-direction:column;align-items:stretch;}",
      ".lixby-actions{width:100%;}",
      ".lixby-actions .lixby-btn{flex:1;padding:10px 8px;font-size:13px;}",
      "}",
      ".lixby-link{color:var(--primary,#0f3dff);text-decoration:underline;font-weight:500;white-space:nowrap;}",
      ".lixby-btn{display:inline-flex;align-items:center;justify-content:center;",
      "padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px;cursor:pointer;",
      "text-decoration:none;font-family:inherit;",
      "transition:transform .2s ease,box-shadow .2s ease,color .2s ease;}",
      ".lixby-btn:hover{transform:translateY(-2px);}",
      ".lixby-btn-solid{color:#fff;border:none;",
      "background:linear-gradient(120deg,var(--primary,#0f3dff),var(--primary-2,#16a7ff));",
      "box-shadow:0 12px 24px rgba(15,61,255,.3);}",
      ".lixby-btn-solid:hover{box-shadow:0 16px 30px rgba(15,61,255,.38);}",
      ".lixby-btn-outline{color:var(--text,#111827);background:var(--surface,#ffffff);",
      "border:1px solid var(--line,#dbe3ef);}",
      ".lixby-panel{flex-basis:100%;display:none;flex-direction:column;gap:12px;",
      "padding-top:14px;border-top:1px solid var(--line,#dbe3ef);}",
      ".lixby-panel-title{font-weight:700;}",
      ".lixby-row{display:flex;align-items:center;gap:10px;cursor:pointer;}",
      ".lixby-box{width:18px;height:18px;accent-color:var(--primary,#0f3dff);cursor:pointer;margin:0;}",
      ".lixby-close{position:absolute;top:10px;right:14px;border:none;background:transparent;",
      "font-size:20px;line-height:1;color:var(--muted,#5f6b7a);padding:4px 8px;cursor:pointer;}",
      ".lixby-close:hover{transform:none;color:var(--text,#111827);}",
      ".lixby-backdrop{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;",
      "background:rgba(15,23,42,.45);backdrop-filter:blur(4px);",
      "-webkit-backdrop-filter:blur(4px);animation:lixbyFade .25s ease;}",
      "@keyframes lixbyFade{from{opacity:0}to{opacity:1}}",
      ".lixby-panel-outer{width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow-y:auto;",
      "animation:lixbyPop .3s cubic-bezier(.2,.9,.3,1.2);}",
      "@keyframes lixbyPop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}",
      ".lixby-card.lixby-settings{position:relative;left:auto;right:auto;bottom:auto;width:100%;max-width:none;",
      "display:flex;flex-direction:column;gap:16px;padding:24px;overflow:visible;}",
      ".lixby-settings .lixby-head{display:flex;align-items:center;gap:12px;padding-right:28px;}",
      ".lixby-settings .lixby-head-icon{width:40px;height:40px;border-radius:12px;flex-shrink:0;",
      "display:flex;align-items:center;justify-content:center;",
      "background:linear-gradient(120deg,var(--primary,#0f3dff),var(--primary-2,#16a7ff));}",
      ".lixby-settings .lixby-head-icon svg{width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;",
      "stroke-linecap:round;stroke-linejoin:round;}",
      ".lixby-settings .lixby-title{font-size:1.05rem;font-weight:800;color:var(--text,#111827);",
      "letter-spacing:-.02em;line-height:1.2;}",
      ".lixby-settings .lixby-sub{font-size:.85rem;color:var(--muted,#5f6b7a);line-height:1.5;margin-top:2px;}",
      ".lixby-settings .lixby-options{display:flex;flex-direction:column;gap:10px;}",
      ".lixby-settings .lixby-option{display:flex;align-items:center;justify-content:space-between;gap:12px;",
      "padding:14px 16px;border:1px solid var(--line,#dbe3ef);border-radius:var(--radius-md,14px);",
      "background:var(--color-gray-50,#f8fafc);}",
      ".lixby-settings .lixby-option .lixby-opt-label{display:flex;flex-direction:column;gap:2px;flex:1;}",
      ".lixby-settings .lixby-option .lixby-opt-name{font-weight:700;font-size:.92rem;color:var(--text,#111827);}",
      ".lixby-settings .lixby-option .lixby-opt-desc{font-size:.8rem;color:var(--muted,#5f6b7a);line-height:1.4;}",
      ".lixby-settings .lixby-option .lixby-badge{display:inline-block;font-size:.65rem;font-weight:700;",
      "letter-spacing:.05em;text-transform:uppercase;color:var(--primary,#0f3dff);",
      "background:rgba(15,61,255,.1);padding:2px 8px;border-radius:999px;align-self:flex-start;}",
      ".lixby-settings .lixby-option.lixby-locked{opacity:.95;}",
      ".lixby-settings .lixby-switch{-webkit-appearance:none;appearance:none;position:relative;width:46px;height:26px;",
      "flex-shrink:0;margin:0;cursor:pointer;border-radius:999px;outline:none;",
      "background:var(--line,#dbe3ef);transition:background .25s ease;}",
      ".lixby-settings .lixby-switch::after{content:'';position:absolute;top:2px;left:2px;width:22px;height:22px;",
      "border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .25s ease;}",
      ".lixby-settings .lixby-switch:checked{background:linear-gradient(120deg,var(--primary,#0f3dff),var(--primary-2,#16a7ff));}",
      ".lixby-settings .lixby-switch:checked::after{transform:translateX(20px);}",
      ".lixby-settings .lixby-switch:focus-visible{box-shadow:0 0 0 3px rgba(15,61,255,.25);}",
      ".lixby-settings .lixby-settings-foot{display:flex;justify-content:flex-end;gap:10px;}",
      "@media (max-width:520px){",
      ".lixby-settings .lixby-settings-foot{flex-direction:column;}",
      ".lixby-settings .lixby-settings-foot .lixby-btn{width:100%;}",
      ".lixby-option{flex-wrap:wrap;}",
      "}"
    ].join("");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function button(label, primary) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = primary ? "lixby-btn lixby-btn-solid" : "lixby-btn lixby-btn-outline";
    b.textContent = label;
    return b;
  }

  /* Bloque reutilizable de opciones (analiticas por defecto / estrictas bloqueadas) */
  function buildOptions(initialChecked) {
    var options = document.createElement("div");
    options.className = "lixby-options";

    var strict = document.createElement("div");
    strict.className = "lixby-option lixby-locked";
    var strictLabel = document.createElement("div");
    strictLabel.className = "lixby-opt-label";
    var strictName = document.createElement("span");
    strictName.className = "lixby-opt-name";
    strictName.textContent = isSpanish ? "Cookies estrictamente necesarias" : "Strictly necessary cookies";
    var strictBadge = document.createElement("span");
    strictBadge.className = "lixby-badge";
    strictBadge.textContent = isSpanish ? "Siempre activas" : "Always on";
    var strictDesc = document.createElement("span");
    strictDesc.className = "lixby-opt-desc";
    strictDesc.textContent = isSpanish
      ? "Necesarias para el funcionamiento del sitio."
      : "Required for the site to work.";
    strictLabel.appendChild(strictName);
    strictLabel.appendChild(strictBadge);
    strictLabel.appendChild(strictDesc);
    var strictOn = document.createElement("span");
    strictOn.className = "lixby-badge";
    strictOn.textContent = isSpanish ? "Activas" : "On";
    strict.appendChild(strictLabel);
    strict.appendChild(strictOn);
    options.appendChild(strict);

    var option = document.createElement("div");
    option.className = "lixby-option";
    var label = document.createElement("div");
    label.className = "lixby-opt-label";
    var name = document.createElement("span");
    name.className = "lixby-opt-name";
    name.textContent = T.analyticsLabel;
    var badge = document.createElement("span");
    badge.className = "lixby-badge";
    badge.textContent = isSpanish ? "Opcional" : "Optional";
    var desc = document.createElement("span");
    desc.className = "lixby-opt-desc";
    desc.textContent = isSpanish
      ? "Nos ayudan a entender c\u00F3mo usas Lixby para mejorarlo."
      : "Help us understand how you use Lixby to improve it.";
    label.appendChild(name);
    label.appendChild(badge);
    label.appendChild(desc);

    var box = document.createElement("input");
    box.type = "checkbox";
    box.className = "lixby-switch";
    box.checked = !!initialChecked;
    box.setAttribute("aria-label", T.analyticsLabel);

    option.appendChild(label);
    option.appendChild(box);
    options.appendChild(option);

    return { options: options, box: box };
  }

  /* Panel de preferencias reutilizable (banner y pie) */
  function buildSettingsPanel(initialChecked, onSave) {
    var panel = document.createElement("div");
    panel.className = "lixby-panel";

    var title = document.createElement("div");
    title.className = "lixby-panel-title";
    title.textContent = T.settingsTitle;
    panel.appendChild(title);

    var built = buildOptions(initialChecked);
    panel.appendChild(built.options);

    var save = button(T.save, true);
    save.addEventListener("click", function () {
      onSave(built.box.checked);
    });
    panel.appendChild(save);

    return {
      el: panel,
      toggle: function () {
        panel.style.display = panel.style.display === "none" ? "flex" : "none";
      }
    };
  }

  /* Enlace "Configurar cookies" en el pie de pagina:
     abre el panel mostrando la decision real guardada.
     Soporta dos layouts: columna "Legal" con ul.footer-links
     y fila plana .footer-legal-links (sin titulo ni lista). */
  function addFooterSettingsLink() {
    function makeLink() {
      var a = document.createElement("a");
      a.href = "#";
      a.setAttribute("data-lixby-cookie-settings", "");
      a.textContent = T.settings === "Configurar" ? "Configurar cookies" : "Cookie settings";
      a.addEventListener("click", function (e) {
        e.preventDefault();
        openStandaloneSettings();
      });
      return a;
    }

    var inserted = false;
    var lists = document.querySelectorAll(".footer-section ul.footer-links");
    for (var i = 0; i < lists.length; i++) {
      var section = lists[i].closest(".footer-section");
      if (!section) continue;
      var heading = section.querySelector("h3");
      if (!heading || !/legal/i.test(heading.textContent || "")) continue;
      if (lists[i].querySelector("[data-lixby-cookie-settings]")) continue;

      var li = document.createElement("li");
      li.appendChild(makeLink());
      lists[i].appendChild(li);
      inserted = true;
    }
    if (inserted) return;

    var row = document.querySelector(".footer-legal-links");
    if (row && !row.querySelector("[data-lixby-cookie-settings]")) {
      row.appendChild(makeLink());
    }
  }

  function openStandaloneSettings() {
    ensureStyles();
    if (document.getElementById("lixby-cookie-settings")) return;

    /* Fondo oscuro */
    var backdrop = document.createElement("div");
    backdrop.className = "lixby-backdrop";

    /* Contenedor centrado con scroll */
    var outer = document.createElement("div");
    outer.className = "lixby-panel-outer";

    var card = document.createElement("div");
    card.id = "lixby-cookie-settings";
    card.className = "lixby-card lixby-settings";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", T.settingsTitle);

    /* Cabecera con icono y titulo */
    var head = document.createElement("div");
    head.className = "lixby-head";

    var icon = document.createElement("span");
    icon.className = "lixby-head-icon";
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
      "</svg>";
    head.appendChild(icon);

    var headText = document.createElement("div");
    var title = document.createElement("div");
    title.className = "lixby-title";
    title.textContent = T.settingsTitle;
    var sub = document.createElement("div");
    sub.className = "lixby-sub";
    sub.textContent = isSpanish
      ? "Elige qu\u00E9 cookies permites. Puedes cambiar tu decisi\u00F3n en cualquier momento."
      : "Choose which cookies you allow. You can change your mind at any time.";
    headText.appendChild(title);
    headText.appendChild(sub);
    head.appendChild(headText);

    var close = button("\u00D7", false);
    close.className = "lixby-close";
    close.setAttribute("aria-label", isSpanish ? "Cerrar" : "Close");
    close.addEventListener("click", function () {
      backdrop.remove();
    });

    card.appendChild(head);
    card.appendChild(close);

    var built = buildOptions(readChoice() === "granted");
    card.appendChild(built.options);

    var foot = document.createElement("div");
    foot.className = "lixby-settings-foot";
    foot.appendChild(button(T.save, true));
    foot.lastChild.addEventListener("click", function () {
      var decision = built.box.checked ? "granted" : "denied";
      var changed = decision !== readChoice();
      applyDecision(decision);
      backdrop.remove();
      if (changed) window.location.reload();
    });
    card.appendChild(foot);

    outer.appendChild(card);
    backdrop.appendChild(outer);

    /* Cerrar al pulsar fuera del panel o con Escape */
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) backdrop.remove();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape" && document.getElementById("lixby-cookie-settings")) {
        backdrop.remove();
        document.removeEventListener("keydown", esc);
      }
    });

    document.body.appendChild(backdrop);
  }

  function showBanner() {
    ensureStyles();
    var bar = document.createElement("div");
    bar.className = "lixby-card";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", T.aria);

    var text = document.createElement("span");
    text.className = "lixby-text";
    text.textContent = T.msg;

    var more = document.createElement("a");
    more.href = T.link;
    more.className = "lixby-link";
    more.textContent = T.more;
    text.appendChild(document.createTextNode(" "));
    text.appendChild(more);

    var yes = button(T.accept, true);
    var no = button(T.reject, false);
    var cfg = button(T.settings, false);

    function finish(choice) {
      applyDecision(choice);
      bar.remove();
    }

    yes.addEventListener("click", function () { finish("granted"); });
    no.addEventListener("click", function () { finish("denied"); });

    var actions = document.createElement("div");
    actions.className = "lixby-actions";
    actions.appendChild(yes);
    actions.appendChild(no);
    actions.appendChild(cfg);

    var panel = buildSettingsPanel(false, function (checked) {
      finish(checked ? "granted" : "denied");
    });
    cfg.addEventListener("click", panel.toggle);

    bar.appendChild(text);
    bar.appendChild(actions);
    bar.appendChild(panel.el);

    if (document.body) {
      document.body.appendChild(bar);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        document.body.appendChild(bar);
      });
    }
  }

  function init() {
    addFooterSettingsLink();
    if (needsBanner) showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
