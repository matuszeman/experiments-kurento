'use strict'

var _ = require('lodash');
var co = require('co');
var koa = require('koa');
var router = require('koa-joi-router');
var Joi = router.Joi;
var http = require('http');
var kurento = require('kurento-client');

var config = _.defaults(require('./config.local.js'), {
  serverPort: 3000,
  kurentoWsUri: 'ws://localhost:8888/kurento',
  clientRoot: './../client'
});
console.log('Config:');//XXX
console.log(config);//XXX

var app = koa();
app.use(require('koa-static')(config.clientRoot, {}));
var server = http.createServer(app.callback());
var io = require('socket.io')(server);

var sessions = {};

io.on('connection', function(socket){
  console.log('a user connected');

  socket.rtc = {
    candidates: [],
    pipeline: null,
    endpoint: null
  };

  socket.on('onIceCandidate', function(msg) {
    //console.log('onIceCandidate', msg);//XXX
    let candidate = kurento.register.complexTypes.IceCandidate(msg);
    socket.rtc.candidates.push(candidate);
    addCandidates(socket);
  });

  socket.on('start', function(msg) {
    co(function*() {
      yield start(socket, msg);
    }).catch(function(e) {
      console.log(e);//XXX
    });
  });

  socket.on('disconnect', function(){
    if(socket.rtc.pipeline) {
      socket.rtc.pipeline.release();
    }
    console.log('user disconnected');
  });
});

server.listen(config.serverPort);

function* start(socket, msg) {
  let endpoint;
  if(msg.sessionId) {
    endpoint = yield connectToSession(socket, msg.sessionId);
  }
  else {
    endpoint = yield startSession(socket);
  }

  yield gatherCandidates(socket, endpoint, msg.sdpOffer);
  addCandidates(socket);
}

function* startSession(socket) {
  let client = yield getKurentoClient();

  let pipeline = yield client.create('MediaPipeline');
  let endpoint = yield pipeline.create('WebRtcEndpoint');

  //let player = yield pipeline.create('PlayerEndpoint', {
  //  uri: 'file:///home/zemi/__TEST__/big-buck-bunny_trailer.webm'
  //  //uri: 'http://video.webmfiles.org/big-buck-bunny_trailer.webm'
  //});
  //
  ////when movie finish shows the camera
  //player.on('EndOfStream', function(e) {
  //  player.disconnect(endpoint);
  //  endpoint.connect(endpoint);
  //});
  //
  //yield player.connect(endpoint);
  //player.play();
  //endpoint.connect(endpoint);

  socket.rtc.pipeline = pipeline;
  socket.rtc.endpoint = endpoint;

  sessions[socket.id] = socket;

  socket.emit('sessionCreated', {
    id: socket.id
  });

  return endpoint;
}

function* connectToSession(socket, sessionId) {
  if(!sessions[sessionId]) {
    throw new Error('Unknown session', sessionId);
  }

  let remoteSocket = sessions[sessionId];
  let remoteEndpoint = remoteSocket.rtc.endpoint;

  //let pipeline = yield remoteEndpoint.getMediaPipeline();
  let pipeline = remoteSocket.rtc.pipeline;
  let endpoint = yield pipeline.create('WebRtcEndpoint');

  //remoteEndpoint.disconnect(remoteEndpoint);

  remoteEndpoint.connect(endpoint);
  endpoint.connect(remoteEndpoint);

  socket.rtc.pipeline = pipeline;
  socket.rtc.endpoint = endpoint;

  return endpoint;
}

function* gatherCandidates(socket, endpoint, sdpOffer) {
  endpoint.on('OnIceCandidate', function(event) {
    //console.log('ENDPOINT OnIceCandidate', event);//XXX
    let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
    socket.emit('iceCandidate', {
      candidate: candidate
    });
  });

  let sdpAnswer = yield endpoint.processOffer(sdpOffer);
  socket.emit('startResponse', {
    sdpAnswer: sdpAnswer
  });

  yield endpoint.gatherCandidates();
}

function addCandidates(socket) {
  if(!socket.rtc.endpoint) {
    return;
  }

  for(let candidate of socket.rtc.candidates) {
    socket.rtc.endpoint.addIceCandidate(candidate);
  }
  socket.rtc.candidates = [];
}

var kurentoClient;
function* getKurentoClient() {
  if(kurentoClient) {
    return kurentoClient;
  }

  kurentoClient = yield kurento.KurentoClient(config.kurentoWsUri);
  return kurentoClient;
}

