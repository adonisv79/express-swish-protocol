import { IncomingHttpHeaders } from 'http';
import HtmlError, { serverErrorCodes, clientErrorCodes } from 'html-codes';
import { SwishServer, SwishHeaders } from 'swish-protocol';
import { Request, Response, NextFunction } from 'express';

let self: any;
const serverHS = new SwishServer();

/** Defines the swish object values */
export type swishSessionObject = {
  createdDate: number;
  sessionId: string;
  nextPublic?: string;
  nextPrivate?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The swish session object that is shared by the client each request */
      swish: swishSessionObject;
      sessionID: string;
    }
    interface Response {
      /**
       * Send response back with swish encryption'
       * @param req The expressJs request object
       * @param res The expressJs response object
       * @param body The response body to send (currently uses objects only)
       */
      sendSwish(req: Request, res: Response, next: NextFunction, body: object): void;
    }
  }
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

function validateRequestSession(req: Request): void {
  if (
    (req.headers['swish-action'] || '').toString().toLowerCase() !== 'handshake_init'
    && (req.swish.nextPrivate === undefined || req.swish.createdDate === undefined)
  ) {
    throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_TRANSACTION_INVALID_CHAIN');
  }
}

async function senddSwish(req: Request, res: Response, next: NextFunction, body: object = {}): Promise<void> {
  try {
    await self.loadSession(req);
    if (!req.swish.nextPublic) {
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_PUBLIC_KEY_UNDEFINED');
    }
    const result = serverHS.encryptResponse(
      req.swish.sessionId, body, req.swish.nextPublic,
    );
    await self.updateSession(req.swish.sessionId, {
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
    next(err.message);
  }
}

/** A callback function that gets triggered whenever a user session needs to be created */
export type onSessionCreateCallback = () => Promise<swishSessionObject>;
/** A callback function that gets triggered whenever a user session needs to be retrieved */
export type onSessionRetrieveCallback = (sessionId: string) => Promise<swishSessionObject>;
/** A callback function that gets triggered whenever a user session needs to be updated */
export type onSessionUpdateCallback = (sessionId: string, delta: swishSessionObject) => Promise<boolean>;
/** A callback function that gets triggered whenever a user session needs to be deleted */
export type onSessionDestroyCallback = (sessionId: string) => Promise<boolean>;

/** The expressjs Swish protocol implementation */
export class Swish {
  private createSession: onSessionCreateCallback;

  private retrieveSession: onSessionRetrieveCallback;

  private updateSession: onSessionUpdateCallback;

  private destroySession: onSessionDestroyCallback;

  /**
   * Creates a new instance of an ExpressJS Swish protocol middleware
   * @param onSessionCreate The callback function triggered whenever a user session needs to be created
   * @param onSessionRetrieve The callback function triggered whenever a user session needs to be retrieved
   * @param onSessionUpdate The callback function triggered whenever a user session needs to be updated
   * @param onSessionDestroy The callback function triggered whenever a user session needs to be deleted
   */
  constructor(
    onSessionCreate: onSessionCreateCallback,
    onSessionRetrieve: onSessionRetrieveCallback,
    onSessionUpdate: onSessionUpdateCallback,
    onSessionDestroy: onSessionDestroyCallback,
  ) {
    this.createSession = onSessionCreate;
    this.retrieveSession = onSessionRetrieve;
    this.updateSession = onSessionUpdate;
    this.destroySession = onSessionDestroy;
    self = this;
  }

  /**
   * Loads the session or create it if not yet set
   * @param req The expressJs request object
   */
  private async loadSession(req: Request): Promise<void> {
    const sessionId = (req.headers['swish-sess-id'] || '').toString();
    if (sessionId === '') { // create a new ID
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_HANDSHAKE_REQUIRED');
    }
    req.swish = await self.retrieveSession(sessionId);
    req.sessionID = sessionId;

    if (req.swish === undefined) {
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_SESSION_HANDSHAKE_MISSING');
    } else if (req.swish === undefined || req.swish.sessionId === '') {
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_SESSION_HANDSHAKE_NOT_LOADED');
    }
  }

  /**
   * Handles a client handshake request. This is automatically triggered when a client
   * header contains a 'swish-action' with value of 'handshake_init'
   * @param req The expressJs request object
   * @param res The expressJs response object
   */
  async handleHandshake(req: Request, res: Response): Promise<void> {
    const swishHeaders = getSwishFromReqHeaders(req.headers);
    if (swishHeaders.swishAction !== 'handshake_init') {
      throw new HtmlError(clientErrorCodes.forbidden, 'SWISH_HANDSHAKE_INVALID_ACTION');
    }

    req.swish = await self.createSession();
    req.sessionID = (req.swish.sessionId || '').toString();
    swishHeaders.swishSessionId = req.sessionID;

    const result = serverHS.handleHandshakeRequest(swishHeaders);
    if (req.swish) {
      await self.updateSession(req.swish.sessionId, {
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

  /**
   * Handles a swish request. This is automatically triggered when a client
   * header contains a 'swish-action' with value of 'request_basic'
   * @param req The expressJs request object
   * @param res The expressJs response object
   * @param next The expressJs 'Next' function
   */
  async handleSwishRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    // get the decrypted request
    const headers = getSwishFromReqHeaders(req.headers);
    if (req.swish) {
      if (!req.swish.nextPrivate) {
        throw new HtmlError(clientErrorCodes.forbidden, 'SWISH_PRIVATE_KEY_UNDEFINED');
      }
      const privateKey = req.swish.nextPrivate;
      const passphrase = req.swish.createdDate.toString();
      const decResult = serverHS.decryptRequest(headers, req.body, privateKey, passphrase);
      req.body = decResult.body;

      await self.updateSession(req.swish.sessionId, {
        nextPublic: decResult.nextPubKey,
      });
    }
    next();
  }

  /**
   * Handles a swish request. This is automatically triggered when a client
   * header contains a 'swish-action' with value of 'session_destroy'
   * @param req The expressJs request object
   * @param res The expressJs response object
   */
  async handleSwishSessionDestroy(req: Request, res: Response): Promise<void> {
    if (await self.destroySession(req.swish.sessionId)) {
      res.send({ code: 200, action: 'session_destroy' });
      return undefined;
    }
    throw new HtmlError(serverErrorCodes.internalServer, 'SESSION_DESTROY_FAILED');
  }

  /**
   * The expressJS middleware to use.
   * @param req The expressJs request object
   * @param res The expressJs response object
   * @param next The expressJs 'Next' function
   */
  async middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // reconstruct the new sendSwish extended function using the new keys and session states
      res.sendSwish = senddSwish;

      if (req.headers['swish-action'] !== undefined) {
        if (req.headers['swish-action'] === 'handshake_init') {
          await self.handleHandshake(req, res);
        } else if (req.headers['swish-action'] === 'request_basic') {
          await self.loadSession(req);
          validateRequestSession(req);
          await self.handleSwishRequest(req, res, next);
        } else if (req.headers['swish-action'] === 'session_destroy') {
          await self.loadSession(req);
          validateRequestSession(req);
          await self.handleSwishSessionDestroy(req, res);
        } else {
          throw new Error(`SWISH_ACTION_INVALID:${req.headers.swish_action}`);
        }
      } else {
        throw new Error('SWISH_ACTION_UNDEFINED');
      }
    } catch (err) {
      if (err instanceof HtmlError) {
        res.status(err.statusCode).send(err.message);
        return;
      }
      next(err);
    }
  }
}
