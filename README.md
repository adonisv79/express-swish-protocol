# express-swish-protocol
SWISH (Secured Web Iterating Session Handshake) middle-ware for Express

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
const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const { v4 } = require('uuid');
const { SwishServer } = require('express-swish-protocol');

const port = 3000;
const app = express();
app.use(bodyParser.json());
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  genid: () => GenerateSessionId(), // generate a UUIDv4 session id
  resave: true,
  saveUninitialized: true,
  secret: 'keyboard cat',
}));

// use our swish server middleware
app.use(SwishServer);

//lets create a simple test endpoint
app.post('/test', (req, res, next) => {
  console.dir(req.body);
  res.sendSwish('OMG!'); //swish-express adds a new sendSwish command
});

app.post('/test/error', (req, res, next) => {
  console.dir(req.body);
  res.status(400).sendSwish('OMG!'); //swish-express adds a new sendSwish command
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

```
