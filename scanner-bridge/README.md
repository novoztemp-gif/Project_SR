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

## One-time setup

1. Install [Node.js](https://nodejs.org) (the LTS version) if it isn't
   already on this computer.
2. **Mac/Linux only**, for USB scanner support: install SANE —
   `brew install sane-backends` on Mac, or `sudo apt install sane-utils` on
   Debian/Ubuntu. (Windows doesn't need this — WIA is built in.)
3. Open a terminal in this folder and run:
   ```
   npm install
   ```
4. Start it:
   ```
   npm start
   ```
   You'll see a message telling you which folder it's watching (used only
   for the folder-fallback method above).

**Mac only — one extra step the first time:** macOS will likely ask for
"Local Network" permission the first time this runs, needed to find network
scanners. If it doesn't ask, or scanners still don't show up, check System
Settings → Privacy & Security → Local Network and make sure Terminal (or
whichever app you launched this from) is allowed.

## Every day use

1. Start this program (`npm start` in this folder) and leave the window open.
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
