/*!
 * Lixby - Google Tag Manager + Consent Mode v2 (RGPD)
 * ---------------------------------------------------
 * Un unico archivo compartido por todas las paginas.
 *
 * Modo basico (AEPD-friendly):
 *   1. Consentimiento DENEGADO por defecto (Consent Mode v2).
 *   2. Si el usuario ya decidio (localStorage), se aplica su decision.
 *   3. GTM solo se carga tras un "Aceptar" explicito.
 *      Con "Rechazar" GTM nunca llega a cargar.
 *   4. Sin decision previa se muestra el aviso de cookies en el idioma
 *      del pais detectado (Cloudflare /cdn-cgi/trace, con respaldo en
 *      navigator.language -> navegador -> idioma de la pagina -> en).
 *      El boton "Configurar" abre un modal centrado con preferencias.
 *   5. El enlace "Configurar cookies" del pie abre el mismo modal
 *      reflejando la decision guardada; al guardar cambia y recarga.
 *   6. El banner de idioma espera a que se resuelva el consentimiento
 *      (window.lixbyConsent) para no superponerse a este aviso.
 *
 * Diseno: reutiliza las variables CSS del sitio (--primary, --line,
 * --radius-lg, --font-family...) con valores de respaldo iguales.
 */
(function () {
  "use strict";

  var GTM_ID = "GTM-KB2GQBDR";
  var STORAGE_KEY = "lixby-consent";
  var STYLE_ID = "lixby-consent-css";
  var TRACE_TIMEOUT = 2500;

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

  /* El banner solo solicita analitica: no autoriza publicidad ni personalizacion. */
  var GRANTED = {
    analytics_storage: "granted"
  };

  /* Pais ISO -> prefijo de idioma (el mismo mapa que locale-banner.js). */
  var COUNTRY_TO_LANG = {
    DE: "de", AT: "de", CH: "de",
    BG: "bg", CZ: "cs", HR: "hr", DK: "da", SK: "sk", SI: "sl",
    ES: "es", EE: "et", FI: "fi", FR: "fr", GR: "el", HU: "hu",
    GB: "en", IE: "en",
    IT: "it", LV: "lv", LT: "lt", MT: "mt",
    NL: "nl", BE: "fr", LU: "fr",
    PL: "pl", PT: "pt", RO: "ro", SE: "sv"
  };

  /* Textos del aviso y del modal de preferencias, por idioma del pais. */
  var I18N = {
    es: {
      aria: "Aviso de cookies",
      msg: "Usamos cookies de analítica para mejorar Lixby. ¿Las aceptas?",
      more: "Más info", accept: "Aceptar", reject: "Rechazar", settings: "Configurar",
      settingsTitle: "Preferencias de cookies",
      settingsSub: "Elige qué cookies permites. Puedes cambiar tu decisión en cualquier momento.",
      strictName: "Cookies estrictamente necesarias", strictBadge: "Siempre activas",
      strictDesc: "Necesarias para el funcionamiento del sitio.", on: "Activas",
      analyticsLabel: "Cookies analíticas", optionalBadge: "Opcional",
      analyticsDesc: "Nos ayudan a entender cómo usas Lixby para mejorarlo.", off: "Desactivadas",
      save: "Guardar preferencias", acceptAll: "Aceptar todas", rejectAll: "Rechazar todas",
      close: "Cerrar", footerSettings: "Configurar cookies"
    },
    en: {
      aria: "Cookie notice",
      msg: "We use analytics cookies to improve Lixby. Do you accept them?",
      more: "More info", accept: "Accept", reject: "Reject", settings: "Configure",
      settingsTitle: "Cookie preferences",
      settingsSub: "Choose which cookies you allow. You can change your mind at any time.",
      strictName: "Strictly necessary cookies", strictBadge: "Always on",
      strictDesc: "Required for the site to work.", on: "On",
      analyticsLabel: "Analytics cookies", optionalBadge: "Optional",
      analyticsDesc: "Help us understand how you use Lixby to improve it.", off: "Off",
      save: "Save preferences", acceptAll: "Accept all", rejectAll: "Reject all",
      close: "Close", footerSettings: "Cookie settings"
    },
    de: {
      aria: "Cookie-Hinweis",
      msg: "Wir verwenden Analytik-Cookies, um Lixby zu verbessern. Möchtest du sie akzeptieren?",
      more: "Mehr Infos", accept: "Akzeptieren", reject: "Ablehnen", settings: "Einstellungen",
      settingsTitle: "Cookie-Einstellungen",
      settingsSub: "Wähle, welche Cookies du erlaubst. Du kannst deine Entscheidung jederzeit ändern.",
      strictName: "Streng notwendige Cookies", strictBadge: "Immer aktiv",
      strictDesc: "Erforderlich für den Betrieb der Website.", on: "An",
      analyticsLabel: "Analytik-Cookies", optionalBadge: "Optional",
      analyticsDesc: "Helfen uns zu verstehen, wie du Lixby nutzt, um es zu verbessern.", off: "Aus",
      save: "Einstellungen speichern", acceptAll: "Alle akzeptieren", rejectAll: "Alle ablehnen",
      close: "Schließen", footerSettings: "Cookie-Einstellungen"
    },
    fr: {
      aria: "Avis sur les cookies",
      msg: "Nous utilisons des cookies d’analyse pour améliorer Lixby. Les acceptez-vous ?",
      more: "Plus d’infos", accept: "Accepter", reject: "Refuser", settings: "Configurer",
      settingsTitle: "Préférences de cookies",
      settingsSub: "Choisissez les cookies que vous autorisez. Vous pouvez modifier votre choix à tout moment.",
      strictName: "Cookies strictement nécessaires", strictBadge: "Toujours actifs",
      strictDesc: "Nécessaires au fonctionnement du site.", on: "Activés",
      analyticsLabel: "Cookies d’analyse", optionalBadge: "Facultatif",
      analyticsDesc: "Nous aident à comprendre comment vous utilisez Lixby pour l’améliorer.", off: "Désactivés",
      save: "Enregistrer les préférences", acceptAll: "Tout accepter", rejectAll: "Tout refuser",
      close: "Fermer", footerSettings: "Paramètres des cookies"
    },
    it: {
      aria: "Avviso sui cookie",
      msg: "Usiamo cookie di analisi per migliorare Lixby. Vuoi accettarli?",
      more: "Maggiori info", accept: "Accetta", reject: "Rifiuta", settings: "Configura",
      settingsTitle: "Preferenze sui cookie",
      settingsSub: "Scegli quali cookie consentire. Puoi cambiare decisione in qualsiasi momento.",
      strictName: "Cookie strettamente necessari", strictBadge: "Sempre attivi",
      strictDesc: "Necessari al funzionamento del sito.", on: "Attivi",
      analyticsLabel: "Cookie di analisi", optionalBadge: "Facoltativi",
      analyticsDesc: "Ci aiutano a capire come usi Lixby per migliorarlo.", off: "Disattivati",
      save: "Salva preferenze", acceptAll: "Accetta tutti", rejectAll: "Rifiuta tutti",
      close: "Chiudi", footerSettings: "Impostazioni cookie"
    },
    pt: {
      aria: "Aviso de cookies",
      msg: "Usamos cookies de análise para melhorar a Lixby. Queres aceitá-los?",
      more: "Mais info", accept: "Aceitar", reject: "Rejeitar", settings: "Configurar",
      settingsTitle: "Preferências de cookies",
      settingsSub: "Escolhe quais os cookies que permites. Podes alterar a tua decisão a qualquer momento.",
      strictName: "Cookies estritamente necessários", strictBadge: "Sempre ativos",
      strictDesc: "Necessários para o funcionamento do site.", on: "Ativos",
      analyticsLabel: "Cookies de análise", optionalBadge: "Opcional",
      analyticsDesc: "Ajudam-nos a perceber como usas a Lixby para a melhorar.", off: "Desativados",
      save: "Guardar preferências", acceptAll: "Aceitar todos", rejectAll: "Rejeitar todos",
      close: "Fechar", footerSettings: "Configurar cookies"
    },
    nl: {
      aria: "Cookiemelding",
      msg: "We gebruiken analytische cookies om Lixby te verbeteren. Wil je ze accepteren?",
      more: "Meer info", accept: "Accepteren", reject: "Weigeren", settings: "Instellingen",
      settingsTitle: "Cookievoorkeuren",
      settingsSub: "Kies welke cookies je toestaat. Je kunt je keuze op elk moment wijzigen.",
      strictName: "Strikt noodzakelijke cookies", strictBadge: "Altijd aan",
      strictDesc: "Nodig om de website te laten werken.", on: "Aan",
      analyticsLabel: "Analytische cookies", optionalBadge: "Optioneel",
      analyticsDesc: "Helpen ons te begrijpen hoe je Lixby gebruikt om het te verbeteren.", off: "Uit",
      save: "Voorkeuren opslaan", acceptAll: "Alles accepteren", rejectAll: "Alles weigeren",
      close: "Sluiten", footerSettings: "Cookie-instellingen"
    },
    pl: {
      aria: "Powiadomienie o plikach cookie",
      msg: "Używamy plików cookie analitycznych, aby ulepszyć Lixby. Czy akceptujesz je?",
      more: "Więcej informacji", accept: "Akceptuję", reject: "Odrzucam", settings: "Konfiguruj",
      settingsTitle: "Preferencje plików cookie",
      settingsSub: "Wybierz, które pliki cookie akceptujesz. Możesz zmienić decyzję w dowolnym momencie.",
      strictName: "Bezwzględnie niezbędne pliki cookie", strictBadge: "Zawsze włączone",
      strictDesc: "Niezbędne do działania strony.", on: "Włączone",
      analyticsLabel: "Pliki cookie analityczne", optionalBadge: "Opcjonalne",
      analyticsDesc: "Pomagają nam zrozumieć, jak korzystasz z Lixby, aby ją ulepszyć.", off: "Wyłączone",
      save: "Zapisz preferencje", acceptAll: "Akceptuj wszystkie", rejectAll: "Odrzuć wszystkie",
      close: "Zamknij", footerSettings: "Ustawienia plików cookie"
    },
    sv: {
      aria: "Cookie-meddelande",
      msg: "Vi använder analyscookies för att förbättra Lixby. Vill du acceptera dem?",
      more: "Mer info", accept: "Acceptera", reject: "Avvisa", settings: "Konfigurera",
      settingsTitle: "Cookie-inställningar",
      settingsSub: "Välj vilka cookies du tillåter. Du kan ändra dig när som helst.",
      strictName: "Nödvändiga cookies", strictBadge: "Alltid på",
      strictDesc: "Krävs för att webbplatsen ska fungera.", on: "På",
      analyticsLabel: "Analyscookies", optionalBadge: "Valfria",
      analyticsDesc: "Hjälper oss att förstå hur du använder Lixby för att förbättra det.", off: "Av",
      save: "Spara inställningar", acceptAll: "Acceptera alla", rejectAll: "Avvisa alla",
      close: "Stäng", footerSettings: "Cookieinställningar"
    },
    da: {
      aria: "Cookie-besked",
      msg: "Vi bruger analysecookies for at forbedre Lixby. Vil du acceptere dem?",
      more: "Mere info", accept: "Accepter", reject: "Afvis", settings: "Konfigurer",
      settingsTitle: "Cookie-præferencer",
      settingsSub: "Vælg, hvilke cookies du tillader. Du kan ændre din beslutning når som helst.",
      strictName: "Strengt nødvendige cookies", strictBadge: "Altid på",
      strictDesc: "Nødvendige for at websitet fungerer.", on: "Til",
      analyticsLabel: "Analysecookies", optionalBadge: "Valgfri",
      analyticsDesc: "Hjælper os med at forstå, hvordan du bruger Lixby, så vi kan forbedre det.", off: "Fra",
      save: "Gem præferencer", acceptAll: "Accepter alle", rejectAll: "Afvis alle",
      close: "Luk", footerSettings: "Cookieindstillinger"
    },
    fi: {
      aria: "Evästeilmoitus",
      msg: "Käytämme analytiikkaevästeitä Lixbyn parantamiseen. Haluatko hyväksyä ne?",
      more: "Lisätietoja", accept: "Hyväksy", reject: "Hylkää", settings: "Määritä",
      settingsTitle: "Evästeasetukset",
      settingsSub: "Valitse, mitä evästeitä sallit. Voit muuttaa valintaa milloin tahansa.",
      strictName: "Välttämättömät evästeet", strictBadge: "Aina käytössä",
      strictDesc: "Tarvitaan sivuston toimintaan.", on: "Käytössä",
      analyticsLabel: "Analytiikkaevästeet", optionalBadge: "Valinnainen",
      analyticsDesc: "Auttavat meitä ymmärtämään, miten käytät Lixbyä sen parantamiseksi.", off: "Ei käytössä",
      save: "Tallenna asetukset", acceptAll: "Hyväksy kaikki", rejectAll: "Hylkää kaikki",
      close: "Sulje", footerSettings: "Evästeasetukset"
    },
    el: {
      aria: "Ειδοποίηση cookies",
      msg: "Χρησιμοποιούμε cookies ανάλυσης για να βελτιώσουμε το Lixby. Τα αποδέχεστε;",
      more: "Περισσότερες πληροφορίες", accept: "Αποδοχή", reject: "Απόρριψη", settings: "Ρύθμιση",
      settingsTitle: "Προτιμήσεις cookies",
      settingsSub: "Επιλέξτε ποια cookies επιτρέπετε. Μπορείτε να αλλάξετε την απόφασή σας ανά πάσα στιγμή.",
      strictName: "Απολύτως απαραίτητα cookies", strictBadge: "Πάντα ενεργά",
      strictDesc: "Απαιτούνται για τη λειτουργία του ιστότοπου.", on: "Ενεργά",
      analyticsLabel: "Cookies ανάλυσης", optionalBadge: "Προαιρετικά",
      analyticsDesc: "Μας βοηθούν να κατανοήσουμε πώς χρησιμοποιείτε το Lixby για να το βελτιώσουμε.", off: "Ανενεργά",
      save: "Αποθήκευση προτιμήσεων", acceptAll: "Αποδοχή όλων", rejectAll: "Απόρριψη όλων",
      close: "Κλείσιμο", footerSettings: "Ρυθμίσεις cookies"
    },
    hu: {
      aria: "Cookie-értesítés",
      msg: "Analitikai cookie-kat használunk a Lixby fejlesztéséhez. Elfogadod őket?",
      more: "Több információ", accept: "Elfogadom", reject: "Elutasítom", settings: "Beállítás",
      settingsTitle: "Cookie-beállítások",
      settingsSub: "Válaszd ki, mely cookie-kat engedélyezed. Döntésed bármikor módosítható.",
      strictName: "Szigorúan szükséges cookie-k", strictBadge: "Mindig bekapcsolva",
      strictDesc: "A weboldal működéséhez szükségesek.", on: "Bekapcsolva",
      analyticsLabel: "Analitikai cookie-k", optionalBadge: "Opcionális",
      analyticsDesc: "Segítenek megérteni, hogyan használod a Lixbyt, hogy fejleszthessük.", off: "Kikapcsolva",
      save: "Beállítások mentése", acceptAll: "Összes elfogadása", rejectAll: "Összes elutasítása",
      close: "Bezárás", footerSettings: "Cookie-beállítások"
    },
    cs: {
      aria: "Oznámení o cookies",
      msg: "Používáme analytické cookies ke zlepšení Lixby. Souhlasíte s nimi?",
      more: "Více informací", accept: "Přijmout", reject: "Odmítnout", settings: "Nastavit",
      settingsTitle: "Nastavení cookies",
      settingsSub: "Vyberte, které cookies povolíte. Rozhodnutí můžete kdykoliv změnit.",
      strictName: "Nezbytně nutné cookies", strictBadge: "Vždy zapnuto",
      strictDesc: "Potřebné pro fungování webu.", on: "Zapnuto",
      analyticsLabel: "Analytické cookies", optionalBadge: "Volitelné",
      analyticsDesc: "Pomáhají nám pochopit, jak Lixby používáte, a vylepšit ho.", off: "Vypnuto",
      save: "Uložit nastavení", acceptAll: "Přijmout vše", rejectAll: "Odmítnout vše",
      close: "Zavřít", footerSettings: "Nastavení cookies"
    },
    sk: {
      aria: "Oznámenie o cookies",
      msg: "Používame analytické cookies na zlepšenie Lixby. Súhlasíte s nimi?",
      more: "Viac informácií", accept: "Prijať", reject: "Odmietnuť", settings: "Nastaviť",
      settingsTitle: "Nastavenia cookies",
      settingsSub: "Vyberte, ktoré cookies povolíte. Rozhodnutie môžete kedykoľvek zmeniť.",
      strictName: "Nevyhnutne potrebné cookies", strictBadge: "Vždy zapnuté",
      strictDesc: "Potrebné na fungovanie webu.", on: "Zapnuté",
      analyticsLabel: "Analytické cookies", optionalBadge: "Voliteľné",
      analyticsDesc: "Pomáhajú nám pochopiť, ako používate Lixby, a vylepšiť ho.", off: "Vypnuté",
      save: "Uložiť nastavenia", acceptAll: "Prijať všetky", rejectAll: "Odmietnuť všetky",
      close: "Zavrieť", footerSettings: "Nastavenia cookies"
    },
    sl: {
      aria: "Obvestilo o piškotkih",
      msg: "Za izboljšanje Lixby uporabljamo analitične piškotke. Jih sprejemate?",
      more: "Več informacij", accept: "Sprejmi", reject: "Zavrni", settings: "Nastavi",
      settingsTitle: "Nastavitve piškotkov",
      settingsSub: "Izberite, katere piškotke dovolite. Odločitev lahko kadarkoli spremenite.",
      strictName: "Strogo potrebni piškotki", strictBadge: "Vedno vklopljeni",
      strictDesc: "Potrebni za delovanje spletnega mesta.", on: "Vklopljeni",
      analyticsLabel: "Analitični piškotki", optionalBadge: "Izbirni",
      analyticsDesc: "Pomagajo nam razumeti, kako uporabljate Lixby, da ga izboljšamo.", off: "Izklopljeni",
      save: "Shrani nastavitve", acceptAll: "Sprejmi vse", rejectAll: "Zavrni vse",
      close: "Zapri", footerSettings: "Nastavitve piškotkov"
    },
    hr: {
      aria: "Obavijest o kolačićima",
      msg: "Koristimo analitičke kolačiće kako bismo poboljšali Lixby. Želite li ih prihvatiti?",
      more: "Više informacija", accept: "Prihvati", reject: "Odbij", settings: "Postavi",
      settingsTitle: "Postavke kolačića",
      settingsSub: "Odaberite koje kolačiće dopuštate. Odluku možete promijeniti u bilo kojem trenutku.",
      strictName: "Strogo nužni kolačići", strictBadge: "Uvijek uključeni",
      strictDesc: "Potrebni su za rad web stranice.", on: "Uključeni",
      analyticsLabel: "Analitički kolačići", optionalBadge: "Neobavezni",
      analyticsDesc: "Pomažu nam razumjeti kako koristite Lixby kako bismo ga poboljšali.", off: "Isključeni",
      save: "Spremi postavke", acceptAll: "Prihvati sve", rejectAll: "Odbij sve",
      close: "Zatvori", footerSettings: "Postavke kolačića"
    },
    ro: {
      aria: "Notificare privind cookie-urile",
      msg: "Folosim cookie-uri analitice pentru a îmbunătăți Lixby. Le accepți?",
      more: "Mai multe informații", accept: "Accept", reject: "Refuz", settings: "Configurează",
      settingsTitle: "Preferințe cookie",
      settingsSub: "Alege ce cookie-uri permiți. Îți poți schimba decizia în orice moment.",
      strictName: "Cookie-uri strict necesare", strictBadge: "Întotdeauna active",
      strictDesc: "Necesare pentru funcționarea site-ului.", on: "Active",
      analyticsLabel: "Cookie-uri analitice", optionalBadge: "Opționale",
      analyticsDesc: "Ne ajută să înțelegem cum folosești Lixby ca să îl îmbunătățim.", off: "Inactive",
      save: "Salvează preferințele", acceptAll: "Acceptă tot", rejectAll: "Refuză tot",
      close: "Închide", footerSettings: "Setări cookie"
    },
    bg: {
      aria: "Известие за бисквитки",
      msg: "Използваме аналитични бисквитки, за да подобрим Lixby. Приемате ли ги?",
      more: "Повече информация", accept: "Приемам", reject: "Отхвърлям", settings: "Настройки",
      settingsTitle: "Предпочитания за бисквитки",
      settingsSub: "Изберете кои бисквитки разрешавате. Можете да промените решението си по всяко време.",
      strictName: "Строго необходими бисквитки", strictBadge: "Винаги включени",
      strictDesc: "Необходими за работата на сайта.", on: "Включени",
      analyticsLabel: "Аналитични бисквитки", optionalBadge: "По избор",
      analyticsDesc: "Помагат ни да разберем как използвате Lixby, за да го подобрим.", off: "Изключени",
      save: "Запази предпочитанията", acceptAll: "Приеми всички", rejectAll: "Отхвърли всички",
      close: "Затвори", footerSettings: "Настройки на бисквитките"
    },
    et: {
      aria: "Küpsiste teade",
      msg: "Kasutame Lixby parendamiseks analüütikaküpsiseid. Kas nõustud nendega?",
      more: "Lisateave", accept: "Nõustun", reject: "Keeldu", settings: "Seadista",
      settingsTitle: "Küpsiste eelistused",
      settingsSub: "Vali, milliseid küpsiseid lubad. Otsust saad igal ajal muuta.",
      strictName: "Hädavajalikud küpsised", strictBadge: "Alati sisse lülitatud",
      strictDesc: "Vajalikud veebilehe toimimiseks.", on: "Sisse lülitatud",
      analyticsLabel: "Analüütikaküpsised", optionalBadge: "Valikuline",
      analyticsDesc: "Aitavad meil mõista, kuidas sa Lixbyt kasutad, et seda parendada.", off: "Välja lülitatud",
      save: "Salvesta eelistused", acceptAll: "Nõustu kõikidega", rejectAll: "Keeldu kõikidest",
      close: "Sulge", footerSettings: "Küpsiste seaded"
    },
    lv: {
      aria: "Sīkdatņu paziņojums",
      msg: "Mēs izmantojam analītiskās sīkdatnes, lai uzlabotu Lixby. Vai tās pieņemat?",
      more: "Vairāk informācijas", accept: "Pieņemt", reject: "Noraidīt", settings: "Konfigurēt",
      settingsTitle: "Sīkdatņu preferences",
      settingsSub: "Izvēlies, kuras sīkdatnes atļaut. Lēmumu var mainīt jebkurā laikā.",
      strictName: "Stingri nepieciešamās sīkdatnes", strictBadge: "Vienmēr ieslēgtas",
      strictDesc: "Nepieciešamas vietnes darbībai.", on: "Ieslēgtas",
      analyticsLabel: "Analītiskās sīkdatnes", optionalBadge: "Neobligātas",
      analyticsDesc: "Palīdz mums saprast, kā tu lieto Lixby, lai to uzlabotu.", off: "Izslēgtas",
      save: "Saglabāt preferences", acceptAll: "Pieņemt visas", rejectAll: "Noraidīt visas",
      close: "Aizvērt", footerSettings: "Sīkdatņu iestatījumi"
    },
    lt: {
      aria: "Slapukų pranešimas",
      msg: "Analitinius slapukus naudojame Lixby tobulinimui. Ar juos priimate?",
      more: "Daugiau informacijos", accept: "Priimti", reject: "Atmesti", settings: "Nustatyti",
      settingsTitle: "Slapukų nuostatos",
      settingsSub: "Pasirinkite, kuriuos slapukus leidžiate. Sprendimą galite pakeisti bet kada.",
      strictName: "Būtiniausi slapukai", strictBadge: "Visada įjungti",
      strictDesc: "Būtini svetainės veikimui.", on: "Įjungti",
      analyticsLabel: "Analitiniai slapukai", optionalBadge: "Nebūtini",
      analyticsDesc: "Padeda mums suprasti, kaip naudojate Lixby, kad jį patobulintume.", off: "Išjungti",
      save: "Išsaugoti nuostatas", acceptAll: "Priimti visus", rejectAll: "Atmesti visus",
      close: "Uždaryti", footerSettings: "Slapukų nustatymai"
    },
    ga: {
      aria: "Fógra faoi fhianáin",
      msg: "Úsáidimid fianáin anailíse chun Lixby a fheabhsú. An nglacann tú leo?",
      more: "Tuilleadh eolais", accept: "Glac", reject: "Diúltaigh", settings: "Cumraigh",
      settingsTitle: "Roghanna fianán",
      settingsSub: "Roghnaigh na fianáin a cheadaíonn tú. Is féidir do chinneadh a athrú am ar bith.",
      strictName: "Fianáin riachtanacha", strictBadge: "Ar i gcónaí",
      strictDesc: "Riachtanach chun an suíomh a oibriú.", on: "Ar",
      analyticsLabel: "Fianáin anailíse", optionalBadge: "Roghnach",
      analyticsDesc: "Cabhraíonn siad linn a thuiscint conas a úsáideann tú Lixby chun é a fheabhsú.", off: "As",
      save: "Sábháil roghanna", acceptAll: "Glac le gach ceann", rejectAll: "Diúltaigh do gach ceann",
      close: "Dún", footerSettings: "Socruithe fianán"
    },
    mt: {
      aria: "Avviż dwar il-cookies",
      msg: "Nużaw cookies analitiċi biex intejbu Lixby. Taċċettahom?",
      more: "Aktar informazzjoni", accept: "Aċċetta", reject: "Irrifjuta", settings: "Ikkonfigura",
      settingsTitle: "Preferenzi tal-cookies",
      settingsSub: "Agħżel liema cookies tippermetti. Tista' tbiddel id-deċiżjoni tiegħek fi kwalunkwe ħin.",
      strictName: "Cookies strettament meħtieġa", strictBadge: "Dejjem mixgħula",
      strictDesc: "Meħtieġa biex is-sit jaħdem.", on: "Mixgħula",
      analyticsLabel: "Cookies analitiċi", optionalBadge: "Mhux obbligatorji",
      analyticsDesc: "Jgħinuna nifhmu kif tuża Lixby biex intejbuha.", off: "Mitfija",
      save: "Issejvja l-preferenzi", acceptAll: "Aċċetta kollha", rejectAll: "Irrifjuta kollha",
      close: "Agħlaq", footerSettings: "Settings tal-cookies"
    }
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
  if (stored === "granted" || stored === "denied") {
    applyDecision(stored);
  } else {
    needsBanner = true;
  }

  /* Senal para que locale-banner.js no se superponga al aviso de cookies. */
  var consentResolved = !needsBanner;
  var consentWaiters = [];
  window.lixbyConsent = {
    isPending: function () { return needsBanner && !consentResolved; },
    onResolved: function (cb) {
      if (typeof cb !== "function") return;
      if (!needsBanner || consentResolved) { cb(); return; }
      consentWaiters.push(cb);
    }
  };
  function signalConsentResolved() {
    if (consentResolved) return;
    consentResolved = true;
    var waiters = consentWaiters.slice();
    consentWaiters.length = 0;
    for (var i = 0; i < waiters.length; i++) {
      try { waiters[i](); } catch (e) { /* noop */ }
    }
    try {
      document.dispatchEvent(new Event("lixby:consent-resolved"));
    } catch (e) { /* noop */ }
  }

  /* 3. Idioma del aviso: pais -> region del navegador -> idiomas del
        navegador -> idioma de la pagina -> en (una sola lectura de trace). */
  function parseTrace(text) {
    var m = /(^|\n)loc=([A-Za-z]{2})(\r?\n|$)/.exec(String(text || ""));
    return m ? m[2].toUpperCase() : null;
  }

  function getCountry() {
    if (window.__lixbyCountryPromise) return window.__lixbyCountryPromise;
    var promise;
    if (window.__lixbyCountry) {
      promise = Promise.resolve(window.__lixbyCountry);
    } else {
      promise = new Promise(function (resolve) {
        function done(cc) {
          window.__lixbyCountry = cc || null;
          resolve(window.__lixbyCountry);
        }
        if (typeof fetch !== "function") { done(null); return; }
        var opts = {};
        var timer = null;
        if (typeof AbortController !== "undefined") {
          var ctrl = new AbortController();
          opts.signal = ctrl.signal;
          timer = setTimeout(function () { ctrl.abort(); }, TRACE_TIMEOUT);
        }
        fetch("/cdn-cgi/trace", opts)
          .then(function (r) { return r.ok ? r.text() : ""; })
          .then(function (t) { if (timer !== null) clearTimeout(timer); done(parseTrace(t)); })
          .catch(function () { if (timer !== null) clearTimeout(timer); done(null); });
      });
    }
    window.__lixbyCountryPromise = promise;
    return promise;
  }

  function resolveLang(cb) {
    getCountry().then(function (cc) {
      var lang = (cc && COUNTRY_TO_LANG[cc]) || null;

      if (!lang && typeof navigator !== "undefined") {
        var tag = String(navigator.language || "").toLowerCase().replace(/_/g, "-");
        var region = tag.split("-").pop();
        if (region && COUNTRY_TO_LANG[region]) lang = COUNTRY_TO_LANG[region];
      }

      if (!lang && typeof navigator !== "undefined") {
        var list = (navigator.languages && navigator.languages.length)
          ? navigator.languages : [navigator.language];
        for (var i = 0; i < list.length; i++) {
          var base = String(list[i] || "").toLowerCase().replace(/_/g, "-").split("-")[0];
          if (I18N[base]) { lang = base; break; }
        }
      }

      if (!lang) {
        var page = String(document.documentElement.lang || "").toLowerCase().split("-")[0];
        if (I18N[page]) lang = page;
      }

      var code = I18N[lang] ? lang : "en";
      var texts = {};
      for (var key in I18N[code]) {
        if (Object.prototype.hasOwnProperty.call(I18N[code], key)) texts[key] = I18N[code][key];
      }
      texts.link = "/" + code + "/pages/legal/cookies/";
      cb(texts);
    });
  }

  var T = null;

  /* 4. Estilos propios, alineados con el design system de la web */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ".lixby-card{position:fixed;left:16px;right:16px;bottom:16px;margin:0 auto;",
      "max-width:640px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;",
      "background:var(--surface,#ffffff);color:var(--text,#111827);",
      "font-family:var(--font-family,\"Inter\"),\"Manrope\",system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;",
      "font-size:14px;line-height:1.45;padding:18px 22px;",
      "border:1px solid var(--line,#dbe3ef);border-radius:var(--radius-lg,18px);",
      "box-shadow:var(--shadow-lg,0 20px 50px rgba(16,24,40,.12));z-index:2147483646;}",
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
      ".lixby-close{position:absolute;top:10px;right:14px;border:none;background:transparent;",
      "font-size:20px;line-height:1;color:var(--muted,#5f6b7a);padding:4px 8px;cursor:pointer;}",
      ".lixby-close:hover{transform:none;color:var(--text,#111827);}",
      ".lixby-backdrop{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;",
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
      ".lixby-settings .lixby-option .lixby-state{align-self:center;white-space:nowrap;}",
      ".lixby-settings .lixby-option.lixby-locked{opacity:.95;}",
      ".lixby-settings .lixby-switch{-webkit-appearance:none;appearance:none;position:relative;width:46px;height:26px;",
      "flex-shrink:0;margin:0;cursor:pointer;border-radius:999px;outline:none;",
      "background:var(--line,#dbe3ef);transition:background .25s ease;}",
      ".lixby-settings .lixby-switch::after{content:'';position:absolute;top:2px;left:2px;width:22px;height:22px;",
      "border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .25s ease;}",
      ".lixby-settings .lixby-switch:checked{background:linear-gradient(120deg,var(--primary,#0f3dff),var(--primary-2,#16a7ff));}",
      ".lixby-settings .lixby-switch:checked::after{transform:translateX(20px);}",
      ".lixby-settings .lixby-switch:focus-visible{box-shadow:0 0 0 3px rgba(15,61,255,.25);}",
      ".lixby-settings .lixby-settings-foot{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;}",
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
    strictName.textContent = T.strictName;
    var strictBadge = document.createElement("span");
    strictBadge.className = "lixby-badge";
    strictBadge.textContent = T.strictBadge;
    var strictDesc = document.createElement("span");
    strictDesc.className = "lixby-opt-desc";
    strictDesc.textContent = T.strictDesc;
    strictLabel.appendChild(strictName);
    strictLabel.appendChild(strictBadge);
    strictLabel.appendChild(strictDesc);
    var strictOn = document.createElement("span");
    strictOn.className = "lixby-badge lixby-state";
    strictOn.textContent = T.on;
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
    badge.textContent = T.optionalBadge;
    var desc = document.createElement("span");
    desc.className = "lixby-opt-desc";
    desc.textContent = T.analyticsDesc;
    label.appendChild(name);
    label.appendChild(badge);
    label.appendChild(desc);

    var box = document.createElement("input");
    box.type = "checkbox";
    box.className = "lixby-switch";
    box.checked = !!initialChecked;
    box.setAttribute("aria-label", T.analyticsLabel);

    var state = document.createElement("span");
    state.className = "lixby-badge lixby-state";
    state.textContent = box.checked ? T.on : T.off;
    box.addEventListener("change", function () {
      state.textContent = box.checked ? T.on : T.off;
    });

    option.appendChild(label);
    option.appendChild(state);
    option.appendChild(box);
    options.appendChild(option);

    return { options: options, box: box };
  }

  /* Enlace "Configurar cookies" en el pie de pagina:
     abre el modal centrado mostrando la decision real guardada. */
  function addFooterSettingsLink() {
    function makeLink() {
      var a = document.createElement("a");
      a.href = "#";
      a.setAttribute("data-lixby-cookie-settings", "");
      a.textContent = T.footerSettings;
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

  /* Modal centrado de preferencias (banner y pie de pagina). */
  function openStandaloneSettings() {
    ensureStyles();
    if (document.getElementById("lixby-cookie-settings")) return;

    var backdrop = document.createElement("div");
    backdrop.className = "lixby-backdrop";

    var outer = document.createElement("div");
    outer.className = "lixby-panel-outer";

    var card = document.createElement("div");
    card.id = "lixby-cookie-settings";
    card.className = "lixby-card lixby-settings";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-label", T.settingsTitle);

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
    sub.textContent = T.settingsSub;
    headText.appendChild(title);
    headText.appendChild(sub);
    head.appendChild(headText);

    var close = button("\u00D7", false);
    close.className = "lixby-close";
    close.setAttribute("aria-label", T.close);
    close.addEventListener("click", function () { backdrop.remove(); });

    card.appendChild(head);
    card.appendChild(close);

    var built = buildOptions(readChoice() === "granted");
    card.appendChild(built.options);

    function decide(decision) {
      var changed = decision !== readChoice();
      applyDecision(decision);
      var banner = document.getElementById("lixby-cookie-banner");
      if (banner) banner.remove();
      backdrop.remove();
      signalConsentResolved();
      if (changed) window.location.reload();
    }

    var foot = document.createElement("div");
    foot.className = "lixby-settings-foot";
    var rejectAll = button(T.rejectAll, false);
    var acceptAll = button(T.acceptAll, false);
    var save = button(T.save, true);
    rejectAll.addEventListener("click", function () { decide("denied"); });
    acceptAll.addEventListener("click", function () { decide("granted"); });
    save.addEventListener("click", function () {
      decide(built.box.checked ? "granted" : "denied");
    });
    foot.appendChild(rejectAll);
    foot.appendChild(acceptAll);
    foot.appendChild(save);
    card.appendChild(foot);

    outer.appendChild(card);
    backdrop.appendChild(outer);

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
    bar.id = "lixby-cookie-banner";
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
      signalConsentResolved();
    }

    yes.addEventListener("click", function () { finish("granted"); });
    no.addEventListener("click", function () { finish("denied"); });
    cfg.addEventListener("click", openStandaloneSettings);

    var actions = document.createElement("div");
    actions.className = "lixby-actions";
    actions.appendChild(yes);
    actions.appendChild(no);
    actions.appendChild(cfg);

    bar.appendChild(text);
    bar.appendChild(actions);

    if (document.body) {
      document.body.appendChild(bar);
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        document.body.appendChild(bar);
      });
    }
  }

  function init() {
    resolveLang(function (texts) {
      T = texts;
      addFooterSettingsLink();
      if (needsBanner) showBanner();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
