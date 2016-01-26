'use strict'

var _ = require('lodash');
var co = require('co');
var koa = require('koa');
var serve = require('koa-static');
var mount = require('koa-mount');
var router = require('koa-joi-router');
var Joi = router.Joi;
var fs = require('fs');
var http = require('http');
var https = require('https');
var kurento = require('kurento-client');

var utils = require('../../shared/server');

var config = _.defaults(require('./config.local.js'), {
  serverPort: 3000,
  serverHttps: false,
  kurentoWsUri: 'ws://localhost:8888/kurento',
  clientRoot: './../client',
  sharedRoot: './../../shared'
});
console.log('Config:');//XXX
console.log(config);//XXX

var shared = koa();
shared.use(serve(config.sharedRoot));

var app = koa();
app.use(mount('/shared', shared));
app.use(serve(config.clientRoot));

var server = utils.server.create(app, config);

var io = require('socket.io')(server);

io.on('connection', function(socket){
  console.log('a user connected');

  socket.rtc = {
    candidates: []
  };

  socket.on('onIceCandidate', function(msg) {
    console.log('onIceCandidate', msg);//XXX
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

function* start(socket, sdpOffer) {
  let client = yield getKurentoClient();

  let pipeline = yield client.create('MediaPipeline');
  let endpoint = yield pipeline.create('WebRtcEndpoint');

  //create callback
  yield endpoint.connect(endpoint);

  socket.rtc.pipeline = pipeline;
  socket.rtc.endpoint = endpoint;

  endpoint.on('OnIceCandidate', function(event) {
    console.log('ENDPOINT OnIceCandidate', event);//XXX
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
  addCandidates(socket);
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

