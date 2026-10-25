# Accepted dependency findings

Review these exceptions by **2026-11-24**.

| Package | Scope and reason | Review |
| --- | --- | --- |
| `uuid` | Moderate advisory in `uuid@9.0.1`, transitive through Firebase Admin's Google client dependencies. Application source does not import `uuid` directly; reachability through those dependencies has not been established. Reassess before upgrading Firebase Admin across a major version. | 2026-11-24 |
| `ts-deepmerge` | Moderate advisory, transitive through the development-only `firebase-functions-test` dependency; excluded from the production audit. Reassess when updating the test tooling. | 2026-11-24 |
