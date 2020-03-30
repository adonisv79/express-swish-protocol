import { IncomingHttpHeaders } from 'http';
import { HandshakeServer, SwishHeaders } from 'swish-protocol';
import { Request, Response, NextFunction } from 'express';

let self: any;
const serverHS = new HandshakeServer();

export interface SwishRequest extends Request {
  swish: {
    sessionId: string;
    nextPubKey: string;
    nextPrivate: string;
    createdDate: number;
  };
}

export interface SwishResponse extends Response {
  sendSwish(body: object): void;
}
function getSwishFromReqHeaders(reqHeaders: IncomingHttpHeaders): SwishHeaders {
  const headers: SwishHeaders = {
    swishAction: '', swishIV: '', swishKey: '', swishNextPublic: '', swishSessionId: '',
  };
  if (typeof reqHeaders['swish-action'] === 'string') {
    headers.swishAction = reqHeaders['swish-action'];
  }
  if (typeof reqHeaders['swish-iv'] === 'string') {
    headers.swishIV = reqHeaders['swish-iv'];
  }
  if (typeof reqHeaders['swish-key'] === 'string') {
    headers.swishKey = reqHeaders['swish-key'];
  }
  if (typeof reqHeaders['swish-next'] === 'string') {
    headers.swishNextPublic = reqHeaders['swish-next'];
  }
  if (typeof reqHeaders['swish-sess-id'] === 'string') {
    headers.swishSessionId = reqHeaders['swish-sess-id'];
  }
  return headers;
}

function validateRequestSession(req: SwishRequest): void {
  if (req.swish === undefined) {
    throw new Error('Swish is missing from request.');
  } else if (req.swish === undefined || req.swish.sessionId === '') {
    throw new Error('Swish SessionID missing from request.');
  } else if (
    (req.headers['swish-action'] || '').toString().toLowerCase() !== 'handshake_init'
    && (req.swish.nextPrivate === undefined || req.swish.createdDate === undefined)
  ) {
    throw new Error('SWISH_SESSION_HANDSHAKE_NULL. Client should perform handshake first');
  }
}

function handleHandshake(req: SwishRequest, res: SwishResponse): any {
  const swishHeaders = getSwishFromReqHeaders(req.headers);
  if (swishHeaders.swishAction !== 'handshake_init') {
    throw new Error('SWISH_HANDSHAKE_INVALID_ACTION');
  }
  swishHeaders.swishSessionId = (req.swish.sessionId || '').toString();
  const result = serverHS.handleHandshakeRequest(swishHeaders);
  if (req.swish) {
    req.swish.nextPrivate = result.decrypt.nextPrivate;
    req.swish.createdDate = result.decrypt.createdDate;
  }

  const newHeaders = {
    'swish-action': result.headers.swishAction,
    'swish-iv': result.headers.swishIV,
    'swish-key': result.headers.swishKey,
    'swish-next': result.headers.swishNextPublic,
    'swish-sess-id': result.headers.swishSessionId,
  };
  res.set(newHeaders);
  res.send(result.body);
}

function handleSwishRequest(req: SwishRequest, res: SwishResponse, next: NextFunction): any {
  // get the decrypted request
  const headers = getSwishFromReqHeaders(req.headers);
  if (req.swish) {
    const privateKey = Buffer.from(req.swish.nextPrivate, 'utf8');
    const passphrase = req.swish.createdDate.toString();
    const decResult = serverHS.decryptRequest(headers, req.body, privateKey, passphrase);
    req.body = decResult.body;
    req.swish.nextPubKey = decResult.nextPubKey;
  }
  return next();
}

export class Swish {
  private onSessionCreate: Function;

  private onSessionRetrieve: Function;

  private onSessionDestroy: Function;

  constructor(onSessionCreate: Function, onSessionRetrieve: Function, onSessionDestroy: Function) {
    self = this;
    this.onSessionCreate = onSessionCreate;
    this.onSessionRetrieve = onSessionRetrieve;
    this.onSessionDestroy = onSessionDestroy;
  }

  loadSession(req: SwishRequest) {
    const sessionId = req.headers['swish-sess-id'];
    if (!sessionId) { // create a new ID
      req.swish = this.onSessionCreate();
    } else { // load it
      req.swish = this.onSessionRetrieve(sessionId);
    }
  }

  middleware(req: SwishRequest, res: SwishResponse, next: NextFunction): void {
    try {
      self.loadSession(req);
      validateRequestSession(req);
      // reconstruct the new sendSwish extended function using the new keys and session states
      res.sendSwish = (body: object = {}): any => {
        const result = serverHS.encryptResponse(
          req.swish.sessionId, body, req.swish.nextPubKey,
        );
        req.swish.createdDate = result.decrypt.createdDate;
        req.swish.nextPrivate = result.decrypt.nextPrivate;
        const newHeaders = {
          'swish-action': result.headers.swishAction,
          'swish-iv': result.headers.swishIV,
          'swish-key': result.headers.swishKey,
          'swish-next': result.headers.swishNextPublic,
          'swish-sess-id': result.headers.swishSessionId,
        };
        res.set(newHeaders);
        return res.send(result.body);
      };

      if (req.headers['swish-action'] !== undefined) {
        if (req.headers['swish-action'] === 'request_basic') {
          handleSwishRequest(req, res, next);
        } else if (req.headers['swish-action'] === 'handshake_init') {
          handleHandshake(req, res);
        } else {
          throw new Error(`SWISH_ACTION_INVALID:${req.headers.swish_action}`);
        }
      }
    } catch (err) {
      res.status(401).send(JSON.stringify({ error: err.message }));
    }
  }
}
