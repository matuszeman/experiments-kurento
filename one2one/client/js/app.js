var module = angular.module('App', ['ngMaterial']);

var webRtcPeer;

module.controller('AppController', function($scope, Rtc, socket) {
  var rtc = new Rtc(socket);

  $scope.rtc = rtc;

  $scope.startSession = function() {
    rtc.start();
  }

  $scope.connectToSession = function(sessionId) {
    rtc.start(sessionId);
  }
});

module.factory('Rtc', function() {

  function Rtc(socket) {
    var self = this;

    this.socket = socket;

    socket.on('iceCandidate', function(msg) {
      console.log('iceCandidate', msg);//XXX
      self.peer.addIceCandidate(msg.candidate);
    });

    socket.on('startResponse', function(msg) {
      console.log('startResponse', msg);//XXX
      self.peer.processAnswer(msg.sdpAnswer);
    });

    socket.on('sessionCreated', function(msg) {
      console.log('sessionCreated', msg);//XXX
      self.sessionId = msg.id;
    });
  }

  Rtc.prototype.onIceCandidate = function(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));
    this.socket.emit('onIceCandidate', candidate);
  };

  Rtc.prototype.start = function(sessionId) {
    var self = this;

    var options = {
      localVideo: this.localVideo,
      remoteVideo: this.remoteVideo,
      mediaConstraints: {
        video: true,
        audio: true
      },
      onicecandidate : this.onIceCandidate.bind(self),
      //oncandidategatheringdone: onIceCandidateDone
    };

    self.peer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(err) {
      if(err) {
        throw err;
      }

      this.generateOffer(function(err, sdpOffer) {
        if(err) {
          throw err;
        }

        console.info('Invoking SDP offer callback function ' + location.host);
        self.socket.emit('start', {
          sdpOffer: sdpOffer,
          sessionId: sessionId
        });
      });
    });

  };

  return Rtc;
});

module.factory('socket', function() {
  return io();
});

module.directive('rtcVideo', function() {
  return {
    restrict: 'A',
    scope: {
      rtcVideo: '=',
      remote: '@'
    },
    link: function($scope, $element, $attrs) {
      var rtc = $scope.rtcVideo;
      if($scope.remote) {
        rtc.remoteVideo = $element[0];
      }
      else {
        rtc.localVideo = $element[0];
      }
    }
  };
});


