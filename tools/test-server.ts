import express, { Request, Response, NextFunction } from 'express';
// import express from 'express';
import * as bodyParser from 'body-parser';
import { swishSessionObject, Swish } from '../src/index';

// import express = require('express');
const sess: any = {};

async function onSessionCreate(): Promise<swishSessionObject> {
  const d = new Date();
  const sessionId = d.getTime().toString();
  sess[sessionId] = {
    swish: { sessionId },
  };
  console.log(`Session '${sessionId}' created.`);
  return sess[sessionId].swish;
}

async function onSessionRetrieve(sessionId: string): Promise<swishSessionObject> {
  console.log(`Session '${sessionId}' retrieved.`);
  return (sess[sessionId] || {}).swish;
}

async function onSessionUpdate(sessionId: string, delta: swishSessionObject): Promise<boolean> {
  sess[sessionId].swish = { ...sess[sessionId].swish, ...delta };
  console.log(`Session '${sessionId}' updated...`);
  return true;
}

async function onSessionDestroy(sessionId: string): Promise<boolean> {
  delete sess[sessionId];
  console.log(`Session '${sessionId}' has been terminated.`);
  return true;
}

const swish = new Swish(onSessionCreate, onSessionRetrieve, onSessionUpdate, onSessionDestroy);
const port = 3000;
const app = express();
app.use(bodyParser.json());

// use our swish server middleware
app.use(swish.middleware);

app.post('/test/success', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /test/success');
  await res.sendSwish(req, res, next, { status: 'success' });
});

app.post('/test/err', async (req: Request, res: Response, next: NextFunction) => {
  console.log('Received request for /test/err');
  await res.status(403).sendSwish(req, res, next, { status: 'error', message: 'THIS IS A TESTERROR' });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
