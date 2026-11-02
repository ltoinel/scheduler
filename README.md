# Scheduler for Node-RED

A scheduler node for [Node-RED](https://nodered.org) offering better timing facilities than the
standard inject node: fixed times, dawn and dusk (handy for lighting), days of the week and months.

Originally written by Peter Scargill — see http://tech.scargill.net/node-red-scheduler/

## Requirements

- Node-RED >= 1.0
- Node.js >= 14
- [suncalc](https://github.com/mourner/suncalc) ^2.1.1 (installed automatically)

## Installation

> The `node-red-contrib-scheduler` package published on npm is the original version and does not
> include the fixes of this fork. Install from this repository instead.

From your Node-RED user directory (usually `~/.node-red`):

```sh
npm install github:ltoinel/scheduler
```

or from a local clone:

```sh
git clone https://github.com/ltoinel/scheduler.git
cd ~/.node-red
npm install /path/to/scheduler
```

Then restart Node-RED. The node appears in the **input** category of the palette.

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

## Changelog

### 1.1.0
- Fixed wrong On Time values between 21:45 and 23:45 (offset by 10 minutes); existing flows are migrated automatically.
- Fixed a one-minute delay and negative values in the time computation.
- Fixed schedules with a duration crossing midnight.
- The button of the node sends on output 1 again.
- Fixed the help panel and the button notification.
- No crash when there is no dawn or dusk (polar regions).
- Updated to Node-RED >= 1.0 APIs and suncalc 2.x.
- **Behaviour change:** Off Time is now excluded (a 07:00–08:00 slot turns off at 08:00, not 08:01).

### 1.0.0
- Initial version by Peter Scargill.

## License

Free to use for whatever purpose you like. If you redesign it, please keep the original author's name and link
(http://tech.scargill.net).
