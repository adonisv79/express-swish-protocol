import { Request, Response, NextFunction } from 'express';
import { swishSessionObject, Swish } from '../src/index';

import express = require('express');
import bodyParser = require('body-parser');
const sess: any = {};
function onSessionCreate(): swishSessionObject {
  const d = new Date();
  const sessionId = d.getTime().toString();
  sess[sessionId] = {
    swish: { sessionId },
  };
  console.log(`Session '${sessionId}' created.`);
  return sess[sessionId].swish;
}

function onSessionRetrieve(sessionId: string): swishSessionObject {
  console.log(`Session '${sessionId}' retrieved.`);
  return (sess[sessionId] || {}).swish;
}

function onSessionUpdate(sessionId: string, delta: swishSessionObject): boolean {
  sess[sessionId].swish = { ...sess[sessionId].swish, ...delta };
  console.log(`Session '${sessionId}' updated...`);
  return true;
}

function onSessionDestroy(sessionId: string): boolean {
  delete sess[sessionId];
  console.log(`Session '${sessionId}' has been terminated.`);
  return true;
}

function onSwishError(err: Error, req: Request, res: Response, next: express.NextFunction) {
  console.error(`Sending error '${err.message}'`);
  res.status(401).send(JSON.stringify({ error: err.message }));
}

const swish = new Swish(onSessionCreate, onSessionRetrieve, onSessionUpdate, onSessionDestroy, onSwishError);
const port = 3000;
const app = express();
app.use(bodyParser.json());

// use our swish server middleware
app.use(swish.middleware);

app.post('/test/success', (req: Request, res: Response) => {
  console.log('Received request for /test/success');
  res.sendSwish({ status: 'success' });
});

app.post('/test/err', (req: Request, res: Response) => {
  console.log('Received request for /test/err');
  res.status(403).sendSwish({ status: 'error', message: 'THIS IS A TESTERROR' });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
