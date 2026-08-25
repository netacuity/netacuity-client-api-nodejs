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

jest.mock('dgram');
jest.mock('crypto');

const dgram = require('dgram');
const crypto = require('crypto');
const { NetAcuityClient, NetAcuityError } = require('../lib/NetAcuityAPI.js');

// Fake timers for the entire file — prevents real setTimeout handles from leaking.
// Tests that verify timeout behavior call jest.runAllTimers() explicitly.
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const MOCK_TX_ID = 'a1b2c3d4e5'; // must be valid hex — mocks crypto.randomBytes(5).toString('hex')
const VALID_SERVER_IP = '203.0.113.1';
const VALID_SERVER_IP_V6 = '2001:db8::1';
const VALID_QUERY_IP = '192.0.2.1';
const VALID_FC = 3;
const VALID_API_ID = 82;
const VALID_TIMEOUT = 3000;

// ─── Mock socket factory ──────────────────────────────────────────────────────

function createMockSocket() {
    const handlers = {};
    let lastSendAddress;
    const socket = {
        on: jest.fn((event, handler) => {
            handlers[event] = handler;
        }),
        close: jest.fn(),
        send: jest.fn((buffer, offset, length, port, address, cb) => {
            lastSendAddress = address;
            if (cb) cb(null);
        }),
        // For 'message' events, default rinfo to the address the request was actually
        // sent to (mirroring a real dgram response) unless the caller supplies its own,
        // e.g. to simulate a spoofed/stray packet from a different sender.
        _trigger: (event, ...args) => {
            if (event === 'message' && args.length < 2) {
                args.push({ address: lastSendAddress });
            }
            if (handlers[event]) handlers[event](...args);
        },
    };
    return socket;
}

// Build a single-packet XML UDP response message.
// Format: packetNo(2) + totalPackets(2) + xmlContent + terminatorChar
function buildXmlMessage(packetNo, totalPackets, xmlContent) {
    const pn = String(packetNo).padStart(2, '0');
    const tp = String(totalPackets).padStart(2, '0');
    return Buffer.from(`${pn}${tp}${xmlContent}\0`);
}

// ─── NetAcuityClient constructor — input validation ───────────────────────────

describe('NetAcuityClient constructor – input validation', () => {
    test('throws for invalid apiId (too high)', () => {
        expect(() => new NetAcuityClient(VALID_SERVER_IP, 128, VALID_TIMEOUT)).toThrow(/Invalid apiId/);
    });

    test('throws for negative apiId', () => {
        expect(() => new NetAcuityClient(VALID_SERVER_IP, -1, VALID_TIMEOUT)).toThrow(/Invalid apiId/);
    });

    test('throws for invalid serverIp', () => {
        expect(() => new NetAcuityClient('not-an-ip', VALID_API_ID, VALID_TIMEOUT)).toThrow(/Invalid serverIp/);
    });

    test('throws for float timeoutMillis', () => {
        expect(() => new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, 1000.5)).toThrow(/Invalid timeoutDelayMillis/);
    });

    test('throws for non-numeric timeoutMillis', () => {
        expect(() => new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, 'fast')).toThrow(/Invalid timeoutDelayMillis/);
    });

    test('defaults apiId to 0 and timeoutMillis to 2000 when omitted', () => {
        const client = new NetAcuityClient(VALID_SERVER_IP);
        expect(client.apiId).toBe(0);
        expect(client.timeoutMillis).toBe(2000);
    });

    test('apiId is a read-only getter and cannot be reassigned after construction', () => {
        const client = new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, VALID_TIMEOUT);
        expect(() => {
            client.apiId = 999;
        }).toThrow(TypeError);
        expect(client.apiId).toBe(VALID_API_ID);
    });
});

// ─── queryXml — input validation ──────────────────────────────────────────────

describe('queryXml – input validation', () => {
    let client;

    beforeEach(() => {
        client = new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, VALID_TIMEOUT);
    });

    test('rejects for invalid featureCode in array', async () => {
        await expect(client.queryXml(VALID_QUERY_IP, [-1])).rejects.toThrow(/Invalid featureCode/);
    });

    test('rejects for float featureCode in array', async () => {
        await expect(client.queryXml(VALID_QUERY_IP, [3.5])).rejects.toThrow(/Invalid featureCode/);
    });

    test('includes the invalid featureCode value in the error message', async () => {
        await expect(client.queryXml(VALID_QUERY_IP, [3, -99])).rejects.toThrow(/-99/);
    });

    test('rejects for invalid queryIp', async () => {
        await expect(client.queryXml('bad-ip', [3])).rejects.toThrow(/Invalid queryIp/);
    });

    test('does not create a socket when validation fails', async () => {
        await expect(client.queryXml(VALID_QUERY_IP, [-1])).rejects.toThrow();
        expect(dgram.createSocket).not.toHaveBeenCalled();
    });

    test.each(['"', '<', '>', '&'])('rejects for a transactionId containing %s', async (char) => {
        await expect(client.queryXml(VALID_QUERY_IP, [3], `abc${char}123`)).rejects.toThrow(/Invalid transactionId/);
    });

    test('does not create a socket when transactionId contains an XML-breaking character', async () => {
        await expect(client.queryXml(VALID_QUERY_IP, [3], 'x"><evil>')).rejects.toThrow(/Invalid transactionId/);
        expect(dgram.createSocket).not.toHaveBeenCalled();
    });
});

// ─── queryXml — socket type selection ─────────────────────────────────────────

describe('queryXml – socket type selection', () => {
    let mockSocket;

    beforeEach(() => {
        mockSocket = createMockSocket();
        dgram.createSocket = jest.fn(() => mockSocket);
        crypto.randomBytes = jest.fn(() => Buffer.from(MOCK_TX_ID, 'hex'));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('creates a udp4 socket for an IPv4 serverIp', () => {
        const client = new NetAcuityClient('203.0.113.1', VALID_API_ID, VALID_TIMEOUT);
        client.queryXml(VALID_QUERY_IP, [3]).catch(() => {});
        expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
    });

    test('creates a udp6 socket for an IPv6 serverIp', () => {
        const client = new NetAcuityClient(VALID_SERVER_IP_V6, VALID_API_ID, VALID_TIMEOUT);
        client.queryXml('2001:db8::2', [3]).catch(() => {});
        expect(dgram.createSocket).toHaveBeenCalledWith('udp6');
    });
});

// ─── queryXml — successful response ───────────────────────────────────────────

describe('queryXml – successful response', () => {
    let mockSocket;
    let client;

    beforeEach(() => {
        mockSocket = createMockSocket();
        dgram.createSocket = jest.fn(() => mockSocket);
        crypto.randomBytes = jest.fn(() => Buffer.from(MOCK_TX_ID, 'hex'));
        client = new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, VALID_TIMEOUT);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('resolves with a parsed response object for a single-packet XML response', async () => {
        const xmlContent = `<response trans-id="${MOCK_TX_ID}" ip="${VALID_QUERY_IP}" country="usa" region="ca"/>`;
        const msg = buildXmlMessage(1, 1, xmlContent);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        mockSocket._trigger('message', msg);
        const data = await promise;

        expect(data['trans-id']).toBe(MOCK_TX_ID);
        expect(data['ip']).toBe(VALID_QUERY_IP);
        expect(data['country']).toBe('usa');
        expect(data['region']).toBe('ca');
    });

    test('assembles response correctly across multiple packets', async () => {
        const fullXml = `<response trans-id="${MOCK_TX_ID}" ip="${VALID_QUERY_IP}" country="jpn"/>`;
        const half = Math.floor(fullXml.length / 2);
        const part1 = fullXml.slice(0, half);
        const part2 = fullXml.slice(half);

        const msg1 = buildXmlMessage(1, 2, part1);
        const msg2 = buildXmlMessage(2, 2, part2);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        mockSocket._trigger('message', msg1);
        mockSocket._trigger('message', msg2);
        const data = await promise;

        expect(data['country']).toBe('jpn');
    });

    test('closes the socket after the final packet', async () => {
        const xmlContent = `<response trans-id="${MOCK_TX_ID}" ip="${VALID_QUERY_IP}"/>`;
        const msg = buildXmlMessage(1, 1, xmlContent);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        mockSocket._trigger('message', msg);
        await promise;

        expect(mockSocket.close).toHaveBeenCalledTimes(1);
    });

    test('always includes the reassembled XML response string as raw-response', async () => {
        const xmlContent = `<response trans-id="${MOCK_TX_ID}" ip="${VALID_QUERY_IP}" country="jpn"/>`;
        const half = Math.floor(xmlContent.length / 2);
        const msg1 = buildXmlMessage(1, 2, xmlContent.slice(0, half));
        const msg2 = buildXmlMessage(2, 2, xmlContent.slice(half));

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        mockSocket._trigger('message', msg1);
        mockSocket._trigger('message', msg2);
        const data = await promise;

        expect(data['raw-response']).toBe(xmlContent);
        expect(data['country']).toBe('jpn');
    });

    test('sends to the correct port (5400) and serverIp', () => {
        client.queryXml(VALID_QUERY_IP, [3]).catch(() => {});
        expect(mockSocket.send).toHaveBeenCalledWith(
            expect.any(Buffer),
            0,
            expect.any(Number),
            5400,
            VALID_SERVER_IP,
            expect.any(Function)
        );
    });

    test('includes all feature codes in the XML query string', () => {
        client.queryXml(VALID_QUERY_IP, [3, 8, 10]).catch(() => {});
        const sentBuffer = mockSocket.send.mock.calls[0][0];
        const sentString = sentBuffer.toString();
        expect(sentString).toContain('db="3"');
        expect(sentString).toContain('db="8"');
        expect(sentString).toContain('db="10"');
        expect(sentString).toContain(`trans-id="${MOCK_TX_ID}"`);
        expect(sentString).toContain(`ip="${VALID_QUERY_IP}"`);
        expect(sentString).toContain(`api-id="${VALID_API_ID}"`);
    });
});

// ─── queryXml — error conditions ──────────────────────────────────────────────

describe('queryXml – error conditions', () => {
    let mockSocket;
    let client;

    beforeEach(() => {
        mockSocket = createMockSocket();
        dgram.createSocket = jest.fn(() => mockSocket);
        crypto.randomBytes = jest.fn(() => Buffer.from(MOCK_TX_ID, 'hex'));
        client = new NetAcuityClient(VALID_SERVER_IP, VALID_API_ID, VALID_TIMEOUT);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('rejects when packets arrive out of order', async () => {
        // Send packet 2 before packet 1
        const xmlContent = `<response trans-id="${MOCK_TX_ID}"/>`;
        const msg2 = buildXmlMessage(2, 2, xmlContent);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        const rejection = expect(promise).rejects.toThrow(/out of order/);
        mockSocket._trigger('message', msg2);
        await rejection;

        expect(mockSocket.close).toHaveBeenCalled();
    });

    test('rejects when XML trans-id does not match', async () => {
        const xmlContent = `<response trans-id="wrongId" ip="${VALID_QUERY_IP}"/>`;
        const msg = buildXmlMessage(1, 1, xmlContent);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        const rejection = expect(promise).rejects.toThrow(/transaction-id/);
        mockSocket._trigger('message', msg);
        await rejection;
    });

    test('rejects when send fails', async () => {
        mockSocket.send = jest.fn((buffer, offset, length, port, address, cb) => {
            if (cb) cb(new Error('ECONNREFUSED'));
        });

        await expect(client.queryXml(VALID_QUERY_IP, [3])).rejects.toThrow(/Error/);
    });

    test('rejects with a timeout error when no response arrives', async () => {
        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        let err;
        promise.catch((e) => { err = e; });

        jest.runAllTimers();
        await Promise.resolve().then(() => {});

        expect(err.message).toMatch(/timed out/);
        expect(err.message).toContain(String(VALID_TIMEOUT));
        expect(mockSocket.close).toHaveBeenCalled();
    });

    test('rejects and closes socket when the socket emits an error event', async () => {
        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        const rejection = expect(promise).rejects.toThrow(/ECONNREFUSED/);
        mockSocket._trigger('error', new Error('ECONNREFUSED'));
        await rejection;
        expect(mockSocket.close).toHaveBeenCalled();
    });

    test('does not double-settle if a stray error event fires after the final packet was already handled', async () => {
        const xmlContent = `<response trans-id="${MOCK_TX_ID}" ip="${VALID_QUERY_IP}"/>`;
        const msg = buildXmlMessage(1, 1, xmlContent);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        mockSocket._trigger('message', msg);
        mockSocket._trigger('error', new Error('late error'));
        await promise;

        expect(mockSocket.close).toHaveBeenCalledTimes(1);
    });

    test('rejects for malformed XML response', async () => {
        const badXml = '<response trans-id="' + MOCK_TX_ID + '" BROKEN XML>>>>>';
        const msg = buildXmlMessage(1, 1, badXml);

        const promise = client.queryXml(VALID_QUERY_IP, [3]);
        const rejection = expect(promise).rejects.toThrow(/Error/);
        mockSocket._trigger('message', msg);
        await rejection;
    });
});
