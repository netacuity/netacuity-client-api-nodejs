# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This changelog starts at the initial public release on GitHub; changes prior to that are not tracked here.

## [7.0.0]

### Added
- Initial public release of the NetAcuity Node.js Client API on GitHub.
- XML UDP protocol support (`NetAcuityClient.queryXml`).
- Support for feature codes: Geo (3), Edge (4), Domain16 (16), Zip (7),
  ISP (8), Home/Business (9), ASN (10), Language (11), Proxy (12), Is-an-ISP (14),
  Company (15), Demographics (17), NAICS (18), CBSA (19), Pulse Max (21),
  Mobile Carrier (24), Organization (25),
  Pulse (26), Pulse Plus (30), VPN/Proxy (33), IPC (35), Observed Countries (37), and
  Addressability codes (40-47).
- Configurable API ID and request timeout, set once per `NetAcuityClient` instance; an optional `transactionId` parameter on the query method, so callers can supply their own instead of relying on the auto-generated one.
- Response-echo verification (UDP sender address, transaction ID, and query IP), rejecting spoofed or stale replies; a `crypto.randomBytes`-backed transaction ID generator.
- Test suite covering the XML protocol and all supported feature codes across
  Node 18/20/22.
- Apache License 2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)).
