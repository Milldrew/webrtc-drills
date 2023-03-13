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
 * Classes
 */

const VideoFX = class {
  constructor() {
    this.filters = ['grayscale', 'sepia', 'noir', 'psychedelic', 'none'];
  }
  cycleFilter() {
    const filter = this.filters.shift();
    this.filters.push(filter);
    return filter;
  }
};



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

document.querySelector('#self')
  .addEventListener('click', handleSelfVideo);

document.querySelector('#chat-form')
  .addEventListener('submit', handleMessageForm);

document.querySelector('#chat-img-btn')
  .addEventListener('click', handleImageButton);


/**
 *  User-Media Setup
 */

requestUserMedia($self.mediaConstraints);

$self.filters = new VideoFX();

$self.messageQueue = [];



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

function handleSelfVideo(event) {
  if ($peer.connection.connectionState !== 'connected') return;
  const filter = `filter-${$self.filters.cycleFilter()}`;
  const fdc = $peer.connection.createDataChannel(filter);
  fdc.onclose = function() {
    console.log(`Remote peer has closed the ${filter} data channel`);
  };
  event.target.className = filter;
}

function handleImageButton(event) {
  let input = document.querySelector('input.temp');
  input = input ? input : document.createElement('input');
  input.className = 'temp';
  input.type = 'file';
  input.accept = '.gif, .jpg, .jpeg, .png';
  input.setAttribute('aria-hidden', true);
  // Safari/iOS requires appending the file input to the DOM
  document.querySelector('#chat-form').appendChild(input);
  input.addEventListener('change', handleImageInput);
  input.click();
}

function handleImageInput(event) {
  event.preventDefault();
  const image = event.target.files[0];
  const metadata = {
    kind: 'image',
    name: image.name,
    size: image.size,
    timestamp: Date.now(),
    type: image.type
  };
  const payload = { metadata: metadata, file: image };
  appendMessage('self', '#chat-log', metadata, image);
  // Remove appended file input element
  event.target.remove();
  // Send or queue the file
  sendOrQueueMessage($peer, payload);
}

function handleMessageForm(event) {
  event.preventDefault();
  const input = document.querySelector('#chat-msg');
  const message = {};
  message.text = input.value;
  message.timestamp = Date.now();
  if (message.text === '') return;

  appendMessage('self', '#chat-log', message);

  sendOrQueueMessage($peer, message);

  input.value = '';
}

function appendMessage(sender, log_element, message, image) {
  const log = document.querySelector(log_element);
  const li = document.createElement('li');
  li.className = sender;
  li.innerText = message.text;
  li.dataset.timestamp = message.timestamp;
  if (image) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(image);
    img.onload = function() {
      URL.revokeObjectURL(this.src);
      scrollToEnd(log);
    };
    li.innerText = ''; // undefined on images
    li.classList.add('img');
    li.appendChild(img);
  }
  log.appendChild(li);
  scrollToEnd(log);
}

function scrollToEnd(el) {
  if (el.scrollTo) {
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    el.scrollTop = el.scrollHeight;
  }
}

function handleResponse(response) {
  const sentItem = document
    .querySelector(`#chat-log *[data-timestamp="${response.id}"]`);
  const classes = ['received'];
  if (response.timestamp - response.id > 1000) {
    classes.push('delayed');
  }
  sentItem.classList.add(...classes);
}

function queueMessage(message, push = true) {
  if (push) $self.messageQueue.push(message); // queue at the end
  else $self.messageQueue.unshift(message); // queue at the start
}

function sendOrQueueMessage(peer, message, push = true) {
  const dc = peer.chatChannel;
  if (!dc || dc.readyState !== 'open') {
    queueMessage(message, push);
    return;
  }
  if (message.file) {
    sendFile(peer, message);
  } else {
    try {
      dc.send(JSON.stringify(message));
    } catch(e) {
      console.error('Error sending message:', e);
      queueMessage(message, push);
    }
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

function addChatChannel(peer) {

  // Snip, Snip

  peer.chatChannel =
    peer.connection.createDataChannel('text chat',
      { negotiated: true, id: 100 });

  peer.chatChannel.onmessage = function(event) {
    const message = JSON.parse(event.data);
    if (!message.id) {
      // Prepare a response and append an incoming message
      const response = {
        id: message.timestamp,
        timestamp: Date.now()
      };
      sendOrQueueMessage(peer, response);
      appendMessage('peer', '#chat-log', message);
    } else {
      // Handle an incoming response
      handleResponse(message);
    }
  };

  peer.chatChannel.onclose = function(event) {
    console.log('Chat channel closed.');
  };
  peer.chatChannel.onopen = function(event) {
    console.log('Chat channel opened.');
    while ($self.messageQueue.length > 0 &&
        peer.chatChannel.readyState === 'open') {
      console.log('Attempting to send a message from the queue...');
      // get the message at the front of the queue:
      let message = $self.messageQueue.shift();
      sendOrQueueMessage(peer, message, false);
    }
  };
}
function addFeaturesChannel(peer) {

  // snip, snip, snip

  const featureFunctions = {
    audio: function() {
      const status = document.querySelector('#mic-status');
      status.setAttribute('aria-hidden', peer.features.audio);
    },
    video: function() {
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
    $self.features.binaryType = peer.featuresChannel.binaryType;
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

  // snip, snip, snip

}

function sendFile(peer, payload) {
  const { metadata, file } = payload;
  const dc = peer.connection.createDataChannel(`${metadata.kind}-${metadata.name}`);
  const chunk = 8 * 1024; // 8K chunks
  dc.onopen = async function() {
    if (!peer.features ||
      ($self.features.binaryType !== peer.features.binaryType)) {
      dc.binaryType = 'arraybuffer';
    }
    // Prepare data according to the binaryType in use
    const data = dc.binaryType === 'blob' ? file : await file.arrayBuffer();
    // Send the metadata
    dc.send(JSON.stringify(metadata));
    // Send the prepared data in chunks
    for (let i = 0; i < metadata.size; i += chunk) {
      dc.send(data.slice(i, i + chunk));
    }
  };
  dc.onmessage = function({ data }) {
    // Sending side will only ever receive a response
    handleResponse(JSON.parse(data));
    dc.close();
  };
}

function receiveFile(dc) {
  const chunks = [];
  let metadata;
  let bytesReceived = 0;
  dc.onmessage = function({ data }) {
    // Receive the metadata
    if (typeof data === 'string' && data.startsWith('{')) {
      metadata = JSON.parse(data);
    } else {
      // Receive and squirrel away chunks...
      bytesReceived += data.size ? data.size : data.byteLength;
      chunks.push(data);
      // ...until the bytes received equal the file size
      if (bytesReceived === metadata.size) {
        const image = new Blob(chunks, { type: metadata.type });
        const response = {
          id: metadata.timestamp,
          timestamp: Date.now()
        };
        appendMessage('peer', '#chat-log', metadata, image);
        // Send an acknowledgement
        try {
          dc.send(JSON.stringify(response));
        } catch(e) {
          queueMessage(response);
        }
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
  addChatChannel(peer);
  addStreamingMedia(peer);
}

function resetPeer(peer) {
  displayStream(null, '#peer');
  document.querySelector('#mic-status')
    .setAttribute('aria-hidden', true);
  peer.connection.close();
  // Probably delete everything and then start fresh here,
  // even if that means duplicating some code
  peer.connection = new RTCPeerConnection($self.rtcConfig);
  peer.mediaStream = new MediaStream();
  peer.mediaTracks = {};
  peer.features = {};
}



/**
 *  WebRTC Functions and Callbacks
 */

function registerRtcCallbacks(peer) {
  peer.connection.onconnectionstatechange = handleRtcConnectionStateChange;
  peer.connection.ondatachannel = handleRtcDataChannel;
  peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection.onicecandidate = handleRtcIceCandidate;
  peer.connection.ontrack = handleRtcPeerTrack;
}

function handleRtcPeerTrack({ track }) {
  console.log(`Handle incoming ${track.kind} track...`)
  $peer.mediaTracks[track.kind] = track;
  $peer.mediaStream.addTrack(track);
  displayStream($peer.mediaStream, '#peer');
}

function handleRtcDataChannel({ channel }) {
  const label = channel.label;
  console.log(`Data channel added for ${label}`);
  if (label.startsWith('filter-')) {
    document.querySelector('#peer').className = label;
    channel.onopen = function() {
      channel.close();
    };
  }
  if (label.startsWith('image-')) {
    receiveFile(channel);
  }
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
  console.log('Attempting to make an offer...');
  await $peer.connection.setLocalDescription();
  sc.emit('signal', { description: $peer.connection.localDescription });
  $self.isMakingOffer = false;
}

function handleRtcIceCandidate({ candidate }) {
  console.log('Attempting to handle an ICE candidate...');
  sc.emit('signal', { candidate: candidate });
}

function handleRtcConnectionStateChange() {
  const connectionState = $peer.connection.connectionState;
  console.log(`The connection state is now ${connectionState}`);
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
      sc.emit('signal', { description: $peer.connection.localDescription });
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
