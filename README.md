# express-swish-protocol
SWISH (Secured Web Iterating Session Handshake) middleware for Express

## Project stats
* Package: [![npm](https://img.shields.io/npm/v/express-swish-protocol.svg)](https://www.npmjs.com/package/express-swish-protocol) [![npm](https://img.shields.io/npm/dm/express-swish-protocol.svg)](https://www.npmjs.com/package/express-swish-protocol)
* License: [![GitHub](https://img.shields.io/github/license/adonisv79/express-swish-protocol.svg)](https://github.com/adonisv79/express-swish-protocol/blob/master/LICENSE)
* CICD: [![Codacy Badge](https://api.codacy.com/project/badge/Grade/82a6fbafd28343a9886caf60bbda4dd7)](https://www.codacy.com/app/adonisv79/express-swish-protocol?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=adonisv79/express-swish-protocol&amp;utm_campaign=Badge_Grade) [![Known Vulnerabilities](https://snyk.io/test/github/adonisv79/express-swish-protocol/badge.svg)](https://snyk.io/test/github/adonisv79/express-swish-protocol)
  * master: [![Build Status](https://travis-ci.org/adonisv79/express-swish-protocol.svg?branch=master)](https://travis-ci.org/adonisv79/express-swish-protocol) [![Coverage Status](https://coveralls.io/repos/github/adonisv79/express-swish-protocol/badge.svg?branch=master)](https://coveralls.io/github/adonisv79/express-swish-protocol?branch=master)

## Installation
The module is released and available in NPMJS (https://www.npmjs.com/package/express-swish-protocol) 
```
npm install express-swish-protocol --save
```
## Sample use
The express-swish-protocol adds a new function sendSwish() that manages the swish requests. All swish request body arrive encrypted by the time we check req.body. Then the response are SWISH encrypted on the sendSwish() calls.
```
import express, { Request, Response, NextFunction } from 'express';
import * as bodyParser from 'body-parser';
import { Swish, swishSessionObject } from '../src/index';

// lets simulate a simple session manager by using a plain object
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
```
