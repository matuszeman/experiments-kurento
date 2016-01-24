var module = angular.module('App', ['ngMaterial']);

var webRtcPeer;
var socket = io();

module.controller('AppController', function($scope) {
  $scope.connect = function() {
    //socket.emit('chat message');

    var videoInput = document.getElementById('videoInput');
    var videoOutput = document.getElementById('videoOutput');

    var options = {
      localVideo: videoInput,
      remoteVideo: videoOutput,
      onicecandidate : onIceCandidate,
      oncandidategatheringdone: onIceCandidateDone
    };

    webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error) {
      if(error) return onError(error);
      this.generateOffer(onOffer);
    });

    socket.on('iceCandidate', function(msg) {
      console.log('iceCandidate', msg);//XXX
      webRtcPeer.addIceCandidate(msg.candidate);
    })

    socket.on('startResponse', function(msg) {
      console.log('startResponse', msg);//XXX
      webRtcPeer.processAnswer(msg.sdpAnswer);
    });

    function onOffer(error, offerSdp) {
      if(error) return onError(error);
      console.info('Invoking SDP offer callback function ' + location.host);

      socket.emit('start', offerSdp);
    }

    function onIceCandidateDone() {
      console.log('onIceCandidateDone');//XXX
    }

    function onIceCandidate(candidate) {
      console.log('Local candidate' + JSON.stringify(candidate));

      socket.emit('onIceCandidate', candidate);
    }
  }

});