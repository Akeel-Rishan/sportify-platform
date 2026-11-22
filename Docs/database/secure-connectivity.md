# Secure Oracle connectivity

**Selected deployment mode: Thin mTLS with an instance wallet.** The user selected Mumbai, Always Free Transaction Processing, Secure access from everywhere and required mTLS to accommodate a changing laptop IP, and reports completing creation. The operator supplied passing account postconditions, and actual runtime identity/target and mTLS connectivity were verified on 22 November 2026; the Step 06 acceptance audit is awaiting user verification. This selection supersedes the earlier conditional walletless-TLS assumption; only the selected mTLS mode is implemented. No cloud/network change is performed by the application or this agent.

Pinned `oracledb` **26.0.0** with `@types/oracledb` **26.0.1**, Node **22.22.0**, existing TypeScript **5.9.3**. The default Thin driver needs no Oracle Client library/native loading. Its Node >=14.17 metadata accepts Node 22; official documentation lists Node 22 and Linux aarch64. Windows x64 local execution is the only execution here; Linux ARM64/container/OCI validation is pending. pnpm deliberately leaves the driver's installation check script unapproved: inspection shows version/optional Thick binary checks; Thin imports/compilation are verified without enabling native mode.

Only `tcps://host:port/service` is accepted. Use the exact host/service/port from the authorized target's mTLS connection information, converted to option-free Easy Connect. No aliases, arbitrary descriptors, credential-bearing URLs, query options, embedded wallet options, retry settings or plaintext TCP. `sslServerDNMatch:true` verifies hostname against server certificate identity; `sslAllowWeakDNMatch:false` retains strict matching, and the normal CA-chain verification remains enabled. No custom TLS bypass or weak mode is supported. Actual ATP certificate chain/server identity, wallet decryption and account authentication must be verified on the target. Encrypted transport does not replace correct account privileges.

Production injects configuration through the process environment. Development may use app-relative ignored `.env.local`/`.env`; injected variables win, even empty invalid values. API and worker loaders validate their own runtime identity and never load owner/admin credentials. Protect local files with user-only OS permissions and production secrets through the deployment secret mechanism; no cloud integration is implemented. Do not print config objects, descriptors, bind values or raw driver exceptions.

## Instance-wallet setup

Once the database is Available, open Database connection, select **Instance wallet**, and use Download wallet. Choose a strong wallet password independently from the ADMIN/runtime passwords; supply it only through the protected local/deployment secret mechanism, never chat, command arguments or committed files. Extract the wallet outside this checkout, for example `C:/Users/<local-user>/sportify-secrets/oracle/dev`. Keep the ZIP and extracted material private with user/service-only filesystem access. Linux mounts likewise require directory/file permissions restricted to the runtime identity.

Thin mode needs **ewallet.pem** in `ORACLE_WALLET_DIRECTORY` and its decryption password in `ORACLE_WALLET_PASSWORD`. The runtime preflight checks that the absolute-directory configuration resolves to a readable, nonempty regular ewallet.pem file before allocating a pool. It inspects metadata/readability only and emits an authored field error without the path, contents, endpoints or password. The driver loads/decrypts the PEM during connection establishment; file existence alone does not prove certificate validity, password correctness or a successful mTLS handshake.

`ORACLE_CONNECT_STRING` remains option-free `tcps://host:port/service`, using the exact mTLS host, port and service from the designated database connection information; port 1522 is an example, not a discovery/default assumption. No tnsnames alias/configDir is needed with this supported Easy Connect form. Keep tnsnames.ora available privately for operator clients, but do not paste its descriptors into logs/chat. Thin supports this wallet directly; no initOracleClient/native Thick mode is introduced. The same instance wallet can accompany the separate restricted database identities; the wallet password is not either runtime password.

The driver receives walletLocation/walletPassword alongside strict certificate/hostname verification. No walletless fallback or security-mode toggle is provided. Walletless TLS remains an alternative requiring an explicitly reviewed access-control policy and a future single-mode change, not a second configuration branch here. Never commit ZIPs, PEM/P12/SSO/JKS files, tnsnames.ora or sqlnet.ora. Wallet replacement/password rotation requires secure material replacement and process/pool recreation; retain readiness gating until real probes pass.

Official evidence consulted 20 November 2026:

- [Exact registry metadata](https://registry.npmjs.org/oracledb/26.0.0), [type metadata](https://registry.npmjs.org/@types/oracledb/26.0.1).
- [26.0.0 architecture, Node and ARM platform evidence](https://node-oracledb.readthedocs.io/en/v26.0.0/user_guide/introduction.html).
- [ATP one-way TLS and Thin mTLS requirements](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html#connecting-to-oracle-cloud-autonomous-databases) (26.0.0 documentation at consultation).
- [Pool connection attributes, strict DN matching and timeout units](https://node-oracledb.readthedocs.io/en/latest/api_manual/oracledb.html#oracledb.createPool).
- [Pool drain behavior](https://node-oracledb.readthedocs.io/en/latest/api_manual/pool.html#pool.close).
- [NUMBER conversion, DATE/TIMESTAMP application timezone changes](https://node-oracledb.readthedocs.io/en/latest/user_guide/sql_execution.html#fetching-numbers-and-dates-as-strings).

Consultation and mock coverage do not prove TLS handshakes, credentials, session behavior or effective grants on an actual ATP service. See [verification gates](oracle-verification.md).

## Actual execution evidence

The 22 November Step 06 acceptance audit passed both restricted identities against the designated Oracle target with pinned node-oracledb 26.0.0 Thin mTLS on Node 22.22.0 / Windows x64. Server release reported 23.26.4.1.0 and AL32UTF8. TLS certificate/DN checking stayed enabled; wallet decryption and live identity/UTC/exact-value probes passed. SQLcl 26.3.1 / Java 21 were the observed operator client versions, superseding the initial 25.4 runbook target for this local evidence. Linux ARM64 and container execution remain untested. [Exact checks and limits](oracle-verification.md) separate this evidence from initial mocks and failed setup attempts.
