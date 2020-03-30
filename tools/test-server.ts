import { SwishResponse, SwishRequest, Swish } from '../src/index';

import bodyParser = require('body-parser');
import express = require('express');
// import session = require('express-session');
const sess: any = {};
function onSessionCreate(): string {
  const d = new Date();
  const sessionId = d.getTime().toString();
  sess[sessionId] = { sessionId };
  return sess[sessionId];
}

function onSessionRetrieve(sessionId: string): object {
  return sess[sessionId];
}

function onSessionDestroy(sessionId: string): void {
  delete sess[sessionId];
}

// const v4 = require('uuid/v4');
const swish = new Swish(onSessionCreate, onSessionRetrieve, onSessionDestroy);
const port = 3000;
const app = express();
app.use(bodyParser.json());

// use our swish server middleware
app.use(swish.middleware);

app.post('/test/success', (req, res: SwishResponse) => {
  console.log('Received');
  console.dir(req.body);
  res.sendSwish({ status: 'success' });
});

app.post('/test/err', (req, res: SwishResponse) => {
  console.log('Received');
  console.dir(req.body);
  res.status(403).sendSwish({ status: 'error', message: 'THIS IS A TESTERROR' });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
