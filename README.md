# express-swish-protocol
This is the SWISH (Secured Web Iterating Session Handshake) middleware implementation for ExpressJS. For the core SWISH Protocol project, please refer to https://github.com/adonisv79/swish-protocol
![request swish banner](https://adonisv79.github.io/express-swish-protocol/images/banner.png)

## Project stats
* Package: [![npm](https://img.shields.io/npm/v/.svg)](https://www.npmjs.com/package/express-swish-protocol) [![npm](https://img.shields.io/npm/dm/express-swish-protocol.svg)](https://www.npmjs.com/package/express-swish-protocol)
* License: [![GitHub](https://img.shields.io/github/license/adonisv79/express-swish-protocol.svg)](https://github.com/adonisv79/express-swish-protocol/blob/master/LICENSE)
* CICD: [![Codacy Badge](https://app.codacy.com/project/badge/Grade/82a6fbafd28343a9886caf60bbda4dd7)](https://www.codacy.com/gh/adonisv79/express-swish-protocol/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=adonisv79/express-swish-protocol&amp;utm_campaign=Badge_Grade) [![Known Vulnerabilities](https://snyk.io/test/github/adonisv79/express-swish-protocol/badge.svg)](https://snyk.io/test/github/adonisv79/express-swish-protocol)
  * develop: [![Build Status](https://www.travis-ci.com/adonisv79/express-swish-protocol.svg?branch=develop)](https://www.travis-ci.com/adonisv79/express-swish-protocol) [![Coverage Status](https://coveralls.io/repos/github/adonisv79/express-swish-protocol/badge.svg?branch=develop)](https://coveralls.io/github/adonisv79/express-swish-protocol?branch=develop)
  * master: [![Build Status](https://www.travis-ci.com/adonisv79/express-swish-protocol.svg?branch=master)](https://www.travis-ci.com/adonisv79/express-swish-protocol) [![Coverage Status](https://coveralls.io/repos/github/adonisv79/express-swish-protocol/badge.svg?branch=master)](https://coveralls.io/github/adonisv79/express-swish-protocol?branch=master)


## Installation
The module is released and available in NPMJS (https://www.npmjs.com/package/express-swish-protocol) 
```
npm install express-swish-protocol --save
```
## Sample use
Start the sample server and client and see the interaction
```
npm run start:server
// then
npm run start:client
```

Check out the codes in 'tools' folder for sample implementation of the middleware. 
Also, make sure to replace the following in your actual implementation
```
import { ExpressSwish, SwishSessionObject } from 'express-swish-protocol'
```