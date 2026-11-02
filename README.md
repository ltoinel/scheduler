# Scheduler for Node-RED

[![CI](https://github.com/ltoinel/node-red-contrib-scheduler-plus/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/ltoinel/node-red-contrib-scheduler-plus/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fltoinel%2Fnode-red-contrib-scheduler-plus%2Fbadges%2Fcoverage.json)](https://github.com/ltoinel/node-red-contrib-scheduler-plus/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/node-red-contrib-scheduler-plus?logo=npm)](https://www.npmjs.com/package/node-red-contrib-scheduler-plus)
[![npm downloads](https://img.shields.io/npm/dm/node-red-contrib-scheduler-plus)](https://www.npmjs.com/package/node-red-contrib-scheduler-plus)
[![Node-RED](https://img.shields.io/badge/Node--RED-%3E%3D1.0-8f0000?logo=nodered)](https://flows.nodered.org/node/node-red-contrib-scheduler-plus)
[![Node.js](https://img.shields.io/node/v/node-red-contrib-scheduler-plus?logo=nodedotjs)](https://nodejs.org)

A scheduler node for [Node-RED](https://nodered.org) offering better timing facilities than the
standard inject node: fixed times, dawn and dusk (handy for lighting), days of the week and months.

Originally written by Peter Scargill — see http://tech.scargill.net/node-red-scheduler/

## Requirements

- Node-RED >= 1.0
- Node.js >= 14
- [suncalc](https://github.com/mourner/suncalc) ^2.1.1 (installed automatically)

## Installation

The node is listed in the [Node-RED Flow Library](https://flows.nodered.org/node/node-red-contrib-scheduler-plus).

From the Node-RED palette manager, search for **node-red-contrib-scheduler-plus**, or from your
Node-RED user directory (usually `~/.node-red`):

```sh
npm install node-red-contrib-scheduler-plus
```

Then restart Node-RED. The node appears in the **input** category of the palette.

> This is a maintained fork of `node-red-contrib-scheduler`, whose npm package is the original
> version and does not include the fixes below. Remove it before installing this one: both provide
> the same `scheduler` node type.

## Configuration

| Field         | Description |
|---------------|-------------|
| On Time       | Start time, in 15-minute steps, or *Dawn* / *Dusk*. |
| Off Time      | End time, in 15-minute steps, *Dawn* / *Dusk*, or a duration from On Time (1 to 120 minutes). |
| Dawn / Dusk Offset | Minutes added to dawn / dusk: positive for later, negative for earlier. |
| Latitude / Longitude | Location used to compute dawn and dusk. Filled from the browser geolocation if left empty. |
| Topic         | `msg.topic` of the messages sent on output 1. |
| ON / OFF Msg  | `msg.payload` sent on output 1 when the schedule turns on / off. |
| Days / Months | Days of the week and months on which the schedule is active. |

The schedule is active from **On Time (included) until Off Time (excluded)**, and may cross midnight
(e.g. 22:00 → 06:00). Dawn is sunrise and dusk is sunset, computed for the current day.

All times use the **local time zone of the Node-RED server**: make sure it matches the location you configure.

## Outputs

1. **Change** — sends `{ topic: <Topic>, payload: <ON Msg | OFF Msg> }` when the state changes,
   or when the button of the node is pressed. Nothing is sent at start-up: the first evaluation only
   initialises the state.
2. **Status** — sends `{ topic: "status", payload: "1" | "0" }` every minute.

The node status shows the remaining time when on, `off` otherwise, and a red status when there is no
dawn or dusk on that day (polar day or night at high latitudes).

## Development

```sh
git clone https://github.com/ltoinel/node-red-contrib-scheduler-plus.git
cd scheduler
npm install        # also enables the git hooks
npm run lint       # ESLint
npm test           # unit tests (node:test)
npm run coverage   # tests + coverage report, fails under 90% of lines
```

Git hooks (in `.githooks/`, enabled by `npm install`):

- **pre-commit** runs the lint,
- **pre-push** runs the unit tests.

### Releasing

1. Bump `version` in `package.json` and update the changelog.
2. Create a GitHub release with the tag `v<version>` (e.g. `v1.1.0`).
3. The [Release](.github/workflows/release.yml) workflow lints, tests and publishes to npm with provenance.

## Changelog

### 1.1.3
- **Breaking change:** the node type is renamed from `scheduler` to `scheduler-plus`, so it no longer clashes with `node-red-contrib-scheduler` and `node-red-contrib-majordomus`. Existing flows show the old nodes as unknown: export the flow, replace `"type": "scheduler"` with `"type": "scheduler-plus"`, then import it again.
- Added a `LICENSE` file and the `license` field in `package.json` (same terms as before).
- Added an example flow, available in Node-RED under Import > Examples.

### 1.1.2
- Repository URLs updated to `ltoinel/node-red-contrib-scheduler-plus` (fixes npm provenance on publish).

### 1.1.1
- The npm publishing workflow is renamed to `release.yml`.

### 1.1.0
- Fixed wrong On Time values between 21:45 and 23:45 (offset by 10 minutes); existing flows are migrated automatically.
- Fixed a one-minute delay and negative values in the time computation.
- Fixed schedules with a duration crossing midnight.
- The button of the node sends on output 1 again.
- Fixed the help panel and the button notification.
- No crash when there is no dawn or dusk (polar regions).
- Updated to Node-RED >= 1.0 APIs and suncalc 2.x.
- New SVG icon.
- Published on npm as `node-red-contrib-scheduler-plus`, with unit tests, lint and CI.
- **Behaviour change:** Off Time is now excluded (a 07:00–08:00 slot turns off at 08:00, not 08:01).

### 1.0.0
- Initial version by Peter Scargill.

## License

See [LICENSE](LICENSE). Free to use for whatever purpose you like. If you redesign it, please keep the original author's name and link
(http://tech.scargill.net).
