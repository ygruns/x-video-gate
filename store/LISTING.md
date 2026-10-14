# Chrome Web Store listing — paste-ready

Upload: `store/x-video-gate-1.4.0.zip`

## Store listing tab

**Description**

Blocks videos on X (Twitter) from accounts you don't follow.

A blocked video is covered with a "Play in new tab" button. Tapping it opens just that one video on a bare page: no feed around it, nothing to scroll to next. Videos from accounts you follow play as usual, and GIFs are never blocked.

Turning blocking off, or adding an account to the always-allow list, takes two confirmations with a 15-second wait between them.

Everything runs on your device. The extension makes no network requests of its own and sends nothing anywhere.

Source code: https://github.com/ygruns/x-video-gate

**Category:** Well-being (or Tools)
**Language:** English
**Store icon:** `extension/icon128.png`
**Screenshot:** `store/screenshot_1280x800.png`

## Privacy tab

**Single purpose**

Blocks video playback on X (Twitter) from accounts the user does not follow, and lets the user open a single blocked video in its own tab.

**Justification — storage**

Saves the user's settings (blocking on/off and the always-allow list) and, briefly, the link of the one video being opened in the player tab. All of it stays in local extension storage.

**Justification — host permissions (x.com, twitter.com)**

The content scripts run only on X. They read X's own API responses in the page to learn who posted each video and whether the user follows that account, then cover the videos that should be blocked. Nothing is sent off the device.

**Remote code:** No, I am not using remote code.

**Data usage:** tick none of the data types; tick all three certification boxes.

**Privacy policy URL:** https://github.com/ygruns/x-video-gate#privacy

## Distribution tab

**Visibility:** Unlisted
**Regions:** all
**Payments:** free
