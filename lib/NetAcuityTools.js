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

const validator = require("validator");
const ipaddr = require("ipaddr.js");

exports.isValidFeatureCode = function(featureCode) {
    return validator.isInt(featureCode + '', {min:3, max:99})
}

exports.isValidApiId = function(apiId) {
    return validator.isInt(apiId + '', {min:0, max:127});
}

exports.isValidDelay = function(delayMillis) {
    return validator.isInt(delayMillis + '', {min:0});
}

// The XML protocol embeds transactionId inside an XML attribute; a
// transactionId containing any of these characters could break out of the
// attribute and inject arbitrary XML.
exports.isValidXmlTransactionId = function(transactionId) {
    return !/["<>&]/.test(transactionId + '');
}

exports.determineIpType = function(ipAddress) {
    let type;
    if(validator.isIP(ipAddress, 4)) {
        type = 4;
    } else if (validator.isIP(ipAddress, 6)) {
        type = 6;
    }
    return type;
}

// Compares two IP address literals for semantic equality rather than textual
// equality, so a compressed IPv6 form (e.g. "2001:db8::1") and its fully
// expanded equivalent are recognized as the same address. An IPv4 literal is
// never treated as equal to an IPv4-mapped IPv6 literal (e.g. "192.0.2.1" vs.
// "::ffff:192.0.2.1") -- the two address families are kept distinct. Falls
// back to false, rather than throwing, for non-string or malformed input.
exports.ipsEqual = function(a, b) {
    if (a === b) {
        return true;
    }
    if (typeof a !== "string" || typeof b !== "string") {
        return false;
    }
    if (!ipaddr.isValid(a) || !ipaddr.isValid(b)) {
        return false;
    }
    const parsedA = ipaddr.parse(a);
    const parsedB = ipaddr.parse(b);
    if (parsedA.kind() !== parsedB.kind()) {
        return false;
    }
    return parsedA.toNormalizedString() === parsedB.toNormalizedString();
}


exports.generateXMLResponseObject = function(response, transactionId, queryIp, callback) {
    if (!response || !response.response || !response.response.$) {
        const err = "response is malformed: missing <response> root element.";
        callback(err, "");
        return;
    }
    const xmlObject = response.response.$; //accessing the data parsed after xml2js does its work
    if(!exports.ipsEqual(xmlObject["ip"], queryIp)) {
        const err = "response IP does not match query IP.";
        callback(err, "");
        return;
    }
    if(xmlObject["trans-id"] !== transactionId) {
        const err = "response transaction-id does not match request transaction-id.";
        callback(err, "");
        return;
    }
    callback("", xmlObject);
}