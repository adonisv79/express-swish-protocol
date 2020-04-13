import express, { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import { Swish, swishSessionObject } from '../src/index';

const sess: any = {};

/** our simple session creation event handler */
async function onSessionCreate(): Promise<swishSessionObject> {
  const d = new Date();
  const sessionId = d.getTime().toString();
  sess[sessionId] = {
    swish: { sessionId },
  };
  console.log(`Session '${sessionId}' created.`);
  return sess[sessionId].swish;
}

/** our simple session retrieve event handler */
async function onSessionRetrieve(sessionId: string): Promise<swishSessionObject> {
  console.log(`Session '${sessionId}' retrieved.`);
  return (sess[sessionId] || {}).swish;
}

/** our simple session update event handler */
async function onSessionUpdate(sessionId: string, delta: swishSessionObject): Promise<boolean> {
  sess[sessionId].swish = { ...sess[sessionId].swish, ...delta };
  console.log(`Session '${sessionId}' updated...`);
  return true;
}

/** our simple session destroy event handler */
async function onSessionDestroy(sessionId: string): Promise<boolean> {
  delete sess[sessionId];
  console.log(`Session '${sessionId}' has been terminated.`);
  return true;
}

// initiate our swish instance
const swish = new Swish(onSessionCreate, onSessionRetrieve, onSessionUpdate, onSessionDestroy);

// Load our basic express app
const app = express();
app.use(bodyParser.json());

// And attach our swish server middleware for anything under the '/api' route
app.use('/api', swish.middleware);

// Add some sample routes
app.post('/api/success', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /test/success');
  await res.sendSwish(req, res, next, { status: 'success' });
});

app.post('/api/err', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /test/err');
  await res.status(403).sendSwish(req, res, next, { status: 'error', message: 'THIS IS A TESTERROR' });
});

// and start our project
app.listen(3000, () => console.log('Example app listening on port 3000'));
