"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { scrubSentryEvent } = require("../security/sentry-scrub");

test("scrubs sensitive headers and deeply nested fields", () => {
  const event = {
    request: {
      headers: {
        Authorization: "Bearer abc123",
        Cookie: "session=abc123",
        Accept: "application/json",
      },
      url: "https://example.test/reset?token=abc123&next=%2Faccount#top",
    },
    extra: {
      payload: [{ profile: { email: "person@example.test", phone: "+34 600 000 000" } }],
      safe: "kept",
    },
  };

  scrubSentryEvent(event);

  assert.deepEqual(event.request.headers, { Accept: "application/json" });
  assert.equal(event.request.url, "https://example.test/reset");
  assert.deepEqual(event.extra, { payload: [{ profile: {} }], safe: "kept" });
});

test("removes request bodies, cookies, query strings, and user identifiers", () => {
  const event = {
    request: {
      data: { password: "secret" },
      cookies: { session: "secret" },
      query_string: "email=person@example.test",
      url: "/login?email=person@example.test",
    },
    user: { id: "user-123", ip_address: "192.0.2.1", segment: "premium" },
  };

  scrubSentryEvent(event);

  assert.deepEqual(event.request, { url: "/login" });
  assert.deepEqual(event.user, { segment: "premium" });
});

test("scrubs secret text and tolerates circular nested objects", () => {
  const context = { message: "Authorization: Bearer abc123 for person@example.test" };
  context.self = context;
  const event = { contexts: { custom: context } };

  assert.doesNotThrow(() => scrubSentryEvent(event));
  assert.match(event.contexts.custom.message, /Bearer \[Filtered\]/);
  assert.doesNotMatch(event.contexts.custom.message, /person@example\.test/);
  assert.equal(event.contexts.custom.self, "[Circular]");
});
