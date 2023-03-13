/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

module.exports = {
  'DC Chat Images Test' : function (browser) {
    const env_key = process.env.__NIGHTWATCH_ENV_KEY;
    // console.log("ENV_KEY", env_key);
    const passiveClient = env_key.endsWith('_1');
    browser.url(`${browser.launchUrl}/dc-chat-images/#4134710`);

    if (passiveClient) {
      browser.click('#call-button');
      browser.pause(500);
      browser.assert.domPropertyEquals('#peer', 'readyState', 4);
      browser.click('#self');
      browser.assert.domPropertyEquals('#self', 'className', 'filter-grayscale');
      browser.pause(1000);
    } else {
      browser.expect.element('#header h1').text.to.equal('Welcome to Room #4134710');
      browser.assert.visible('#self');
      browser.assert.visible('#peer');
      browser.assert.domPropertyEquals('#self', 'readyState', 4);
      browser.click('#call-button');
      browser.pause(500);
      browser.assert.domPropertyEquals('#peer', 'readyState', 4);
      browser.pause(1000);
      browser.assert.domPropertyEquals('#peer', 'className', 'filter-grayscale');
    }

    browser.end();

  }
};
