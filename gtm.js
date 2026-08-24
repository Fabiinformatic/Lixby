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
      ".lixby-close:hover{transform:none;color:var(--text,#111827);}"
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

  /* Panel de preferencias reutilizable (banner y pie) */
  function buildSettingsPanel(initialChecked, onSave) {
    var panel = document.createElement("div");
    panel.className = "lixby-panel";

    var title = document.createElement("div");
    title.className = "lixby-panel-title";
    title.textContent = T.settingsTitle;
    panel.appendChild(title);

    var row = document.createElement("label");
    row.className = "lixby-row";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.className = "lixby-box";
    box.checked = !!initialChecked;
    row.appendChild(box);
    row.appendChild(document.createTextNode(T.analyticsLabel));
    panel.appendChild(row);

    var save = button(T.save, true);
    save.addEventListener("click", function () {
      onSave(box.checked);
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

    var card = document.createElement("div");
    card.id = "lixby-cookie-settings";
    card.className = "lixby-card lixby-col";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", T.settingsTitle);

    var close = button("\u00D7", false);
    close.className = "lixby-close";
    close.setAttribute("aria-label", isSpanish ? "Cerrar" : "Close");
    close.addEventListener("click", function () {
      card.remove();
    });

    var panel = buildSettingsPanel(readChoice() === "granted", function (checked) {
      var decision = checked ? "granted" : "denied";
      var changed = decision !== readChoice();
      applyDecision(decision);
      card.remove();
      if (changed) window.location.reload();
    });
    panel.el.style.display = "flex"; // visible directamente

    card.appendChild(close);
    card.appendChild(panel.el);
    document.body.appendChild(card);
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
