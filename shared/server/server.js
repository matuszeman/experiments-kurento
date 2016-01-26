'use strict'

var https = require('https');
var http = require('http');
var fs = require('fs');

module.exports.create = function(app, opts) {
  let server;

  if(opts.serverHttps) {
    let options = {
      key: fs.readFileSync(__dirname + '/server.key'),
      cert: fs.readFileSync(__dirname + '/server.crt')
    };
    server = https.createServer(options, app.callback());
  }
  else {
    server = http.createServer(app.callback());
  }

  return server;
}
