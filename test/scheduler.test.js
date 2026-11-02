"use strict";

const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SunCalc = require("suncalc");
const { loadScheduler, hhmm } = require("./helpers");

const PARIS = { lat: 48.85, lon: 2.35 };
// Monday 2 November 2026
const DAY = [2026, 10, 2];

let scheduler;
let nodes;

function useTimezone(tz) {
	process.env.TZ = tz;
}

/** Sets the fake clock to a local time (30 s into the minute). */
function setClock(h, m, date = DAY) {
	mock.timers.setTime(new Date(date[0], date[1], date[2], h, m, 30).getTime());
}

function create(config) {
	const node = scheduler.createNode(config);
	nodes.push(node);
	return node;
}

/** Evaluates the node at the given local time and returns [output1, output2]. */
function evaluateAt(node, h, m, date) {
	setClock(h, m, date);
	node.receive({});
	return node.lastSent();
}

function localSunTime(event, offset, lat, lon, date = DAY) {
	const noon = new Date(date[0], date[1], date[2], 12, 0);
	const t = SunCalc.getTimes(noon, lat, lon, 0, -noon.getTimezoneOffset())[event];
	return (((t.getHours() * 60 + t.getMinutes() + offset) % 1440) + 1440) % 1440;
}

beforeEach(() => {
	useTimezone("Europe/Paris");
	mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: new Date(2026, 10, 2, 0, 0, 30) });
	scheduler = loadScheduler();
	nodes = [];
});

afterEach(() => {
	nodes.forEach((n) => n.emit("close"));
	mock.timers.reset();
});

describe("fixed time slot", () => {
	it("is off before On Time", () => {
		const node = create({ starttime: "420", endtime: "480" });
		const [, status] = evaluateAt(node, 6, 59);
		assert.equal(status.payload, "0");
		assert.equal(node.lastStatus().text, "off");
	});

	it("turns on exactly at On Time", () => {
		const node = create({ starttime: "420", endtime: "480" });
		const [, status] = evaluateAt(node, 7, 0);
		assert.equal(status.payload, "1");
		assert.equal(node.lastStatus().text, "on for 60 mins");
	});

	it("is still on the minute before Off Time", () => {
		const node = create({ starttime: "420", endtime: "480" });
		assert.equal(evaluateAt(node, 7, 59)[1].payload, "1");
		assert.equal(node.lastStatus().text, "on for 1 mins");
	});

	it("turns off exactly at Off Time (Off Time is excluded)", () => {
		const node = create({ starttime: "420", endtime: "480" });
		assert.equal(evaluateAt(node, 8, 0)[1].payload, "0");
	});

	it("is never on when On Time equals Off Time", () => {
		const node = create({ starttime: "420", endtime: "420" });
		assert.equal(evaluateAt(node, 7, 0)[1].payload, "0");
	});
});

describe("crossing midnight", () => {
	it("handles a fixed 22:00 -> 06:00 slot", () => {
		const node = create({ starttime: "1320", endtime: "360" });
		assert.equal(evaluateAt(node, 21, 59)[1].payload, "0");
		assert.equal(evaluateAt(node, 22, 0)[1].payload, "1");
		assert.equal(evaluateAt(node, 3, 0)[1].payload, "1");
		assert.equal(node.lastStatus().text, "on for 180 mins");
		assert.equal(evaluateAt(node, 6, 0)[1].payload, "0");
	});

	it("handles a duration ending after midnight (23:45 + 30 minutes)", () => {
		const node = create({ starttime: "1425", endtime: "10030" });
		assert.equal(evaluateAt(node, 23, 45)[1].payload, "1");
		assert.equal(evaluateAt(node, 0, 10)[1].payload, "1");
		assert.equal(node.lastStatus().text, "on for 5 mins");
		assert.equal(evaluateAt(node, 0, 15)[1].payload, "0");
	});
});

describe("durations", () => {
	it("a 1 minute duration lasts exactly one minute", () => {
		const node = create({ starttime: "600", endtime: "10001" });
		assert.equal(evaluateAt(node, 10, 0)[1].payload, "1");
		assert.equal(evaluateAt(node, 10, 1)[1].payload, "0");
	});

	it("a 120 minutes duration", () => {
		const node = create({ starttime: "600", endtime: "10120" });
		assert.equal(evaluateAt(node, 11, 59)[1].payload, "1");
		assert.equal(evaluateAt(node, 12, 0)[1].payload, "0");
	});
});

describe("output 1 (change)", () => {
	it("sends nothing on the first evaluation, even when on", () => {
		const node = create({ starttime: "420", endtime: "480" });
		const [change, status] = evaluateAt(node, 7, 30);
		assert.equal(change, null);
		assert.equal(status.payload, "1");
	});

	it("sends the ON message with the topic when turning on", () => {
		const node = create({ starttime: "420", endtime: "480" });
		evaluateAt(node, 6, 59);
		assert.deepEqual(evaluateAt(node, 7, 0)[0], { topic: "light", payload: "ON" });
	});

	it("sends the OFF message when turning off", () => {
		const node = create({ starttime: "420", endtime: "480" });
		evaluateAt(node, 7, 59);
		assert.deepEqual(evaluateAt(node, 8, 0)[0], { topic: "light", payload: "OFF" });
	});

	it("sends nothing while the state does not change", () => {
		const node = create({ starttime: "420", endtime: "480" });
		evaluateAt(node, 7, 0);
		assert.equal(evaluateAt(node, 7, 1)[0], null);
		assert.equal(evaluateAt(node, 7, 30)[0], null);
	});

	it("is forced by a reset message", () => {
		const node = create({ starttime: "420", endtime: "480" });
		evaluateAt(node, 7, 10);
		node.receive({ payload: "reset" });
		assert.deepEqual(node.lastSent()[0], { topic: "light", payload: "ON" });
	});
});

describe("output 2 (status)", () => {
	it("always sends the status topic with \"1\" or \"0\"", () => {
		const node = create({ starttime: "420", endtime: "480" });
		assert.deepEqual(evaluateAt(node, 6, 0)[1], { topic: "status", payload: "0" });
		assert.deepEqual(evaluateAt(node, 7, 0)[1], { topic: "status", payload: "1" });
		assert.deepEqual(evaluateAt(node, 7, 1)[1], { topic: "status", payload: "1" });
	});
});

describe("timers", () => {
	it("evaluates 2 seconds after start-up, then every minute", () => {
		setClock(10, 0);
		const node = create({});
		mock.timers.tick(1999);
		assert.equal(node.sent.length, 0);
		mock.timers.tick(1);
		assert.equal(node.sent.length, 1);
		mock.timers.tick(60000 * 3);
		assert.equal(node.sent.length, 4);
	});

	it("emits a change from the minute timer", () => {
		setClock(6, 58);
		const node = create({ starttime: "420", endtime: "480" });
		mock.timers.tick(2000);
		mock.timers.tick(60000);
		mock.timers.tick(60000);
		assert.deepEqual(node.lastSent()[0], { topic: "light", payload: "ON" });
	});

	it("stops evaluating once closed", () => {
		const node = create({});
		mock.timers.tick(2000);
		node.emit("close");
		const count = node.sent.length;
		mock.timers.tick(60000 * 5);
		assert.equal(node.sent.length, count);
	});
});

describe("dawn and dusk", () => {
	it("starts at dusk", () => {
		const node = create({ starttime: "6000", endtime: "1380" });
		const dusk = localSunTime("sunset", 0, PARIS.lat, PARIS.lon);
		assert.equal(evaluateAt(node, Math.floor((dusk - 1) / 60), (dusk - 1) % 60)[1].payload, "0");
		assert.equal(evaluateAt(node, Math.floor(dusk / 60), dusk % 60)[1].payload, "1");
	});

	it("applies a negative dusk offset", () => {
		const node = create({ starttime: "6000", endtime: "1380", duskoff: "-30" });
		const dusk = localSunTime("sunset", -30, PARIS.lat, PARIS.lon);
		assert.equal(evaluateAt(node, Math.floor((dusk - 1) / 60), (dusk - 1) % 60)[1].payload, "0");
		assert.equal(evaluateAt(node, Math.floor(dusk / 60), dusk % 60)[1].payload, "1");
	});

	it("ends at dawn with a positive dawn offset", () => {
		const node = create({ starttime: "0", endtime: "5000", dawnoff: "15" });
		const dawn = localSunTime("sunrise", 15, PARIS.lat, PARIS.lon);
		assert.equal(evaluateAt(node, Math.floor((dawn - 1) / 60), (dawn - 1) % 60)[1].payload, "1");
		assert.equal(evaluateAt(node, Math.floor(dawn / 60), dawn % 60)[1].payload, "0");
	});

	it("reports an error status and stays off during polar night", () => {
		const node = create({ lat: "80", lon: "15", starttime: "5000", endtime: "6000" });
		assert.equal(evaluateAt(node, 12, 0, [2026, 11, 21])[1].payload, "0");
		assert.equal(node.lastStatus().fill, "red");
		assert.equal(node.errors.length, 0);
	});
});

describe("days and months", () => {
	it("is off on a disabled day of the week", () => {
		const node = create({ starttime: "0", endtime: "1425", mon: false });
		assert.equal(evaluateAt(node, 12, 0)[1].payload, "0");
		assert.equal(evaluateAt(node, 12, 0, [2026, 10, 3])[1].payload, "1"); // Tuesday
	});

	it("is off in a disabled month", () => {
		const node = create({ starttime: "0", endtime: "1425", nov: false });
		assert.equal(evaluateAt(node, 12, 0)[1].payload, "0");
		assert.equal(evaluateAt(node, 12, 0, [2026, 11, 7])[1].payload, "1"); // December
	});
});

describe("legacy configuration values", () => {
	const legacy = { 1315: "21:45", 1330: "22:00", 1390: "23:00", 1435: "23:45" };
	for (const [value, label] of Object.entries(legacy)) {
		it(`On Time ${value} is read as ${label}`, () => {
			const node = create({ starttime: value, endtime: "0" });
			const [h, m] = label.split(":").map(Number);
			assert.equal(evaluateAt(node, h, m - 1)[1].payload, "0");
			assert.equal(evaluateAt(node, h, m)[1].payload, "1");
		});
	}
});

describe("admin endpoint (node button)", () => {
	it("forces output 1 and answers 200", () => {
		const node = create({ starttime: "420", endtime: "480" });
		evaluateAt(node, 7, 10);
		assert.equal(scheduler.postAdmin(node.id), 200);
		assert.deepEqual(node.lastSent()[0], { topic: "light", payload: "ON" });
	});

	it("answers 404 for an unknown node", () => {
		assert.equal(scheduler.postAdmin("unknown"), 404);
	});
});

describe("time zones", () => {
	const zones = [
		{ tz: "America/New_York", lat: 40.7, lon: -74 },
		{ tz: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
		{ tz: "Pacific/Auckland", lat: -36.85, lon: 174.76 },
		{ tz: "Asia/Tokyo", lat: PARIS.lat, lon: PARIS.lon }
	];
	for (const z of zones) {
		describe(`${z.tz} at (${z.lat}, ${z.lon})`, () => {
			beforeEach(() => useTimezone(z.tz));

			it("uses local time for fixed slots", () => {
				const node = create({ lat: String(z.lat), lon: String(z.lon), starttime: "420", endtime: "480" });
				assert.equal(evaluateAt(node, 6, 59)[1].payload, "0");
				assert.equal(evaluateAt(node, 7, 0)[1].payload, "1");
				assert.equal(evaluateAt(node, 8, 0)[1].payload, "0");
			});

			it("uses the dusk of the local day", () => {
				const node = create({ lat: String(z.lat), lon: String(z.lon), starttime: "6000", endtime: "10001" });
				const dusk = localSunTime("sunset", 0, z.lat, z.lon);
				assert.equal(evaluateAt(node, Math.floor(dusk / 60), dusk % 60)[1].payload, "1",
					`expected on at ${hhmm(dusk)}`);
			});
		});
	}
});

describe("editor (scheduler.html)", () => {
	const html = fs.readFileSync(path.join(__dirname, "..", "scheduler.html"), "utf8");

	it("registers the help under the node type name", () => {
		assert.match(html, /data-help-name="scheduler"/);
		assert.match(html, /data-template-name="scheduler"/);
		assert.match(html, /registerType\("scheduler"/);
	});

	it("does not reference an undefined label in the button callback", () => {
		assert.match(html, /var label = this\.name \|\| "scheduler";/);
	});
});
