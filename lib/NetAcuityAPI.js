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

'use strict';

const dgram = require("dgram");
const crypto = require("crypto");
const xml2js = require("xml2js");
const netAcuityTools = require("./NetAcuityTools.js");
const { NetAcuityError } = require("./NetAcuityError.js");

const serverPort = 5400;

/**
 * A reusable client bound to one NetAcuity Server, API ID, and timeout.
 * Construct once and call queryXml() repeatedly.
 */
class NetAcuityClient {
    // Private field (not just an unenforced convention) so apiId can't be reassigned
    // post-construction, bypassing the isValidApiId() check above.
    #apiId;

    /**
     * @param {string} serverIp NetAcuity Server address (IPv4 or IPv6)
     * @param {number} [apiId] customer-assigned API ID, range 0-127; defaults to 0
     * @param {number} [timeoutMillis] socket receive timeout in milliseconds; defaults to 2000
     */
    constructor(serverIp, apiId = 0, timeoutMillis = 2000) {
        if (!netAcuityTools.isValidApiId(apiId)) {
            throw new NetAcuityError("Invalid apiId");
        }
        const ipType = netAcuityTools.determineIpType(serverIp);
        if (ipType === undefined) {
            throw new NetAcuityError("Invalid serverIp");
        }
        if (!netAcuityTools.isValidDelay(timeoutMillis)) {
            throw new NetAcuityError("Invalid timeoutDelayMillis");
        }

        this.serverIp = serverIp;
        this.#apiId = apiId;
        this.timeoutMillis = timeoutMillis;
        this.ipType = ipType;
    }

    /** @returns {number} the customer-assigned API ID this client was constructed with */
    get apiId() {
        return this.#apiId;
    }

    /**
     * Queries one or more databases in a single request using the XML UDP protocol.
     * @param {string} queryIp IPv4 or IPv6 address to look up
     * @param {number[]} featureCodes databases to query
     * @param {string} [transactionId] caller-supplied transaction ID; auto-generated if omitted
     * @returns {Promise<Object>} resolves with the parsed response object; always includes a
     *          `raw-response` property holding the unparsed, reassembled XML response string
     */
    queryXml(queryIp, featureCodes, transactionId) {
        return new Promise((resolve, reject) => {
            for (const fc of featureCodes) {
                if (!netAcuityTools.isValidFeatureCode(fc)) {
                    return reject(new NetAcuityError(`Invalid featureCode: ${fc}`));
                }
            }
            if (netAcuityTools.determineIpType(queryIp) === undefined) {
                return reject(new NetAcuityError("Invalid queryIp"));
            }
            if (transactionId && !netAcuityTools.isValidXmlTransactionId(transactionId)) {
                return reject(new NetAcuityError("Invalid transactionId"));
            }

            //set socket type and query string
            let socket;
            try {
                socket = (this.ipType === 4) ? dgram.createSocket("udp4") : dgram.createSocket("udp6");
            } catch (err) {
                return reject(new NetAcuityError(`${err}`));
            }
            if (!transactionId) {
                // crypto.randomBytes is a CSPRNG; a predictable/guessable ID would let an
                // attacker forge a response that passes the transaction-id echo check below.
                transactionId = crypto.randomBytes(5).toString("hex");
            }
            let queryString = `<request trans-id="${transactionId}" ip="${queryIp}" api-id="${this.apiId}">`;
            for (const fc of featureCodes) {
                queryString += ` <query db="${fc}"/>`;
            }
            queryString += " </request>";
            const bufferMessage = Buffer.from(queryString);

            //guards against the timeout, error, and message handlers all firing for the same request
            let settled = false;

            //if the request times out, close the socket and reject
            const timeoutObject = setTimeout(() => {
                if (settled) return;
                settled = true;
                socket.close();
                reject(new NetAcuityError(`Request timed out after ${this.timeoutMillis} milliseconds for transaction : ${transactionId}`));
            }, this.timeoutMillis);

            //if the socket itself errors (e.g. DNS, permission, or network failure), close it and reject
            socket.on("error", (err) => {
                if (settled) return;
                settled = true;
                socket.close();
                clearTimeout(timeoutObject);
                reject(new NetAcuityError(`${err}`));
            });

            //parses the message received from the NetAcuity Server and resolves/rejects accordingly
            let previousPacketNo = 0;
            let fullResponse = "";
            socket.on("message", (message, rinfo) => {
                if (settled) return;
                //ignore packets from anyone other than the queried server; a spoofed/stray
                //packet should not consume the "first response wins" slot
                if (!netAcuityTools.ipsEqual(rinfo.address, this.serverIp)) return;
                const msg = message.toString();

                const packetNo = parseInt(msg.slice(0, 2), 10);
                const totalPackets = parseInt(msg.slice(2, 4), 10);
                if ((packetNo - 1) !== previousPacketNo) {
                    settled = true;
                    socket.close();
                    clearTimeout(timeoutObject);
                    return reject(new NetAcuityError("Packets received out of order"));
                }
                previousPacketNo = packetNo;
                fullResponse += msg.slice(4, -1);
                if (packetNo === totalPackets) {
                    settled = true;
                    socket.close();
                    clearTimeout(timeoutObject);
                    const parser = new xml2js.Parser();
                    parser.parseString(fullResponse, (err, result) => {
                        if (err) {
                            return reject(new NetAcuityError(`${err}`));
                        }
                        netAcuityTools.generateXMLResponseObject(result, transactionId, queryIp, (err, data) => {
                            if (err) {
                                const mismatchErr = new NetAcuityError(err);
                                mismatchErr["raw-response"] = fullResponse;
                                return reject(mismatchErr);
                            }
                            data["raw-response"] = fullResponse;
                            resolve(data);
                        });
                    });
                }
            });
            //send the request
            socket.send(bufferMessage, 0, bufferMessage.length, serverPort, this.serverIp, (err) => {
                if (err) {
                    if (settled) return;
                    settled = true;
                    socket.close();
                    clearTimeout(timeoutObject);
                    reject(new NetAcuityError(`${err}`));
                }
            });
        });
    }
}

module.exports = { NetAcuityClient, NetAcuityError };
