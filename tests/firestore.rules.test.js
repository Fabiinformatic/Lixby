const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  after,
  before,
  beforeEach,
  test
} = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require("@firebase/rules-unit-testing");
const {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} = require("firebase/firestore");

const projectId = "demo-lixby";
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv?.cleanup();
});

function profileData(overrides = {}) {
  return {
    address: "1 Test Street",
    adsOptIn: false,
    birthDate: "1990-01-01",
    city: "Madrid",
    country: "Spain",
    countryContact: "Spain",
    email: "user@example.test",
    firstName: "Ada",
    language: "es-ES",
    lastName: "Lovelace",
    phone: "+34123456789",
    photoUrl: "https://example.test/photo.png",
    postalCode: "28001",
    prefAds: false,
    prefNews: true,
    prefOffers: false,
    prefSupport: true,
    prefUpdates: true,
    timezone: "Europe/Madrid",
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

function billingData(overrides = {}) {
  return {
    address: "1 Test Street",
    city: "Madrid",
    country: "Spain",
    name: "Ada Lovelace",
    postalCode: "28001",
    updatedAt: serverTimestamp(),
    ...overrides
  };
}

async function seedDocuments(callback) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await callback(db);
  });
}

test("profile owner can create, read, update and delete the allowlisted document", async () => {
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "password" }
  }).firestore();
  const profile = doc(db, "users/alice/account/profile");

  await assertSucceeds(setDoc(profile, profileData()));
  const savedProfile = await assertSucceeds(getDoc(profile));
  for (const preference of ["prefNews", "prefUpdates", "prefSupport"]) {
    assert.equal(savedProfile.get(preference), profileData()[preference]);
  }
  await assertSucceeds(updateDoc(profile, {
    prefNews: false,
    prefUpdates: false,
    prefSupport: false,
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(deleteDoc(profile));
});

test("another user and unauthenticated clients cannot access a profile", async () => {
  await seedDocuments((db) =>
    setDoc(doc(db, "users/alice/account/profile"), {
      firstName: "Ada",
      updatedAt: new Date()
    })
  );
  const otherUser = testEnv.authenticatedContext("bob").firestore();
  const unauthenticated = testEnv.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(otherUser, "users/alice/account/profile")));
  await assertFails(updateDoc(doc(otherUser, "users/alice/account/profile"), {
    firstName: "Mallory"
  }));
  await assertFails(getDoc(doc(unauthenticated, "users/alice/account/profile")));
  await assertFails(setDoc(
    doc(otherUser, "users/alice/account/billing"),
    billingData()
  ));
});

test("profile rejects unknown fields, invalid types, oversized strings and non-HTTPS photo URLs", async () => {
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "password" }
  }).firestore();
  const profile = doc(db, "users/alice/account/profile");

  await assertFails(setDoc(profile, profileData({ isAdmin: true })));
  await assertFails(setDoc(profile, profileData({ prefNews: "yes" })));
  await assertFails(setDoc(profile, profileData({ firstName: "A".repeat(101) })));
  await assertFails(setDoc(profile, profileData({ photoUrl: "http://example.test/photo.png" })));
  await assertFails(setDoc(profile, profileData({ updatedAt: "not-a-timestamp" })));
});

test("profile photo URL may be empty", async () => {
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "password" }
  }).firestore();

  await assertSucceeds(setDoc(
    doc(db, "users/alice/account/profile"),
    profileData({ photoUrl: "" })
  ));
});

test("billing owner can write only the six allowed fields", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  const billing = doc(db, "users/alice/account/billing");

  await assertSucceeds(setDoc(billing, billingData()));
  await assertSucceeds(getDoc(billing));
  await assertSucceeds(updateDoc(billing, {
    city: "Barcelona",
    updatedAt: serverTimestamp()
  }));
  await assertSucceeds(deleteDoc(billing));
  await assertFails(setDoc(billing, billingData({ stripeCustomerId: "cus_test" })));
  await assertFails(setDoc(billing, billingData({ address: "A".repeat(201) })));
});

test("other account document IDs remain closed", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  const preferences = doc(db, "users/alice/account/preferences");

  await assertFails(setDoc(preferences, { theme: "dark" }));
  await assertFails(getDoc(preferences));
});

test("users cannot create or change server-managed account number fields", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  const user = doc(db, "users/alice");

  await assertFails(setDoc(user, {
    accountNumber: "LXB-123456",
    accountNumberCreatedAt: serverTimestamp()
  }));

  await seedDocuments((adminDb) =>
    setDoc(doc(adminDb, "users/alice"), {
      firstName: "Ada",
      accountNumber: "LXB-123456",
      accountNumberCreatedAt: new Date()
    })
  );
  await assertFails(updateDoc(user, { accountNumber: "LXB-654321" }));
  await assertSucceeds(updateDoc(user, { firstName: "Augusta" }));
});

test("owner can create a session, revoke it once, but cannot clear or change its revocation", async () => {
  const db = testEnv.authenticatedContext("alice").firestore();
  const session = doc(db, "users/alice/sessions/browser-1");

  await assertSucceeds(setDoc(session, { lastActiveAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(session, { revokedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(session, { lastActiveAt: serverTimestamp() }));
  await assertFails(updateDoc(session, { revokedAt: null }));
  await assertFails(updateDoc(session, { revokedAt: serverTimestamp() }));
});

test("a non-anonymous owner can vote only on a published existing post or comment", async () => {
  await seedDocuments(async (db) => {
    await setDoc(doc(db, "posts/published"), { status: "published" });
    await setDoc(doc(db, "posts/hidden"), { status: "removed" });
    await setDoc(doc(db, "posts/published/comments/comment-1"), {
      status: "published"
    });
  });
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "password" }
  }).firestore();

  await assertSucceeds(setDoc(
    doc(db, "posts/published/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertSucceeds(setDoc(
    doc(db, "posts/published/comments/comment-1/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(
    doc(db, "posts/hidden/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(
    doc(db, "posts/missing/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(
    doc(db, "posts/published/comments/missing/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
});

test("anonymous users cannot create votes or reports", async () => {
  await seedDocuments((db) =>
    setDoc(doc(db, "posts/published"), { status: "published" })
  );
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "anonymous" }
  }).firestore();

  await assertFails(setDoc(
    doc(db, "posts/published/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(
    doc(db, "reports/report-1"),
    reportData("alice")
  ));
});

test("unauthenticated clients cannot create votes or reports", async () => {
  await seedDocuments((db) =>
    setDoc(doc(db, "posts/published"), { status: "published" })
  );
  const db = testEnv.unauthenticatedContext().firestore();

  await assertFails(setDoc(
    doc(db, "posts/published/votes/alice"),
    { value: 1, createdAt: serverTimestamp() }
  ));
  await assertFails(setDoc(
    doc(db, "reports/report-unauthenticated"),
    reportData("alice")
  ));
});

function reportData(reporterUid, overrides = {}) {
  return {
    targetType: "post",
    targetPath: "posts/published",
    targetId: "published",
    targetAuthorUid: "bob",
    reporterUid,
    reason: "spam",
    note: "Please review this post",
    status: "open",
    createdAt: serverTimestamp(),
    ...overrides
  };
}

test("authenticated non-anonymous users can create bounded reports", async () => {
  const db = testEnv.authenticatedContext("alice", {
    firebase: { sign_in_provider: "google.com" }
  }).firestore();

  await assertSucceeds(setDoc(
    doc(db, "reports/report-1"),
    reportData("alice")
  ));
  await assertFails(setDoc(
    doc(db, "reports/report-2"),
    reportData("alice", { note: "N".repeat(1001) })
  ));
  await assertFails(setDoc(
    doc(db, "reports/report-3"),
    reportData("alice", { targetPath: "p".repeat(513) })
  ));
  await assertFails(updateDoc(
    doc(db, "reports/report-1"),
    { note: "Changed by client" }
  ));
});

test("only owner and admin roles can write spaces", async () => {
  const admin = testEnv.authenticatedContext("admin", {
    role: "admin"
  }).firestore();
  const owner = testEnv.authenticatedContext("owner", {
    role: "owner"
  }).firestore();
  const moderator = testEnv.authenticatedContext("moderator", {
    role: "mod"
  }).firestore();

  await assertSucceeds(setDoc(doc(admin, "spaces/general"), { title: "General" }));
  await assertSucceeds(setDoc(doc(owner, "spaces/support"), { title: "Support" }));
  await assertFails(setDoc(doc(moderator, "spaces/ideas"), { title: "Ideas" }));
});

test("orders and giftCards are inaccessible to clients", async () => {
  await seedDocuments(async (db) => {
    await setDoc(doc(db, "orders/order-1"), { ownerUid: "alice" });
    await setDoc(doc(db, "giftCards/card-1"), { ownerUid: "alice" });
  });
  const db = testEnv.authenticatedContext("alice").firestore();

  for (const document of [
    doc(db, "orders/order-1"),
    doc(db, "giftCards/card-1")
  ]) {
    await assertFails(getDoc(document));
    await assertFails(setDoc(document, { ownerUid: "alice" }));
  }
});
