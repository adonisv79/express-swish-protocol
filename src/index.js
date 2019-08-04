'use-strict';

const { HandshakeServer } = require('swish-protocol');

const serverHS = new HandshakeServer();

function getSwishFromReqHeaders(reqHeaders) {
  if (!reqHeaders.swish_action || typeof reqHeaders.swish_action !== 'string') {
    throw new Error('SWISH_INVALID_ACTION');
  } else if (!reqHeaders.swish_iv || typeof reqHeaders.swish_iv !== 'string') {
    throw new Error('SWISH_INVALID_INITVECTOR');
  } else if (!reqHeaders.swish_key || typeof reqHeaders.swish_key !== 'string') {
    throw new Error('SWISH_INVALID_AESKEY');
  } else if (!reqHeaders.swish_next || typeof reqHeaders.swish_next !== 'string') {
    throw new Error('SWISH_INVALID_NEXTPUB');
  }

  return {
    swish_action: reqHeaders.swish_action,
    swish_iv: reqHeaders.swish_iv,
    swish_key: reqHeaders.swish_key,
    swish_next: reqHeaders.swish_next,
    swish_sess_id: reqHeaders.swish_sess_id,
  };
}

function handleHandshake(req, res) {
  const headers = getSwishFromReqHeaders(req.headers);
  if (headers.swish_action !== 'handshake_init') {
    throw new Error('SWISH_HANDSHAKE_INVALID_ACTION');
  } else if (req.session === undefined) {
    throw new Error('req.session missing. use session middlewares like express-session');
  } else if (req.sessionID === undefined || req.sessionID === '') {
    throw new Error('req.sessionID missing. Please set this via genid for express-session');
  }
  headers.swish_sess_id = req.sessionID;
  const result = serverHS.handleHandshakeRequest(headers);
  req.session.swishdec = result.decrypt;
  res.set(result.headers);
  res.send(result.body);
}

function handleSwishRequest(req, res, next) {
  // get the decrypted request
  const headers = getSwishFromReqHeaders(req.headers);
  if (req.sessionID !== headers.swish_sess_id) {
    // there is discrepancy in session identifiers
    return res.status(401).send(JSON.stringify({ error: 'SWISH_SESSION_INVALID' }));
  } else if (req.session === undefined || req.session.swishdec === undefined
    || req.session.swishdec.next_prv === undefined
    || req.session.swishdec.created_date === undefined) {
    // should do handshake first
    return res.status(401).send(JSON.stringify({ error: 'SWISH_SESSION_HANDSHAKE_NULL' }));
  }
  const privateKey = req.session.swishdec.next_prv;
  const passphrase = req.session.swishdec.created_date;
  const decResult = serverHS.decryptRequest(headers, req.body, privateKey, passphrase);
  req.body = decResult.body;
  req.session.next_req_pub = decResult.next_pub;
  return next();
}

module.exports.SwishServer = (req, res, next) => {
  res.sendSwish = function sendSwish(body) {
    let newBody;
    if (body === undefined || body === '') {
      newBody = JSON.stringify({}); // always return a json even empty
    } else if (req.headers !== undefined && typeof req.headers.swish_sess_id === 'string'
    && req.session !== undefined && req.session.next_req_pub !== undefined) {
      const response = serverHS.encryptResponse(req.headers.swish_sess_id,
        body, req.session.next_req_pub);
      req.session.swishdec = response.decrypt;
      newBody = response.body;
      res.set(response.headers);
    }
    return res.send(newBody);
  };

  if (req.headers.swish_action !== undefined) {
    if (req.headers.swish_action === 'request_basic') {
      handleSwishRequest(req, res, next);
    } else if (req.headers.swish_action === 'handshake_init') {
      handleHandshake(req, res);
    } else {
      throw new Error(`SWISH_ACTION_INVALID:${req.headers.swish_action}`);
    }
  }
};
