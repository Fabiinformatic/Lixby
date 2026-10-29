"use strict";

const REDACTED = "[Filtered]";

const SENSITIVE_EXACT_KEYS = new Set([
  "address",
  "cfconnectingip",
  "customername",
  "dni",
  "email",
  "firstname",
  "forwarded",
  "forwardedfor",
  "iban",
  "ipaddress",
  "lastname",
  "name",
  "nif",
  "nie",
  "phone",
  "phonenumber",
  "postalcode",
  "proxyauthorization",
  "realip",
  "remoteaddr",
  "remoteaddress",
  "setcookie",
  "ssn",
  "street",
  "username",
  "xforwardedfor",
  "xrealip",
  "zipcode",
]);

const SENSITIVE_KEY_PARTS =
  /(?:authorization|cookie|secret|password|passwd|credential|token|apikey|privatekey|signature|cardnumber|cvv|cvc|bankaccount|taxid|customeremail|customerphone|customeraddress)/i;

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key) {
  const normalized = normalizeKey(key);
  return SENSITIVE_EXACT_KEYS.has(normalized) || SENSITIVE_KEY_PARTS.test(normalized);
}

function scrubText(value) {
  return value
    .replace(/\bBearer\s+[^\s"'`]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(
      /([?&](?:email|e-mail|phone|token|access_token|id_token|api_key|key|password|code)=)[^&#\s]*/gi,
      `$1${REDACTED}`,
    );
}

function scrubNested(value, seen = new WeakSet()) {
  if (typeof value === "string") return scrubText(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = scrubNested(value[index], seen);
    }
    return value;
  }

  for (const key of Object.keys(value)) {
    if (isSensitiveKey(key)) {
      delete value[key];
    } else {
      value[key] = scrubNested(value[key], seen);
    }
  }
  return value;
}

function removeUrlQuery(value) {
  if (typeof value !== "string") return value;
  try {
    const parsed = new URL(value, "https://sentry.invalid");
    parsed.search = "";
    parsed.hash = "";
    return value.startsWith("http://") || value.startsWith("https://")
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value.replace(/[?#].*$/, "");
  }
}

function scrubSentryEvent(event) {
  if (!event || typeof event !== "object") return event;

  scrubNested(event);

  if (event.request && typeof event.request === "object") {
    // Query values and bodies can contain form data, reset links, or user input.
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (typeof event.request.url === "string") {
      event.request.url = removeUrlQuery(event.request.url);
    }
    if (event.request.headers) scrubNested(event.request.headers);
  }

  if (event.user && typeof event.user === "object") {
    delete event.user.id;
    delete event.user.ip_address;
  }

  return event;
}

module.exports = { scrubSentryEvent };
