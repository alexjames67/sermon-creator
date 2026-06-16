# Mantle — Deploy Monitor (Chrome extension)

Overrides Chrome's **new tab** page with a live view of Mantle's Vercel
deployments. While a build is in flight, the status dot pulses and the header
shows `● building`; it polls every 5 seconds so you can watch a deploy go from
`queued → building → ready` (or `error`) without leaving the browser.

## Load it (unpacked)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Open a new tab. The first time, you'll see the **Connect to Vercel** form.

## Connect

- **Vercel access token** — create one at
  [vercel.com/account/tokens](https://vercel.com/account/tokens). Read scope is
  enough. Stored only in `chrome.storage.local` on this machine.
- **Project name or ID** — e.g. `mantle` (the Vercel project slug).
- **Team ID** — only needed if the project lives under a Vercel team.

Click **Save & connect**. Use the ⚙ button any time to change settings, and ↻
to refresh immediately.

## Data source

`GET https://api.vercel.com/v6/deployments?app=<project>&limit=20` with a
`Bearer` token. See the
[Vercel REST API](https://vercel.com/docs/rest-api/endpoints/deployments).

> Note: this is a browser extension and is **not** served by `next dev`. Verify
> it by loading it unpacked in Chrome as above — the repo's preview server only
> runs the Mantle web app.
