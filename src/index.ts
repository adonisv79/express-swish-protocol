import { IncomingHttpHeaders } from 'http'
import HtmlError, { serverErrorCodes, clientErrorCodes } from 'html-codes'
import { SwishServer, SwishHeaders } from 'swish-protocol'
import { Request, Response, NextFunction } from 'express'

let self: ExpressSwish // references the instance of ExpressSwish used for sendSwish

/** Defines the swish object values */
export type SwishSessionObject = {
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
      swish: SwishSessionObject;
      sessionID: string;
    }
    interface Response {
      /**
       * Send response back with swish encryption'
       * @param req The expressJs request object
       * @param res The expressJs response object
       * @param body The response body to send (currently uses objects only)
       */
      sendSwish(req: Request, res: Response, next: NextFunction, body: Record<string, unknown>): void;
    }
  }
}

function getSwishHeadersFromReqHeaders(reqHeaders: IncomingHttpHeaders): SwishHeaders {
  const headers: SwishHeaders = {
    swishAction: '', swishToken: '', swishSessionId: '',
  }
  if (typeof reqHeaders['swish-action'] === 'string') {
    headers.swishAction = reqHeaders['swish-action']
  }
  if (typeof reqHeaders['swish-token'] === 'string') {
    headers.swishToken = reqHeaders['swish-token']
  }
  if (typeof reqHeaders['swish-sess-id'] === 'string') {
    headers.swishSessionId = reqHeaders['swish-sess-id']
  }
  return headers
}

function validateRequestSession(req: Request): void {
  if (
    (req.headers['swish-action'] || '').toString().toLowerCase() !== 'handshake_init'
    && (req.swish.nextPrivate === undefined || req.swish.createdDate === undefined)
  ) {
    throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_TRANSACTION_INVALID_CHAIN')
  }
}

function transformSwishRequest(req: Request) {
  if (!req.swish || !req.headers) {
    throw new Error('EXPRESS_SWISH_REQUEST_DECRYPTION_FAILED')
  }
  const headers = getSwishHeadersFromReqHeaders(req.headers)
  if (!req.swish.nextPrivate) {
    throw new HtmlError(clientErrorCodes.forbidden, 'SWISH_PRIVATE_KEY_UNDEFINED')
  }
  const privateKey = req.swish.nextPrivate
  const passphrase = req.swish.createdDate.toString()
  const decryptedRequest = SwishServer.decryptRequest(headers, req.body, privateKey, passphrase)
  return {
    decryptedRequest,
    headers,
  }
}

/** A callback function that gets triggered whenever a user session needs to be created */
export type OnSessionCreateCallback = () => Promise<SwishSessionObject>
/** A callback function that gets triggered whenever a user session needs to be retrieved */
export type OnSessionRetrieveCallback = (sessionId: string) => Promise<SwishSessionObject>
/** A callback function that gets triggered whenever a user session needs to be updated */
export type OnSessionUpdateCallback = (sessionId: string, delta: Partial<SwishSessionObject>) => Promise<boolean>
/** A callback function that gets triggered whenever a user session needs to be deleted */
export type OnSessionDestroyCallback = (sessionId: string, data: Record<string, unknown>) => Promise<boolean>

/** The expressjs Swish client protocol implementation */
export class ExpressSwish {
  private createSession: OnSessionCreateCallback

  private retrieveSession: OnSessionRetrieveCallback

  private updateSession: OnSessionUpdateCallback

  private destroySession: OnSessionDestroyCallback

  /**
   * Creates a new instance of an ExpressJS Swish protocol middleware
   * @param onSessionCreate The callback function triggered whenever a user session needs to be created
   * @param onSessionRetrieve The callback function triggered whenever a user session needs to be retrieved
   * @param onSessionUpdate The callback function triggered whenever a user session needs to be updated
   * @param onSessionDestroy The callback function triggered whenever a user session needs to be deleted
   */
  constructor(
    onSessionCreate: OnSessionCreateCallback,
    onSessionRetrieve: OnSessionRetrieveCallback,
    onSessionUpdate: OnSessionUpdateCallback,
    onSessionDestroy: OnSessionDestroyCallback,
  ) {
    this.createSession = onSessionCreate
    this.retrieveSession = onSessionRetrieve
    this.updateSession = onSessionUpdate
    this.destroySession = onSessionDestroy
    self = this
  }

  /**
   * Loads the session or create it if not yet set
   * @param req The expressJs request object
   */
  protected async loadSession(req: Request): Promise<void> {
    const sessionId = (req.headers['swish-sess-id'] || '').toString()
    if (!sessionId) { // create a new ID
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_SESSION_ID_NOT_PROVIDED')
    }
    req.swish = await this.retrieveSession(sessionId)

    if (req.swish === undefined) {
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_SESSION_HANDSHAKE_REQUIRED')
    } else if (req.swish.sessionId !== sessionId) {
      throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_SESSION_HANDSHAKE_CORRUPTED')
    }
  }

  /**
   * Handles a client handshake request. This is automatically triggered when a client
   * header contains a 'swish-action' with value of 'handshake_init'
   * @param req The expressJs request object
   * @param res The expressJs response object
   */
  protected async handleHandshake(req: Request, res: Response): Promise<void> {
    const swishHeaders = getSwishHeadersFromReqHeaders(req.headers)
    req.swish = await this.createSession()
    if (!req.swish) { throw new Error('HANDSHAKE_CREATE_NOT_IMPLEMENTED') }
    swishHeaders.swishSessionId = req.swish.sessionId
    const result = SwishServer.handleHandshakeRequest(swishHeaders)
    await this.updateSession(req.swish.sessionId, {
      nextPrivate: result.decrypt.nextPrivate,
      createdDate: result.decrypt.createdDate,
    })
    res.set({
      'swish-action': result.headers.swishAction,
      'swish-token': result.headers.swishToken,
      'swish-sess-id': result.headers.swishSessionId,
    })
    res.send(result.body)
  }

  /**
   * Handles a swish request. This is automatically triggered when a client
   * header contains a 'swish-action' with any other values
   * @param req The expressJs request object
   * @param res The expressJs response object
   * @param next The expressJs 'Next' function
   */
  protected async handleSwishRequest(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (req.swish) {
      const decResult = transformSwishRequest(req)
      req.body = decResult.decryptedRequest.body

      await this.updateSession(req.swish.sessionId, {
        nextPublic: decResult.decryptedRequest.nextPubKey,
      })
    }
    next()
  }

  /**
   * Handles a swish destroy session request. This is automatically triggered when a client
   * header contains a 'swish-action' with value of 'handshake_destroy'
   * @param req The expressJs request object
   * @param res The expressJs response object
   */
  protected async handleSwishSessionDestroy(req: Request, res: Response): Promise<void> {
    if (req.swish) {
      const sReq = transformSwishRequest(req)
      if (await this.destroySession(req.swish.sessionId, sReq.decryptedRequest.body as Record<string, unknown>)) {
        const result = SwishServer.encryptResponse(sReq.headers.swishSessionId, { code: 200 }, sReq.decryptedRequest.nextPubKey)
        res.set({
          'swish-action': 'handshake_destroy',
          'swish-token': result.headers.swishToken,
          'swish-sess-id': result.headers.swishSessionId,
        })
        res.send(result.body)
        return undefined
      }
    }
    throw new HtmlError(serverErrorCodes.internalServer, 'HANDSHAKE_DESTROY_FAILED')
  }

  /**
   * The expressJS middleware to use.
   * @param req The expressJs request object
   * @param res The expressJs response object
   * @param next The expressJs 'Next' function
   */
  // eslint-disable-next-line class-methods-use-this
  async middleware(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // reconstruct the new sendSwish extended function using the new keys and session states
      res.sendSwish = async (reqX: Request, resX: Response, nextX: NextFunction, body: Record<string, unknown> = {}): Promise<void> => {
        try {
          await self.loadSession(reqX)
          if (!reqX.swish.nextPublic) {
            throw new HtmlError(clientErrorCodes.unauthorized, 'SWISH_PUBLIC_KEY_UNDEFINED')
          }
          const result = SwishServer.encryptResponse(
            reqX.swish.sessionId, body, reqX.swish.nextPublic,
          )
          // need to use a 'this' reference for this
          await self.updateSession(reqX.swish.sessionId, {
            nextPrivate: result.decrypt.nextPrivate,
            createdDate: result.decrypt.createdDate,
          })
          const newHeaders = {
            'swish-action': result.headers.swishAction,
            'swish-token': result.headers.swishToken,
            'swish-sess-id': result.headers.swishSessionId,
          }
          resX.set(newHeaders)
          resX.send(result.body)
        } catch (err) {
          nextX(err.message)
        }
      }

      if (req.headers['swish-action'] !== undefined) {
        if (req.headers['swish-action'] === 'handshake_init') {
          await self.handleHandshake(req, res)
        } else if (req.headers['swish-action'] === 'handshake_destroy') {
          await self.loadSession(req)
          validateRequestSession(req)
          await self.handleSwishSessionDestroy(req, res)
        } else {
          await self.loadSession(req)
          validateRequestSession(req)
          await self.handleSwishRequest(req, res, next)
        }
      } else {
        throw new Error('SWISH_ACTION_UNDEFINED')
      }
    } catch (err) {
      if (err instanceof HtmlError) {
        res.status(err.statusCode).send(err.message)
        return
      }
      next(err)
    }
  }
}
