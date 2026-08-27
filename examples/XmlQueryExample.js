/*
 * Copyright 2026 Digital Envoy, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const crypto = require("crypto");
const { NetAcuityClient } = require("../lib/NetAcuityAPI.js");

function printUsage() {
    console.log("Usage:\n node XmlQueryExample.js <server-ip> <query-ip> <comma-separated feature-codes>");
    process.exit(2);
}

if (process.argv.length !== 5) {
    printUsage();
}

const serverIP = process.argv[2];
const queryIP = process.argv[3];
const featureCodes = process.argv[4];

const exampleApiId = 82;
const timeoutMillis = 3000;

async function main() {
    // Use XML UDP protocol (query multiple databases at a time)
    const client = new NetAcuityClient(serverIP, exampleApiId, timeoutMillis);
    const transactionId = crypto.randomInt(0, 1_000_000_000).toString();
    const response = await client.queryXml(queryIP, featureCodes.split(",").map(Number), transactionId);
    console.log(`ip = ${response["ip"]}`);
    console.log(`trans-id = ${response["trans-id"]}`);
    Object.entries(response).forEach(([field, value]) => {
        if (field === "ip" || field === "trans-id") return;
        console.log(`${field} = ${value}`);
    });
}

main().catch((err) => {
    console.log(`Error: ${err.message}`);
    process.exit(1);
});
