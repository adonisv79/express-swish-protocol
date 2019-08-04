const rp = require('request-promise');
const { HandshakeClient } = require('swish-protocol');

const SERVER_URL = 'http://localhost:3000';
const clientHS = new HandshakeClient();
let expressSessCookie = '';
    
async function test() {
  try {
    const handshakeResponse = await testHandShake();
    if (handshakeResponse.status === 'ok') {
      console.log('[SUCCESS]HANDSHAKE_PAIRED');
    } else {
      throw new Error('HANDSHAKE_FAILED');
    }

    // now lets start communicating to the secured endpoints
    await testRequest('test/success', { action: 'hello', message: 'Adonis Villamor', passcode: 'whoami' });

    // send a different one this time
    await testRequest('test/err',{ action: 'move', message: 'Japan', passcode: 'whereami'  });
  } catch (err) {
    console.error(err);
  }
}

async function testHandShake() {
  console.log('Starting handshake');
  const swish = clientHS.generateHandshake();
  // run the request. we don't use async await coz request-promise uses bluebird
  return rp({
    headers: swish.headers,
    json: true,
    method: 'GET',
    resolveWithFullResponse: true,
    uri: `${SERVER_URL}/auth/swish/handshake`,
  }).then((response) => {
    console.log('Handshake completed!');
    expressSessCookie = response.headers['set-cookie'][0];
    const hsResponse = clientHS.handleHandshakeResponse(response.headers, response.body);
    console.log('Session Cookie: ' + response.headers['set-cookie'][0]);
    return hsResponse;
  }).catch((err) => {
    const dec = clientHS.decryptResponse(err.response.headers, err.response.body);
    console.log("Error[" + err.statusCode + "]: " + dec);
  });
}

async function testRequest(path, body) {
  console.log('Sending:')
  //console.dir(body);
  const swish = clientHS.encryptRequest(body);
  const headers = { 'cookie': expressSessCookie, ...swish.headers};
  // run the request. we don't use async await coz request-promise uses bluebird
  return rp({
    body: swish.body,
    headers,
    json: true,
    method: 'POST',
    resolveWithFullResponse: true,
    uri: `${SERVER_URL}/${path}`,
  }).then((response) => {
    const dec = clientHS.decryptResponse(response.headers, response.body);
    console.log('Received');
    console.dir(dec);
  }).catch((err) => {
    const dec = clientHS.decryptResponse(err.response.headers, err.response.body);
    console.log("Error[" + err.statusCode + "]: " + dec);
  });
}

void test();
