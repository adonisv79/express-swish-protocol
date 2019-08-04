# express-swish
SWISH (Secured Web Iterating Session Handshake) middle-ware for Express

## Project stats
* Package: [![npm](https://img.shields.io/npm/v/express-swish.svg)](https://www.npmjs.com/package/express-swish) [![npm](https://img.shields.io/npm/dm/express-swish.svg)](https://www.npmjs.com/package/express-swish)
* License: [![GitHub](https://img.shields.io/github/license/adonisv79/express-swish.svg)](https://github.com/adonisv79/express-swish/blob/master/LICENSE)
* CICD: [![Codacy Badge](https://api.codacy.com/project/badge/Grade/3709f3ab3b0c4380b5a41e010e8628c0)](https://www.codacy.com/app/adonisv79/express-swish?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=adonisv79/express-swish&amp;utm_campaign=Badge_Grade) [![Known Vulnerabilities](https://snyk.io/test/github/adonisv79/express-swish/badge.svg)](https://snyk.io/test/github/adonisv79/express-swish)
  * develop: [![Build Status](https://travis-ci.org/adonisv79/express-swish.svg?branch=develop)](https://travis-ci.org/adonisv79/express-swish) [![Coverage Status](https://coveralls.io/repos/github/adonisv79/express-swish/badge.svg?branch=develop)](https://coveralls.io/github/adonisv79/express-swish?branch=develop)
  * master: [![Build Status](https://travis-ci.org/adonisv79/express-swish.svg?branch=master)](https://travis-ci.org/adonisv79/express-swish) [![Coverage Status](https://coveralls.io/repos/github/adonisv79/express-swish/badge.svg)](https://coveralls.io/github/adonisv79/express-swish)

## Installation
The module is released and available in NPMJS (https://www.npmjs.com/package/express-swish) 
```
npm install express-swish --save
```
## Sample use
The express-swish adds a new function sendSwish() that manages the swish requests. All swish request body arrive encrypted by the time we check req.body. Then the response are SWISH encrypted on the sendSwish() calls.
```
const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const { v4 } = require('uuid');
const { SwishServer } = require('express-swish');

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