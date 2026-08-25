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

const tools = require('../lib/NetAcuityTools.js');

// ─── isValidFeatureCode ────────────────────────────────────────────────────────

describe('isValidFeatureCode', () => {
    test.each([3, 10, 47, 99])('returns true for valid integer %d', (fc) => {
        expect(tools.isValidFeatureCode(fc)).toBe(true);
    });

    test.each([-1, -100])('returns false for negative integer %d', (fc) => {
        expect(tools.isValidFeatureCode(fc)).toBe(false);
    });

    test.each([0, 1, 2, 100, 499, 500, 999])('returns false for out-of-range integer %d', (fc) => {
        expect(tools.isValidFeatureCode(fc)).toBe(false);
    });

    test.each([1.5, 3.14, 0.1])('returns false for float %d', (fc) => {
        expect(tools.isValidFeatureCode(fc)).toBe(false);
    });

    test.each(['abc', 'foo', ''])('returns false for non-numeric string "%s"', (fc) => {
        expect(tools.isValidFeatureCode(fc)).toBe(false);
    });

    test('returns false for null', () => {
        expect(tools.isValidFeatureCode(null)).toBe(false);
    });

    test('returns false for undefined', () => {
        expect(tools.isValidFeatureCode(undefined)).toBe(false);
    });

    test('accepts numeric strings representing valid integers', () => {
        expect(tools.isValidFeatureCode('3')).toBe(true);
        expect(tools.isValidFeatureCode('47')).toBe(true);
    });
});

// ─── isValidApiId ─────────────────────────────────────────────────────────────

describe('isValidApiId', () => {
    test.each([0, 1, 82, 100, 127])('returns true for valid api id %d', (id) => {
        expect(tools.isValidApiId(id)).toBe(true);
    });

    test('returns false for 128 (exceeds max)', () => {
        expect(tools.isValidApiId(128)).toBe(false);
    });

    test('returns false for -1 (below min)', () => {
        expect(tools.isValidApiId(-1)).toBe(false);
    });

    test.each([1.5, 82.9])('returns false for float %d', (id) => {
        expect(tools.isValidApiId(id)).toBe(false);
    });

    test.each(['abc', ''])('returns false for non-numeric string "%s"', (id) => {
        expect(tools.isValidApiId(id)).toBe(false);
    });

    test('returns false for null', () => {
        expect(tools.isValidApiId(null)).toBe(false);
    });

    test('returns false for undefined', () => {
        expect(tools.isValidApiId(undefined)).toBe(false);
    });

    test('accepts numeric string within range', () => {
        expect(tools.isValidApiId('82')).toBe(true);
        expect(tools.isValidApiId('127')).toBe(true);
        expect(tools.isValidApiId('128')).toBe(false);
    });
});

// ─── isValidDelay ─────────────────────────────────────────────────────────────

describe('isValidDelay', () => {
    test.each([1000, 3000, 5000, 0])('returns true for integer %d', (d) => {
        expect(tools.isValidDelay(d)).toBe(true);
    });

    test('returns false for negative integer', () => {
        expect(tools.isValidDelay(-1)).toBe(false);
    });

    test.each([1.5, 3000.5])('returns false for float %d', (d) => {
        expect(tools.isValidDelay(d)).toBe(false);
    });

    test.each(['abc', ''])('returns false for non-numeric string "%s"', (d) => {
        expect(tools.isValidDelay(d)).toBe(false);
    });

    test('returns false for null', () => {
        expect(tools.isValidDelay(null)).toBe(false);
    });

    test('returns false for undefined', () => {
        expect(tools.isValidDelay(undefined)).toBe(false);
    });

    test('accepts numeric string', () => {
        expect(tools.isValidDelay('3000')).toBe(true);
    });
});

// ─── isValidXmlTransactionId ───────────────────────────────────────────────────

describe('isValidXmlTransactionId', () => {
    test.each(['abc123', 'a1b2c3d4e5', 'caller-supplied-id', ''])('returns true for "%s"', (id) => {
        expect(tools.isValidXmlTransactionId(id)).toBe(true);
    });

    test.each(['"', '<', '>', '&'])('returns false for a transactionId containing %s', (char) => {
        expect(tools.isValidXmlTransactionId(`abc${char}123`)).toBe(false);
    });

    test('returns false for a transactionId attempting an XML attribute breakout', () => {
        expect(tools.isValidXmlTransactionId('x"><evil>')).toBe(false);
    });

    test('returns true for null and undefined (coerced to the strings "null"/"undefined")', () => {
        expect(tools.isValidXmlTransactionId(null)).toBe(true);
        expect(tools.isValidXmlTransactionId(undefined)).toBe(true);
    });
});

// ─── determineIpType ──────────────────────────────────────────────────────────

describe('determineIpType', () => {
    describe('IPv4', () => {
        test.each([
            '192.0.2.1',
            '192.0.2.100',
            '192.0.2.0',
            '198.51.100.255',
            '203.0.113.1',
            '203.0.113.50',
        ])('returns 4 for valid IPv4 address "%s"', (ip) => {
            expect(tools.determineIpType(ip)).toBe(4);
        });
    });

    describe('IPv6', () => {
        test.each([
            '2001:db8::1',
            '2001:db8::2',
            '2001:db8:1::1',
            '2001:0db8:0000:0000:0000:0000:0000:0001',
            '::ffff:192.0.2.1',
        ])('returns 6 for valid IPv6 address "%s"', (ip) => {
            expect(tools.determineIpType(ip)).toBe(6);
        });
    });

    describe('invalid', () => {
        test.each([
            'not-an-ip',
            '256.0.2.1',
            '192.0.2',
            '',
            'localhost',
            '999.0.2.1',
        ])('returns undefined for invalid address "%s"', (ip) => {
            expect(tools.determineIpType(ip)).toBeUndefined();
        });
    });
});

// ─── ipsEqual ──────────────────────────────────────────────────────────────────

describe('ipsEqual', () => {
    describe('equal IPv6 addresses in different textual forms', () => {
        test.each([
            ['2001:db8::1', '2001:0db8:0000:0000:0000:0000:0000:0001'],
            ['2001:DB8::1', '2001:db8::1'],
            ['2001:db8::9', '2001:0db8:0000:0000:0000:0000:0000:0009'],
            ['::', '0:0:0:0:0:0:0:0'],
            ['::ffff:192.0.2.1', '::ffff:c000:0201'],
            ['2001:db8::1%eth0', '2001:DB8:0:0:0:0:0:1%eth0'],
        ])('treats "%s" and "%s" as equal', (a, b) => {
            expect(tools.ipsEqual(a, b)).toBe(true);
            expect(tools.ipsEqual(b, a)).toBe(true);
        });
    });

    describe('genuinely different addresses', () => {
        test.each([
            ['2001:db8::1', '2001:db8::2'],
            ['2001:db8::9', '2001:db8::10'],
            ['2001:db8::1%eth0', '2001:db8::1%eth1'],
        ])('treats "%s" and "%s" as different', (a, b) => {
            expect(tools.ipsEqual(a, b)).toBe(false);
        });
    });

    describe('IPv4', () => {
        test('identical IPv4 literals are equal', () => {
            expect(tools.ipsEqual('192.0.2.1', '192.0.2.1')).toBe(true);
        });
        test('different IPv4 literals are not equal', () => {
            expect(tools.ipsEqual('192.0.2.1', '192.0.2.2')).toBe(false);
        });
        test('an IPv4 literal is never equal to an IPv6 literal', () => {
            expect(tools.ipsEqual('192.0.2.1', '::ffff:192.0.2.1')).toBe(false);
        });
    });

    describe('malformed input', () => {
        test('falls back to false rather than throwing on a malformed IPv6 literal', () => {
            expect(tools.ipsEqual('2001:db8:::1', '2001:db8::1')).toBe(false);
        });
        test('returns false for non-string input rather than throwing', () => {
            expect(tools.ipsEqual(undefined, '2001:db8::1')).toBe(false);
            expect(tools.ipsEqual('2001:db8::1', null)).toBe(false);
        });
    });
});

// ─── generateXMLResponseObject ────────────────────────────────────────────────

describe('generateXMLResponseObject', () => {
    const TX_ID = 'xmlTxId001';
    const QUERY_IP = '192.0.2.1';

    function makeXmlResult(transId, extraAttrs, ip = QUERY_IP) {
        const attrs = Object.assign({ 'trans-id': transId, ip }, extraAttrs);
        return { response: { $: attrs } };
    }

    test('calls callback with the attributes object when ip and trans-id match', (done) => {
        const xmlResult = makeXmlResult(TX_ID, { country: 'usa', region: 'ca' });
        tools.generateXMLResponseObject(xmlResult, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toBe('');
            expect(data['trans-id']).toBe(TX_ID);
            expect(data['ip']).toBe(QUERY_IP);
            expect(data['country']).toBe('usa');
            expect(data['region']).toBe('ca');
            done();
        });
    });

    test('calls callback with error when trans-id does not match', (done) => {
        const xmlResult = makeXmlResult('differentTxId', {});
        tools.generateXMLResponseObject(xmlResult, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toContain('transaction-id');
            expect(data).toBe('');
            done();
        });
    });

    test('calls callback with error when ip does not match', (done) => {
        const xmlResult = makeXmlResult(TX_ID, {}, '203.0.113.9');
        tools.generateXMLResponseObject(xmlResult, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toContain('IP');
            expect(data).toBe('');
            done();
        });
    });

    test('calls callback with an error instead of throwing when response.response is missing', (done) => {
        tools.generateXMLResponseObject({}, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toContain('malformed');
            expect(data).toBe('');
            done();
        });
    });

    test('calls callback with an error instead of throwing when response is undefined', (done) => {
        tools.generateXMLResponseObject(undefined, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toContain('malformed');
            expect(data).toBe('');
            done();
        });
    });

    test('passes through all attributes from the xml response', (done) => {
        const xmlResult = makeXmlResult(TX_ID, {
            country: 'jpn',
            region: 'tokyo',
            city: 'shibuya',
            latitude: '35.6895',
            longitude: '139.6917',
        });
        tools.generateXMLResponseObject(xmlResult, TX_ID, QUERY_IP, (err, data) => {
            expect(err).toBe('');
            expect(data['country']).toBe('jpn');
            expect(data['latitude']).toBe('35.6895');
            expect(data['longitude']).toBe('139.6917');
            done();
        });
    });
});