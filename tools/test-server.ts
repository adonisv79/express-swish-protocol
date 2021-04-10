/* eslint-disable no-console */
import express, { Request, Response, NextFunction } from 'express'
import * as bodyParser from 'body-parser'
import { ExpressSwish, SwishSessionObject } from '../src/index'

const sess: Record<string, SwishSessionObject> = {}

/** our simple session creation event handler */
async function onSessionCreate(): Promise<SwishSessionObject> {
  const d = new Date()
  const sessionId = d.getTime().toString()
  sess[sessionId] = {
    sessionId,
    createdDate: d.getTime(),
  }
  console.log(`Session '${sessionId}' created.`)
  return sess[sessionId] as SwishSessionObject
}

/** our simple session retrieve event handler */
async function onSessionRetrieve(sessionId: string): Promise<SwishSessionObject> {
  console.log(`Session '${sessionId}' retrieved.`)
  return sess[sessionId] as SwishSessionObject
}

/** our simple session update event handler */
async function onSessionUpdate(sessionId: string, delta: Partial<SwishSessionObject>): Promise<boolean> {
  sess[sessionId] = { ...sess[sessionId], ...delta } as SwishSessionObject
  console.log(`Session '${sessionId}' updated...`)
  return true
}

/** our simple session destroy event handler */
async function onSessionDestroy(sessionId: string): Promise<boolean> {
  delete sess[sessionId]
  console.log(`Session '${sessionId}' has been terminated.`)
  return true
}

// initiate our swish instance
const expressSwish = new ExpressSwish(onSessionCreate, onSessionRetrieve, onSessionUpdate, onSessionDestroy)

// Load our basic express app
const app = express()
app.use(bodyParser.json())

// And attach our swish server middleware for anything under the '/sapi' route
app.use('/sapi', expressSwish.middleware)

// Add some sample routes
app.post('/sapi/test/success', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /sapi/test/success')
  await res.sendSwish(req, res, next, { status: 'success' })
})

app.post('/sapi/test/err', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /sapi/test/err')
  await res.status(403).sendSwish(req, res, next, { status: 'error', message: 'THIS IS A TESTERROR' })
})

// and start our project
app.listen(3000, () => console.log('Example app listening on port 3000'))
