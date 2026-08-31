# Rana54 Network Operations

The cross-tenant operations workspace for authorized Rana54 staff. A self-contained front-end prototype: no build step, no dependencies, no backend. It is intentionally separate from the enterprise dashboard, enterprise administration, homeowner, and installer applications.

## Run it

You need any modern browser and one small local web server. Pick whichever you have:

**Python 3** (preinstalled on macOS and most Linux):

```bash
python3 -m http.server 4183
```

**Node.js:**

```bash
npx serve -l 4183 .
```

Run the command from this folder, then open:

http://127.0.0.1:4183/#/overview

Double-clicking `index.html` also works in most browsers, but the local server is the reliable path.

## What is inside

- `index.html`: application entry point
- `styles.css`: the full RANA54 design system and responsive layout
- `data.js`: seeded demo network data
- `app.js`: routing, views, forms, validation, state transitions, search, exports, and audit behavior
- `assets/`: official Rana54 mark
- `fonts/`: Jagerlay and Goli brand fonts
- `DESIGN_HANDOFF.md`: full specification of every view, button, and rule

## Included in this phase

- Cross-platform operational overview with platform health
- Enterprise onboarding and initial administrator invitation
- Site request approval and return
- Installation job creation, assignment, and acceptance review
- Gateway identity, function mapping, and safe diagnostics
- Incident acknowledgement, assignment, resolution, and reopening
- Rana54 staff access and time-limited read-only support grants
- Platform service health and immutable audit history
- Global identifier search

## Good to know

- Changes persist only in your browser, under the localStorage key `rana54-control-centre-v2-state`. Delete that key (or clear site data) to return to the seeded demo state.
- CSV exports are generated in the browser.
- Hash routes support direct navigation, for example `#/incidents`.
- The prototype does not edit raw readings, expose secrets, hard delete records, or grant unaudited tenant access.
