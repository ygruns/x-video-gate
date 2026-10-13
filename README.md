# X Video Gate

Browser extension (Manifest V3) that blocks videos on X/Twitter from accounts
you don't follow. GIFs are left alone. A blocked video shows a "Play in new tab" button
that opens just that one video on a bare page, with no feed around it.

Turning blocking off or adding an account to the allowlist takes two confirmations with a 15-second wait between them.

## Install

Download `x-video-gate.zip` from the
[latest release](https://github.com/ygruns/x-video-gate/releases/latest)
and load it from your browser's extensions page (developer mode), or unzip it
and use "Load unpacked" pointing at the folder.

## Update

A sideloaded extension does not update itself. Download the newest zip from
the link above and load it again.

## Build

    py build.py

writes `dist/x-video-gate.zip` from the `extension/` folder.

## Privacy

The extension collects nothing. It reads X's page data in your browser to
decide which videos to block, keeps your settings in local extension storage,
and makes no network requests of its own.
