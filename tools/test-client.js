const rp = require('request-promise');
const { HandshakeClient } = require('swish-protocol');

const SERVER_URL = 'http://localhost:3000';
const clientHS = new HandshakeClient();

async function testHandShake() {
  console.log('Starting handshake...');
  const swish = clientHS.generateHandshake();
  // run the request. we don't use async await coz request-promise uses bluebird
  return rp({
    headers: {
      'swish-action': swish.headers.swishAction,
      'swish-iv': swish.headers.swishIV,
      'swish-key': swish.headers.swishKey,
      'swish-next': swish.headers.swishNextPublic,
      'swish-sess-id': swish.headers.swishSessionId,
    },
    json: true,
    method: 'GET',
    resolveWithFullResponse: true,
    uri: `${SERVER_URL}/auth/swish/handshake`,
  }).then((response) => {
    const hsResponse = clientHS.handleHandshakeResponse({
      swishAction: response.headers['swish-action'],
      swishIV: response.headers['swish-iv'],
      swishKey: response.headers['swish-key'],
      swishNextPublic: response.headers['swish-next'],
      swishSessionId: response.headers['swish-sess-id'],
    }, response.body);
    console.log('Handshake completed!');
    return hsResponse;
  }).catch((err) => {
    console.log(err.message);
  });
}

async function testRequest(path, body) {
  console.log(`Sending Test ${path}`);
  const swish = clientHS.encryptRequest(body);
  // run the request. we don't use async await coz request-promise uses bluebird
  return rp({
    body: swish.body,
    headers: {
      'swish-action': swish.headers.swishAction,
      'swish-iv': swish.headers.swishIV,
      'swish-key': swish.headers.swishKey,
      'swish-next': swish.headers.swishNextPublic,
      'swish-sess-id': swish.headers.swishSessionId,
    },
    json: true,
    method: 'POST',
    resolveWithFullResponse: true,
    uri: `${SERVER_URL}/${path}`,
  }).then((response) => {
    const dec = clientHS.decryptResponse({
      swishAction: response.headers['swish-action'],
      swishIV: response.headers['swish-iv'],
      swishKey: response.headers['swish-key'],
      swishNextPublic: response.headers['swish-next'],
      swishSessionId: response.headers['swish-sess-id'],
    }, response.body);
    console.dir(dec);
  }).catch((err) => {
    if ((err.response || {}).body && (err.response || {}).headers) {
      const dec = clientHS.decryptResponse({
        swishAction: err.response.headers['swish-action'],
        swishIV: err.response.headers['swish-iv'],
        swishKey: err.response.headers['swish-key'],
        swishNextPublic: err.response.headers['swish-next'],
        swishSessionId: err.response.headers['swish-sess-id'],
      }, err.response.body);
      console.dir(dec);
    } else {
      console.log(err.message);
    }
  });
}

async function test() {
  try {
    await testHandShake();

    // now lets start communicating to the secured endpoints
    await testRequest('test/success', { action: 'hello', message: 'Adonis Villamor', passcode: 'whoami' });

    // send a different one this time
    await testRequest('test/err', { action: 'move', message: 'Japan', passcode: 'whereami' });
  } catch (err) {
    console.error(err);
  }
}

test();
