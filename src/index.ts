import { IncomingHttpHeaders } from 'http';
import { HandshakeServer, SwishHeaders } from 'swish-protocol';
import { Request, Response, NextFunction } from 'express';

let self: any;
const serverHS = new HandshakeServer();

export type swishSessionObject = {
  sessionId: string;
  nextPubKey: string;
  nextPrivate: string;
  createdDate: number;
}


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      swish: swishSessionObject;
    }
    interface Response {
      sendSwish(body: object): void;
    }
  }
}

//export interface SwishRequest extends Request {
//  swish: swishSessionObject;
//}

//export interface SwishResponse extends Response {
//  sendSwish(body: object): void;
// }
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

function validateRequestSession(req: Request): void {
  if (req.swish === undefined) {
    throw new Error('SWISH_SESSION_HANDSHAKE_ERROR: Handshake may not have initialized...');
  } else if (req.swish === undefined || req.swish.sessionId === '') {
    throw new Error('SWISH_SESSION_HANDSHAKE_ERROR: Handshake session values missing or not loaded properly.');
  } else if (
    (req.headers['swish-action'] || '').toString().toLowerCase() !== 'handshake_init'
    && (req.swish.nextPrivate === undefined || req.swish.createdDate === undefined)
  ) {
    throw new Error('SWISH_SESSION_ACCESS_ERROR: Client should perform handshake first');
  }
}

type onSessionCreateCallback = () => swishSessionObject;
type onSessionRetrieveCallback = (sessionId: string) => swishSessionObject;
type onSessionUpdateCallback = (sessionId: string, delta: swishSessionObject) => boolean;
type onSessionDestroyCallback = (sessionId: string) => boolean;
type onErrorCallback = (err: Error, req: Request, res: Response, next: NextFunction) => void;

export class Swish {
  private createSession: onSessionCreateCallback;

  private retrieveSession: onSessionRetrieveCallback;

  private updateSession: onSessionUpdateCallback;

  private destroySession: onSessionDestroyCallback;

  private error: onErrorCallback;

  constructor(
    onSessionCreate: onSessionCreateCallback,
    onSessionRetrieve: onSessionRetrieveCallback,
    onSessionUpdate: onSessionUpdateCallback,
    onSessionDestroy: onSessionDestroyCallback,
    onError: onErrorCallback,
  ) {
    this.createSession = onSessionCreate;
    this.retrieveSession = onSessionRetrieve;
    this.updateSession = onSessionUpdate;
    this.destroySession = onSessionDestroy;
    this.error = onError;
    self = this;
  }

  loadSession(req: Request) {
    const sessionId = (req.headers['swish-sess-id'] || '').toString();
    if (sessionId === '') { // create a new ID
      req.swish = self.createSession();
    } else { // load it
      req.swish = self.retrieveSession(sessionId);
    }
  }

  handleHandshake(req: Request, res: Response): any {
    const swishHeaders = getSwishFromReqHeaders(req.headers);
    if (swishHeaders.swishAction !== 'handshake_init') {
      throw new Error('SWISH_HANDSHAKE_INVALID_ACTION');
    }
    swishHeaders.swishSessionId = (req.swish.sessionId || '').toString();
    const result = serverHS.handleHandshakeRequest(swishHeaders);
    if (req.swish) {
      self.updateSession(req.swish.sessionId, {
        nextPrivate: result.decrypt.nextPrivate,
        createdDate: result.decrypt.createdDate,
      });
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

  handleSwishRequest(req: Request, res: Response, next: NextFunction): any {
    // get the decrypted request
    const headers = getSwishFromReqHeaders(req.headers);
    if (req.swish) {
      const privateKey = req.swish.nextPrivate;
      const passphrase = req.swish.createdDate.toString();
      const decResult = serverHS.decryptRequest(headers, req.body, privateKey, passphrase);
      req.body = decResult.body;

      self.updateSession(req.swish.sessionId, {
        nextPubKey: decResult.nextPubKey,
      });
    }
    return next();
  }

  handleSwishSessionDestroy(req: Request, res: Response) {
    if (self.destroySession(req.swish.sessionId)) {
      return res.send({ code: 200, action: 'session_destroy' });
    }
    throw new Error('SESSION_DESTROY_FAILED');
  }

  middleware(req: Request, res: Response, next: NextFunction): void {
    try {
      self.loadSession(req);
      validateRequestSession(req);
      // reconstruct the new sendSwish extended function using the new keys and session states
      res.sendSwish = (body: object = {}): void => {
        try {
          self.loadSession(req);
          const result = serverHS.encryptResponse(
            req.swish.sessionId, body, req.swish.nextPubKey,
          );
          self.updateSession(req.swish.sessionId, {
            nextPrivate: result.decrypt.nextPrivate,
            createdDate: result.decrypt.createdDate,
          });
          const newHeaders = {
            'swish-action': result.headers.swishAction,
            'swish-iv': result.headers.swishIV,
            'swish-key': result.headers.swishKey,
            'swish-next': result.headers.swishNextPublic,
            'swish-sess-id': result.headers.swishSessionId,
          };
          res.set(newHeaders);
          res.send(result.body);
        } catch (err) {
          self.error(err, req, res, next);
        }
      };

      if (req.headers['swish-action'] !== undefined) {
        if (req.headers['swish-action'] === 'request_basic') {
          self.handleSwishRequest(req, res, next);
        } else if (req.headers['swish-action'] === 'handshake_init') {
          self.handleHandshake(req, res);
        } else if (req.headers['swish-action'] === 'session_destroy') {
          self.handleSwishSessionDestroy(req, res);
        } else {
          throw new Error(`SWISH_ACTION_INVALID:${req.headers.swish_action}`);
        }
      }
    } catch (err) {
      self.error(err, req, res, next);
    }
  }
}
