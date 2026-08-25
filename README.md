# NetAcuity Client API — Node.js

Node.js client library for querying the [NetAcuity](https://www.digitalelement.com/solutions/netacuity/) Server for IP geolocation and intelligence data. Supports the XML UDP query protocol.

## Requirements

- **Node.js** 18 or higher
- A running **NetAcuity Server** accessible on UDP port 5400
- An **API ID** (customer-provided integer, range 0–127; default 0)

## Installation / Build

```bash
git clone https://github.com/netacuity/netacuity-client-api-nodejs.git
cd netacuity-client-api-nodejs
npm install
```

## Quick Start

### XML UDP Query

The XML UDP protocol supports multiple feature codes in a single query.

```javascript
const { NetAcuityClient } = require('./lib/NetAcuityAPI');

const client = new NetAcuityClient('203.0.113.1', 82, 3000); // server IP, API ID, timeout in ms

async function main() {
  try {
    const response = await client.queryXml('192.0.2.1', [3, 8, 10]); // feature codes: Geographic, ISP, ASN
    console.log(response);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
```

## API Reference

### `new NetAcuityClient(serverIp, [apiId], [timeoutMillis])`

Constructs a client bound to one NetAcuity Server, API ID, and timeout. Throws a `NetAcuityError` immediately if `serverIp`, `apiId`, or `timeoutMillis` is invalid. The client holds no per-query state, so a single instance can be reused for repeated `queryXml()` calls.

| Parameter | Type | Description |
|---|---|---|
| `serverIp` | `string` | IPv4 or IPv6 address of the NetAcuity Server |
| `apiId` | `number` | Optional. Your API ID. Range 0-127. Defaults to 0. |
| `timeoutMillis` | `number` | Optional. Request timeout in milliseconds. Defaults to 2000. |

### `client.queryXml(queryIp, featureCodes, [transactionId])`

Queries one or more databases in a single request using the XML UDP protocol. Returns a `Promise` that resolves with the parsed response object, or rejects with a `NetAcuityError`. The raw, unparsed response text is also available via the `raw-response` property, alongside the parsed fields.

On an IP mismatch or a transaction-ID mismatch, the rejected `NetAcuityError` also carries the raw response text via its own `raw-response` property.

| Parameter | Type | Description |
|---|---|---|
| `queryIp` | `string` | IPv4 or IPv6 address to look up |
| `featureCodes` | `number[]` | Array of feature codes to query |
| `transactionId` | `string` | Optional. Caller-supplied transaction ID, verified against the value echoed back in the response. If omitted, one is generated automatically. |

## Feature Codes

For the complete, up-to-date list of feature codes and their response fields, see the [NetAcuity documentation](https://docs.netacuity.com/).

## Examples

Runnable examples are provided in the `examples/` directory: [examples/XmlQueryExample.js](examples/XmlQueryExample.js) for the XML UDP protocol.

```bash
node examples/XmlQueryExample.js <server-ip> <query-ip> <comma-separated-feature-codes>

# Examples:
node examples/XmlQueryExample.js 203.0.113.1 192.0.2.1 3,8,10
```

## Running the Tests

```bash
npm test
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## Support

Technical Support is only available to those under active contract with Digital Element. To contact Support, use the contact information provided at contract initiation.

- Documentation: [docs.netacuity.com](https://docs.netacuity.com/)
- Issues: [GitHub Issues](https://github.com/netacuity/netacuity-client-api-nodejs/issues)

## License

Copyright 2026 Digital Envoy, Inc.

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full license text.

This repository contains no third-party source code or binaries. Runtime dependencies declared in `package.json` are resolved by npm on the consumer's machine and are not bundled with this package.
