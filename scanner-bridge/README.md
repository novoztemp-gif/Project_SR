# SR Billing Scanner Bridge

Lets the "Scan from Scanner" button in SR Billing find your printer/scanner
— network (WiFi/LAN) or USB, any brand — and pull a scanned bill straight
into the app with one click, without the browser needing to talk to the
scanner directly (browsers aren't allowed to do that for security reasons,
no matter the printer).

**How it works:** this is a small program that runs on the counter's
computer, not in the browser — so unlike the browser, it's free to talk to
scanner hardware directly, using the right mechanism for each connection type:

- **Network scanner (WiFi/LAN):** found automatically (or add its IP once),
  driven directly over its own scanning protocol (eSCL) when you click it.
- **USB scanner — Windows:** listed and driven via Windows' built-in
  scanner API (WIA) through PowerShell — nothing extra to install beyond
  Node.js.
- **USB scanner — Mac/Linux:** listed and driven via
  [SANE](http://sane-project.org/) (`scanimage`) — install it once with
  `brew install sane-backends` (Mac) or your distro's package manager
  (Linux).
- **Fallback, any scanner:** if a scanner doesn't show up in the list for
  any reason, its own "Scan to PC" / "Scan to Folder" software still works
  — the Bridge also watches a folder and picks up files saved there.

## Deploying to a client's Windows PC (no Node.js, no terminal)

This is the real deployment path — for a client's counter computer, not a
developer machine. It ships as just two files: `scanner-bridge.exe` (a
standalone build with Node.js already bundled inside it — nothing else to
install) and `install.bat`.

1. Build the exe once, from a machine with this source checked out:
   ```
   npm install
   npm run build:exe
   ```
   This produces `dist-exe/scanner-bridge.exe`.
2. Copy `dist-exe/scanner-bridge.exe` and `install.bat` together onto the
   client's PC (USB stick, file transfer during a remote-support session,
   however's convenient) — into the same folder.
3. Double-click **`install.bat`**. It copies the program into Windows'
   Startup folder (so it launches automatically every login, no shortcut or
   admin rights needed) and starts it immediately so you can test right
   away.
4. That's it — nothing else to install, no Node.js, no npm. The client
   never has to touch this again; it just runs quietly in the background
   from every login onward.

This part (packaging into a single .exe) hasn't been run against a real
Windows machine or real scanner hardware yet — only verified as a valid
Windows executable and functionally tested as plain Node.js. The first real
install on an actual client PC is also its first real-world test.

## Developer / source setup — Windows

If you're working on this code directly (not deploying to a client) and
have Node.js installed:

1. Install [Node.js](https://nodejs.org) (the LTS version) if it isn't
   already on this computer. (WIA, used for USB scanners, is already built
   into Windows — nothing else to install.)
2. Open a terminal in this folder and run `npm install`.
3. Double-click **`start.bat`** to run it, or `npm start` from the terminal.

## One-time setup — Mac/Linux

1. Install [Node.js](https://nodejs.org) (the LTS version) if it isn't
   already on this computer.
2. For USB scanner support, install SANE — `brew install sane-backends` on
   Mac, or `sudo apt install sane-utils` on Debian/Ubuntu.
3. Open a terminal in this folder and run `npm install`, then `npm start`.

**Mac only — one extra step the first time:** macOS will likely ask for
"Local Network" permission the first time this runs, needed to find network
scanners. If it doesn't ask, or scanners still don't show up, check System
Settings → Privacy & Security → Local Network and make sure Terminal (or
whichever app you launched this from) is allowed.

## Every day use

1. On a client PC set up via `install.bat`, this already happened
   automatically on login — nothing to start. Otherwise (developer/source
   setup), start it — double-click `start.bat` on Windows, or run
   `npm start` in a terminal on Mac/Linux — and leave the window open.
2. In SR Billing, click **Scan from Scanner**.
3. Pick your scanner from the list and click it — it scans immediately, no
   other software needed. If it's not listed, click **Refresh**, or enter
   its IP address for a network scanner.
4. Review the scan in the popup and click **Use this scan**.

If the popup says "Scanner Bridge isn't running," this program isn't
started, or was closed. Start it again and click **Retry connection**.

## Notes

- This only listens on `127.0.0.1` (this computer only) — nothing about it
  is reachable from the network or the internet.
- Network scanner auto-discovery uses mDNS/Bonjour (the same mechanism macOS
  and Windows use). Some networks (guest WiFi, VLANs, certain routers) block
  this — the manual IP entry always works as a fallback.
- To use a different watched folder, set the `SCAN_FOLDER` environment
  variable before running `npm start`. To use a different local port
  (default `8787`), set `SCAN_BRIDGE_PORT`.
