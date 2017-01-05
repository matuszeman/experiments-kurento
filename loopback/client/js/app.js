var module = angular.module('App', ['ngMaterial']);

var webRtcPeer;

module.controller('AppController', function($scope, Rtc, socket) {
  var rtc = new Rtc(socket);

  $scope.rtc = rtc;

  $scope.connect = function() {
    rtc.start();
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
  }

  Rtc.prototype.onOffer = function(error, offerSdp) {
    if(error) return onError(error);
    console.info('Invoking SDP offer callback function ' + location.host);
    this.socket.emit('start', offerSdp);
  };

  Rtc.prototype.onIceCandidate = function(candidate) {
    console.log('Local candidate' + JSON.stringify(candidate));
    this.socket.emit('onIceCandidate', candidate);
  };

  Rtc.prototype.start = function() {
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

    self.peer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error) {
      if(error) return onError(error);
      this.generateOffer(self.onOffer.bind(self));
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


