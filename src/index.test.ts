/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Request, Response, NextFunction } from 'express'
import { SwishServer } from 'swish-protocol'
import { mocked } from 'ts-jest/dist/utils/testing'
import {
  OnSessionCreateCallback, OnSessionDestroyCallback, OnSessionRetrieveCallback, OnSessionUpdateCallback, ExpressSwish, SwishSessionObject,
} from './index'

let onSessionCreateCallback: OnSessionCreateCallback = jest.fn()
let onSessionRetrieveCallback: OnSessionRetrieveCallback = jest.fn()
const onSessionUpdateCallback: OnSessionUpdateCallback = jest.fn()
let onSessionDestroyCallback: OnSessionDestroyCallback = jest.fn()
let expressSwish:ExpressSwish
let mockRequest: Partial<Request>
const mockResponse: Partial<Response> = {
  send: jest.fn(),
  set: jest.fn(),
  status: function statusMock(): Response { return this as Response },
}
let nextFunction: NextFunction

jest.mock('swish-protocol/dist/src/SwishServer')
mocked(SwishServer).handleHandshakeRequest.mockImplementation(() => ({
  body: { encBody: 'somEncryptedStuff==', isJson: true },
  decrypt: { createdDate: 13, nextPrivate: '' },
  headers: { swishAction: 'some-action', swishSessionId: 'adonisv79', swishToken: 'somevalidiv,somevalidkey.somevalidrsapubkey' },
}))
mocked(SwishServer).decryptRequest.mockImplementation(() => ({
  body: { testval: 'helloWorld' },
  nextPubKey: '',
}))
mocked(SwishServer).encryptResponse.mockImplementation(() => ({
  body: { encBody: 'somEncryptedStuff==', isJson: true },
  headers: { swishToken: 'blahblahblah.blahblahblah.blahblahblah', swishSessionId: 'adonisv79', swishAction: 'some_valid_action' },
  decrypt: { nextPrivate: 'somevaliddecryptkey', createdDate: 21365127 },
  nextPubKey: 'somevalidpubkey',
}))

describe('ExpressSwish.middleware', () => {
  beforeEach(() => {
    onSessionCreateCallback = jest.fn()
    nextFunction = jest.fn()
    mockResponse.send = jest.fn()
    mockResponse.set = jest.fn()
  })

  test('should call next() with error SWISH_ACTION_UNDEFINED if header for it is falsey', async () => {
    mockRequest = { headers: {} }
    expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
    await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
    expect(nextFunction).toBeCalledTimes(1)
    expect(nextFunction).toHaveBeenCalledWith(new Error('SWISH_ACTION_UNDEFINED'))
  })

  describe('handshake_init', () => {
    test('should throw HANDSHAKE_CREATE_NOT_IMPLEMENTED the SessionCreateCallback is not properly implemented ', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_init' } }
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(nextFunction).toBeCalledTimes(1)
      expect(nextFunction).toHaveBeenCalledWith(new Error('HANDSHAKE_CREATE_NOT_IMPLEMENTED'))
      expect(onSessionCreateCallback).toBeCalledTimes(1)
    })

    test('should send the encrypted response', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_init' } }
      const date = new Date()
      onSessionCreateCallback = jest.fn(async (): Promise<SwishSessionObject> => ({ sessionId: date.getTime().toString(), createdDate: date.getTime() }))
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(onSessionCreateCallback).toBeCalledTimes(1)
      expect(mockResponse.set).toBeCalledTimes(1)
      expect(mockResponse.set).toHaveBeenCalledWith({
        'swish-action': 'some-action',
        'swish-sess-id': 'adonisv79',
        'swish-token': 'somevalidiv,somevalidkey.somevalidrsapubkey',
      })
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith({ encBody: 'somEncryptedStuff==', isJson: true })
    })
  })

  describe('handshake_destroy', () => {
    test('should throw SWISH_SESSION_ID_NOT_PROVIDED if request header is missing swish-sess-id', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_destroy' } }
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith('SWISH_SESSION_ID_NOT_PROVIDED')
    })

    test('should throw SWISH_SESSION_HANDSHAKE_REQUIRED if the session id does not have an active handshake', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_destroy', 'swish-sess-id': 'adonisv79' } }
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith('SWISH_SESSION_HANDSHAKE_REQUIRED')
    })

    test('should throw SWISH_SESSION_HANDSHAKE_CORRUPTED if the session id mismatches', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_destroy', 'swish-sess-id': 'adonisv79' } }
      const date = new Date()
      onSessionRetrieveCallback = jest.fn(async (): Promise<SwishSessionObject> => ({
        sessionId: 'bytecommander', createdDate: date.getTime(), nextPrivate: 'someprivatekey', nextPublic: 'somepublickey',
      }))
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith('SWISH_SESSION_HANDSHAKE_CORRUPTED')
    })

    test('should throw HANDSHAKE_DESTROY_FAILED if the onSessionDestroyCallback is not properly handled', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_destroy', 'swish-sess-id': 'adonisv79' } }
      const date = new Date()
      onSessionRetrieveCallback = jest.fn(async (): Promise<SwishSessionObject> => ({
        sessionId: 'adonisv79', createdDate: date.getTime(), nextPrivate: 'someprivatekey', nextPublic: 'somepublickey',
      }))
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith('HANDSHAKE_DESTROY_FAILED')
    })

    test('should throw HANDSHAKE_DESTROY_FAILED if the onSessionDestroyCallback is not properly handled', async () => {
      mockRequest = { headers: { 'swish-action': 'handshake_destroy', 'swish-sess-id': 'adonisv79' } }
      const date = new Date()
      onSessionRetrieveCallback = jest.fn(async (): Promise<SwishSessionObject> => ({
        sessionId: 'adonisv79', createdDate: date.getTime(), nextPrivate: 'someprivatekey', nextPublic: 'somepublickey',
      }))
      onSessionDestroyCallback = jest.fn(async (): Promise<boolean> => (true))
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(mockResponse.send).toBeCalledTimes(1)
      expect(mockResponse.send).toHaveBeenCalledWith({ encBody: 'somEncryptedStuff==', isJson: true })
    })
  })

  describe('any other swish-action values...', () => {
    test('should throw HANDSHAKE_DESTROY_FAILED if the onSessionDestroyCallback is not properly handled', async () => {
      mockRequest = { headers: { 'swish-action': 'other_actions', 'swish-sess-id': 'adonisv79' } }
      const date = new Date()
      onSessionRetrieveCallback = jest.fn(async (): Promise<SwishSessionObject> => ({
        sessionId: 'adonisv79', createdDate: date.getTime(), nextPrivate: 'someprivatekey', nextPublic: 'somepublickey',
      }))
      onSessionDestroyCallback = jest.fn(async (): Promise<boolean> => (true))
      expressSwish = new ExpressSwish(onSessionCreateCallback, onSessionRetrieveCallback, onSessionUpdateCallback, onSessionDestroyCallback)
      await expressSwish.middleware(mockRequest as Request, mockResponse as Response, nextFunction)
      expect(nextFunction).toBeCalledTimes(1)
      expect(mockRequest.body).toEqual({ testval: 'helloWorld' })
    })
  })
})
