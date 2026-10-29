const assert = require("node:assert/strict");
const admin = require("firebase-admin");

const projectId = "demo-lixby";
const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const functionsEmulator = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const apiKey = "emulator-test-api-key";
const password = "EmulatorTestPassword123!";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Ejecuta esta prueba con los emuladores de Auth y Firestore.");
}

if (!admin.apps.length) admin.initializeApp({ projectId });

async function createUser(suffix) {
  const email = `auth-emulator-${suffix}-${Date.now()}@example.test`;
  const response = await fetch(
    `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const body = await response.json();
  assert.equal(response.ok, true, `Auth Emulator no creó el usuario (${response.status}).`);
  return { email, uid: body.localId, idToken: body.idToken };
}

async function signIn(email) {
  const response = await fetch(
    `http://${authEmulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    }
  );
  const body = await response.json();
  assert.equal(response.ok, true, `Auth Emulator no inició sesión (${response.status}).`);
  return body.idToken;
}

async function callFunction(name, region, data = {}, idToken = "") {
  const headers = { "Content-Type": "application/json" };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const response = await fetch(
    `http://${functionsEmulator}/${projectId}/${region}/${name}`,
    { method: "POST", headers, body: JSON.stringify({ data }) }
  );
  return { status: response.status, body: await response.json() };
}

function assertCallableError(result, status) {
  assert.equal(result.body.error?.status, status, JSON.stringify(result.body));
}

function callableData(result) {
  return result.body.data ?? result.body.result;
}

async function run() {
  const ensureAccountUnauthenticated = await callFunction(
    "ensureAccountNumber",
    "us-central1"
  );
  assertCallableError(ensureAccountUnauthenticated, "UNAUTHENTICATED");

  const user = await createUser("customer");
  const firstAccount = await callFunction(
    "ensureAccountNumber",
    "us-central1",
    {},
    user.idToken
  );
  assert.match(
    callableData(firstAccount)?.accountNumber || "",
    /^NLX-[A-Z0-9]{15}$/,
    JSON.stringify(firstAccount.body)
  );

  const repeatedAccount = await callFunction(
    "ensureAccountNumber",
    "us-central1",
    {},
    user.idToken
  );
  assert.equal(
    callableData(repeatedAccount)?.accountNumber,
    callableData(firstAccount).accountNumber,
    "El número de cuenta debe ser idempotente."
  );

  const target = await admin.firestore().collection("users").add({
    email: "private-user@example.test",
    displayName: "Private Test User"
  });

  const searchUnauthenticated = await callFunction(
    "adminSearchUser",
    "europe-west1",
    { email: "private-user@example.test" }
  );
  assertCallableError(searchUnauthenticated, "UNAUTHENTICATED");

  const searchCustomer = await callFunction(
    "adminSearchUser",
    "europe-west1",
    { email: "private-user@example.test" },
    user.idToken
  );
  assertCallableError(searchCustomer, "PERMISSION_DENIED");

  const moderator = await createUser("admin");
  await admin.auth().setCustomUserClaims(moderator.uid, { role: "admin" });
  const adminToken = await signIn(moderator.email);
  const searchAdmin = await callFunction(
    "adminSearchUser",
    "europe-west1",
    { email: "private-user@example.test" },
    adminToken
  );
  assert.equal(callableData(searchAdmin)?.uid, target.id);
  assert.equal(callableData(searchAdmin)?.userData?.email, "private-user@example.test");

  console.log("Auth Emulator: 5 comprobaciones pasaron.");
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
