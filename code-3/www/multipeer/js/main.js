/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

/**
 *  Global Variables: $self and $peer
 */

const $self = {
  rtcConfig: null,
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false,
  mediaConstraints: { audio: true, video: true },
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {
    audio: false
  }
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {}
};



/**
 *  Signaling-Channel Setup
 */

const namespace = prepareNamespace(window.location.hash, true);

const sc = io.connect('/' + namespace, { autoConnect: false });

registerScCallbacks();



/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */



/**
 *  User-Interface Setup
 */

document.querySelector('#toggle-mic')
  .setAttribute('aria-checked', $self.features.audio);

document.querySelector('#header h1')
  .innerText = 'Welcome to Room #' + namespace;

document.querySelector('#call-button')
  .addEventListener('click', handleCallButton);

document.querySelector('#footer')
  .addEventListener('click', handleMediaButtons);



/**
 *  User-Media Setup
 */

requestUserMedia($self.mediaConstraints);



/**
 *  User-Interface Functions and Callbacks
 */

function handleCallButton(event) {
  const callButton = event.target;
  if (callButton.className === 'join') {
    console.log('Joining the call...');
    callButton.className = 'leave';
    callButton.innerText = 'Leave Call';
    joinCall();
  } else {
    console.log('Leaving the call...');
    callButton.className = 'join';
    callButton.innerText = 'Join Call';
    leaveCall();
  }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  $self.isPolite = false;
  sc.close();
  resetPeer($peer);
}

function handleMediaButtons(event) {
  const target = event.target;
  if (target.tagName !== 'BUTTON') return;
  switch (target.id) {
    case 'toggle-mic':
      toggleMic(target);
      break;
    case 'toggle-cam':
      toggleCam(target);
      break;
  }
}

function toggleMic(button) {
  const audio = $self.mediaTracks.audio;
  const enabledState = audio.enabled = !audio.enabled;

  $self.features.audio = enabledState;

  button.setAttribute('aria-checked', enabledState);

  shareFeatures('audio');
}

function toggleCam(button) {
  const video = $self.mediaTracks.video;
  const enabledState = video.enabled = !video.enabled;

  $self.features.video = enabledState;

  button.setAttribute('aria-checked', enabledState);

  shareFeatures('video');

  if (enabledState) {
    $self.mediaStream.addTrack($self.mediaTracks.video);
  }
  else {
    $self.mediaStream.removeTrack($self.mediaTracks.video);
    displayStream($self.mediaStream, '#self');
  }
}



/**
 *  User-Media and Data-Channel Functions
 */

async function requestUserMedia(media_constraints) {

  $self.media = await navigator.mediaDevices
    .getUserMedia(media_constraints);

  // Hold onto audio- and video-track references
  $self.mediaTracks.audio = $self.media.getAudioTracks()[0];
  $self.mediaTracks.video = $self.media.getVideoTracks()[0];

  // Mute the audio if `$self.features.audio` evaluates to `false`
  $self.mediaTracks.audio.enabled = !!$self.features.audio;

  // Add audio and video tracks to mediaStream
  $self.mediaStream.addTrack($self.mediaTracks.audio);
  $self.mediaStream.addTrack($self.mediaTracks.video);

  displayStream($self.mediaStream, '#self');
}

function displayStream(stream, selector) {
  document.querySelector(selector).srcObject = stream;
}

function addStreamingMedia(peer) {
  for (let track in $self.mediaTracks) {
    peer.connection.addTrack($self.mediaTracks[track]);
  }
}

function addFeaturesChannel(peer) {
  const featureFunctions = {
    audio: function() {
      const status = document.querySelector('#mic-status');
      // reveal "Remote peer is muted" message if muted (aria-hidden=false)
      // otherwise hide it (aria-hidden=true)
      status.setAttribute('aria-hidden', peer.features.audio);
    },
    video: function() {
      // This is all just to display the poster image, rather than a black frame
      if (peer.mediaTracks.video) {
        if (peer.features.video) {
          peer.mediaStream.addTrack(peer.mediaTracks.video);
        } else {
          peer.mediaStream.removeTrack(peer.mediaTracks.video);
          displayStream(peer.mediaStream, '#peer');
        }
      }
    }
  };
  peer.featuresChannel =
    peer.connection.createDataChannel('features',
      { negotiated: true, id: 110 });

  peer.featuresChannel.onopen = function(event) {
    console.log('Features channel opened.')
    // send features information just as soon as the channel opens
    peer.featuresChannel.send(JSON.stringify($self.features))
  };

  peer.featuresChannel.onmessage = function(event) {
    const features = JSON.parse(event.data);
    for (let f in features) {
      // update the corresponding features field on $peer
      peer.features[f] = features[f];
      // if there's a corresponding function, run it
      if (typeof featureFunctions[f] === 'function') {
        featureFunctions[f]();
      }
    }
  };
}

function shareFeatures(...features) {
  const featuresToShare = {};

  // don't try to share features before joining the call or
  // before the features channel is available
  if (!$peer.featuresChannel) return;

  for (let f of features) {
    featuresToShare[f] = $self.features[f];
  }

  try {
    $peer.featuresChannel.send(JSON.stringify(featuresToShare));
  } catch(e) {
    console.error('Error sending features:', e);
    // No need to queue; contents of `$self.features` will send
    // as soon as the features channel opens
  }
}



/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  registerRtcCallbacks(peer);
  addFeaturesChannel(peer);
  addStreamingMedia(peer);
}

function resetPeer(peer) {
  displayStream(null, '#peer');
  document.querySelector('#mic-status')
    .setAttribute('aria-hidden', true);
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);
  peer.mediaStream = new MediaStream();
  peer.mediaTracks = {};
  peer.features = {};
}



/**
 *  WebRTC Functions and Callbacks
 */

function registerRtcCallbacks(peer) {
  peer.connection
    .onconnectionstatechange = handleRtcConnectionStateChange;
  peer.connection
    .onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection
    .onicecandidate = handleRtcIceCandidate;
  peer.connection
    .ontrack = handleRtcPeerTrack;
}

function handleRtcPeerTrack({ track }) {
  console.log(`Handle incoming ${track.kind} track...`)
  $peer.mediaTracks[track.kind] = track;
  $peer.mediaStream.addTrack(track);
  displayStream($peer.mediaStream, '#peer');
}



/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */



/**
 *  Reusable WebRTC Functions and Callbacks
 */

async function handleRtcConnectionNegotiation() {
  $self.isMakingOffer = true;
  await $peer.connection.setLocalDescription();
  sc.emit('signal',
    { description: $peer.connection.localDescription });
  $self.isMakingOffer = false;
}

function handleRtcIceCandidate({ candidate }) {
  sc.emit('signal', { candidate: candidate });
}

function handleRtcConnectionStateChange() {
  const connectionState = $peer.connection.connectionState;
  document.querySelector('body').className = connectionState;
}



/**
 *  Signaling-Channel Functions and Callbacks
 */

function registerScCallbacks() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
}

function handleScConnect() {
  console.log('Successfully connected to the signaling server!');
  establishCallFeatures($peer);
}

function handleScConnectedPeer() {
  $self.isPolite = true;
}

function handleScDisconnectedPeer() {
  resetPeer($peer);
  establishCallFeatures($peer);
}

async function handleScSignal({ description, candidate }) {
  if (description) {

    const readyForOffer =
          !$self.isMakingOffer &&
          ($peer.connection.signalingState === 'stable'
            || $self.isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    $self.isIgnoringOffer = !$self.isPolite && offerCollision;

    if ($self.isIgnoringOffer) {
      return;
    }

    $self.isSettingRemoteAnswerPending = description.type === 'answer';
    await $peer.connection.setRemoteDescription(description);
    $self.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      await $peer.connection.setLocalDescription();
      sc.emit('signal',
        { description: $peer.connection.localDescription });
    }
  } else if (candidate) {
    // Handle ICE candidates
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch(e) {
      // Log error unless $self is ignoring offers
      // and candidate is not an empty string
      if (!$self.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error('Unable to add ICE candidate for peer:', e);
      }
    }
  }
}



/**
 *  Utility Functions
 */

function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{7}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 9);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
