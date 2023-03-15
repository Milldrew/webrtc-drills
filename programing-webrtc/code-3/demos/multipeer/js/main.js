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
 *  Global Variables: $self and $peers
 */

const $self = {
  rtcConfig: null,
  mediaConstraints: { audio: true, video: true },
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {
    audio: false
  }
};

const $peers = new Map();


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

document.querySelector('#username-form')
  .addEventListener('submit', handleUsernameForm);


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
  sc.close();
  for (let id of $peers.keys()) {
    resetPeer(id);
  }
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

  for (let id of $peers.keys()) {
    shareFeatures(id, 'audio');
  }
}

function toggleCam(button) {

  // snip, snip

  const video = $self.mediaTracks.video;
  const enabledState = video.enabled = !video.enabled;

  $self.features.video = enabledState;

  button.setAttribute('aria-checked', enabledState);

  for (let id of $peers.keys()) {
    shareFeatures(id, 'video');
  }

  // snip, snip

  if (enabledState) {
    $self.mediaStream.addTrack($self.mediaTracks.video);
  }
  else {
    $self.mediaStream.removeTrack($self.mediaTracks.video);
    displayStream($self.mediaStream);
  }
}

// (elsewhere in your main.js file...)


function handleUsernameForm(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.querySelector('#username-input').value;
  const figcaption = document.querySelector('#self figcaption');
  figcaption.innerText = username;

  $self.features.username = username;

  for (let id of $peers.keys()) {
    shareFeatures(id, 'username');
  }

}

/**
 *  User-Media and Data-Channel Functions
 */

async function requestUserMedia(media_constraints) {

  $self.media = await navigator.mediaDevices
    .getUserMedia(media_constraints);

  // snip, snip

  // Hold onto audio- and video-track references
  $self.mediaTracks.audio = $self.media.getAudioTracks()[0];
  $self.mediaTracks.video = $self.media.getVideoTracks()[0];

  // Mute the audio if `$self.features.audio` evaluates to `false`
  $self.mediaTracks.audio.enabled = !!$self.features.audio;

  // Add audio and video tracks to mediaStream
  $self.mediaStream.addTrack($self.mediaTracks.audio);
  $self.mediaStream.addTrack($self.mediaTracks.video);

  displayStream($self.mediaStream);
}

function createVideoStructure(id) {
  const figure = document.createElement('figure');
  const figcaption = document.createElement('figcaption');
  const video = document.createElement('video');
  const attributes = {
    autoplay: '',
    playsinline: '',
    poster: 'img/placeholder.png'
  };

  // Set attributes
  figure.id = `peer-${id}`;
  figcaption.innerText = id;
  for (let attr in attributes) {
    video.setAttribute(attr, attributes[attr]);
  }
  // Append the video and figcaption elements
  figure.appendChild(video);
  figure.appendChild(figcaption);
  // Return the complete figure
  return figure;
}

function displayStream(stream, id = 'self') {
  const selector = id === 'self' ? '#self' : `#peer-${id}`;
  let videoStructure = document.querySelector(selector);
  if (!videoStructure) {
    const videos = document.querySelector('#videos');
    videoStructure = createVideoStructure(id);
    videos.appendChild(videoStructure);
  }
  videoStructure.querySelector('video').srcObject = stream;
}

function addStreamingMedia(id) {
  const peer = $peers.get(id);
  for (let track in $self.mediaTracks) {
    peer.connection.addTrack($self.mediaTracks[track]);
  }
}

function addFeaturesChannel(id) {
  const peer = $peers.get(id);

  // snip, snip
  const featureFunctions = {

    // snip, snip

    audio: function() {
      const username = peer.features.username ? peer.features.username : id;
      showUsernameAndMuteStatus(username);
    },

    username: function() {
      // Update the username
      showUsernameAndMuteStatus(peer.features.username);
    },

    // snip, snip

    video: function() {
      // This is all just to display the poster image, rather than a black frame
      if (peer.mediaTracks.video) {
        if (peer.features.video) {
          peer.mediaStream.addTrack(peer.mediaTracks.video);
        } else {
          peer.mediaStream.removeTrack(peer.mediaTracks.video);
          displayStream(peer.mediaStream, id);
        }
      }
    }
  };

  // snip, snip

  peer.featuresChannel =
    peer.connection.createDataChannel('features',
      { negotiated: true, id: 110 });

  peer.featuresChannel.onopen = function(event) {
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

  function showUsernameAndMuteStatus(username) {
    const fc = document.querySelector(`#peer-${id} figcaption`);
    if (peer.features.audio) {
      fc.innerText = username;
    } else {
      fc.innerText = `${username} (Muted)`;
    }
  }
}

function shareFeatures(id, ...features) {
  const peer = $peers.get(id);

  const featuresToShare = {};

  if (!peer.featuresChannel) return;

  for (let f of features) {
    featuresToShare[f] = $self.features[f];
  }

  try {
    peer.featuresChannel.send(JSON.stringify(featuresToShare));
  } catch(e) {
    console.error('Error sending features:', e);
  }
}

/**
 *  Call Features & Reset Functions
 */

function initializePeer(id, polite) {
  $peers.set(id, {
    connection: new RTCPeerConnection($self.rtcConfig),
    mediaStream: new MediaStream(),
    mediaTracks: {},
    features: {},
    selfStates: {
      isPolite: polite,
      isMakingOffer: false,
      isIgnoringOffer: false,
      isSettingRemoteAnswerPending: false,
    }
  });
}

function establishCallFeatures(id) {
  registerRtcCallbacks(id);
  addFeaturesChannel(id);
  addStreamingMedia(id);
}

function resetPeer(id) {
  const peer = $peers.get(id);
  displayStream(null, id);
  document.querySelector(`#peer-${id}`).remove();
  peer.connection.close();
  $peers.delete(id);
}


/**
 *  WebRTC Functions and Callbacks
 */

function registerRtcCallbacks(id) {
  const peer = $peers.get(id);
  peer.connection
    .onconnectionstatechange = handleRtcConnectionStateChange(id);
  peer.connection
    .onnegotiationneeded = handleRtcConnectionNegotiation(id);
  peer.connection
    .onicecandidate = handleRtcIceCandidate(id);
  peer.connection
    .ontrack = handleRtcPeerTrack(id);
}

function handleRtcPeerTrack(id) {
  return function({ track }) {
    const peer = $peers.get(id);
    console.log(`Handle incoming ${track.kind} track from peer ID: ${id}`);
    peer.mediaTracks[track.kind] = track;
    peer.mediaStream.addTrack(track);
    displayStream(peer.mediaStream, id);
  };
}



/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */


/**
 *  Reusable WebRTC Functions and Callbacks
 */
function handleRtcConnectionNegotiation(id) {
  return async function() {
    const peer = $peers.get(id);
    const selfState = peer.selfStates;
    selfState.isMakingOffer = true;
    await peer.connection.setLocalDescription();
    sc.emit('signal',
      { recipient: id, sender: $self.id,
        signal: { description: peer.connection.localDescription } });
    selfState.isMakingOffer = false;
  };
}

function handleRtcIceCandidate(id) {
  return function({ candidate }) {
    sc.emit('signal', { recipient: id, sender: $self.id,
      signal: { candidate } });
  };
}

function handleRtcConnectionStateChange(id) {
  return function() {
    const peer = $peers.get(id);
    const connectionState = peer.connection.connectionState;
    // Assume *some* element will take a unique peer ID
    const peerElement = document.querySelector(`#peer-${id}`);
    if (peerElement) {
      peerElement.dataset.connectionState = connectionState;
    }
    console.log(`Connection state '${connectionState}' for Peer ID: ${id}`);
  };
}



/**
 *  Signaling-Channel Functions and Callbacks
 */

function registerScCallbacks() {
  sc.on('connect', handleScConnect);
  sc.on('connected peers', handleScConnectedPeers);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
}

function handleScConnect() {
  console.log('Successfully connected to the signaling server!');
  $self.id = sc.id;
  console.log(`Self ID: ${$self.id}`);
}

function handleScConnectedPeers(ids) {
  console.log(`Connected peer IDs: ${ids.join(', ')}`);
  for (let id of ids) {
    if (id === $self.id) continue;
    // be polite with already-connected peers
    initializePeer(id, true);
    establishCallFeatures(id);
  }
}

function handleScConnectedPeer(id) {
  console.log(`Newly connected peer ID: ${id}`);
  // be impolite with each newly connecting peer
  initializePeer(id, false);
  establishCallFeatures(id);
}

function handleScDisconnectedPeer(id) {
  console.log(`Disconnected peer ID: ${id}`);
  resetPeer(id);
}

async function handleScSignal({ sender,
  signal: { candidate, description } }) {

  const id = sender;
  const peer = $peers.get(id);
  const selfState = peer.selfStates;

  if (description) {
    // snip, snip...


    const readyForOffer =
          !selfState.isMakingOffer &&
          (peer.connection.signalingState === 'stable'
            || selfState.isSettingRemoteAnswerPending);

    const offerCollision = description.type === 'offer' && !readyForOffer;

    selfState.isIgnoringOffer = !selfState.isPolite && offerCollision;

    // still inside the handleScSignal callback()

    // snip, snip...

    if (selfState.isIgnoringOffer) {
      return;
    }

    selfState.isSettingRemoteAnswerPending = description.type === 'answer';

    await peer.connection.setRemoteDescription(description);

    selfState.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      await peer.connection.setLocalDescription();
      sc.emit('signal', { recipient: id, sender: $self.id,
        signal: { description: peer.connection.localDescription } });
    }

// still inside the handleScSignal callback()

// snip, snip...
  } else if (candidate) {
// snip, snip...
    // Handle ICE candidates
    try {
      await peer.connection.addIceCandidate(candidate);
    } catch(e) {
      // Log error unless state is ignoring offers
      // and candidate is not an empty string
      if (!selfState.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error(`Unable to add ICE candidate for peer ID: ${id}.`, e);
      }
    }
// snip, snip...
  }
}



/**
 *  Utility Functions
 */

function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[a-z]{4}-[a-z]{4}-[a-z]{4}$/.test(ns)) {
    console.log(`Checked existing namespace '${ns}'`);
    return ns;
  }
  ns = generateRandomAlphaString('-', 4, 4, 4);
  console.log(`Created new namespace '${ns}'`);
  if (set_location) window.location.hash = ns;
  return ns;
}

function generateRandomAlphaString(separator, ...groups) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let ns = [];
  for (let group of groups) {
    let str = '';
    for (let i = 0; i < group; i++) {
      str += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    ns.push(str);
  }
  return ns.join(separator);
}
