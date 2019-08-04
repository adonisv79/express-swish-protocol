'use-strict';

const bodyParser = require('body-parser');
const express = require('express');
const session = require('express-session');
const { v4 } = require('uuid');

const { SwishServer } = require('../src/index');

const port = 3000;
const app = express();
app.use(bodyParser.json());
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  genid: () => v4(), // generate a UUIDv4 session id
  resave: true,
  saveUninitialized: true,
  secret: 'keyboard cat',
}));

// use our swish server middleware
app.use(SwishServer);

app.post('/test/success', (req, res) => {
  console.log('Received');
  console.dir(req.body);
  res.sendSwish('SUCCESS');
});

app.post('/test/err', (req, res) => {
  console.log('Received');
  console.dir(req.body);
  res.status(403).sendSwish('THIS IS A TESTERROR');
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
