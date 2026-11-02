/**
 * Mostly - apart from the Sunrise module on which this depends this is
 * copyright (c) Peter Scargill - but as I've had so many ideas from others -
 * consider it free to use for whatever purpose you like. If you redesign it
 * please remember to drop my name and link in there somewhere.
 * http://tech.scargill.net This software puts out one of two messages on change
 * of state which could be sent to the MQTT node. It evaluates its schedule
 * once every minute.
 */

module.exports = function (RED) {
	"use strict";
	var SunCalc = require("suncalc");

	var MINUTES_PER_DAY = 1440;
	var DAWN = 5000;
	var DUSK = 6000;
	var DURATION_BASE = 10000;

	var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	var MONTHS = ["jan", "feb", "mar", "apr", "may", "jun",
		"jul", "aug", "sep", "oct", "nov", "dec"];

	// Earlier versions of the editor stored wrong values for the
	// 21:45 -> 23:45 "On Time" entries (offset by 10 minutes).
	var LEGACY_TIMES = {
		1315: 1305, 1330: 1320, 1345: 1335, 1360: 1350, 1375: 1365,
		1390: 1380, 1405: 1395, 1420: 1410, 1435: 1425
	};

	function wrap(minutes) {
		return ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	}

	function minutesOfDay(date) {
		return date.getHours() * 60 + date.getMinutes();
	}

	function parseTime(value) {
		var t = parseInt(value, 10);
		if (isNaN(t)) {
			return NaN;
		}
		return Object.prototype.hasOwnProperty.call(LEGACY_TIMES, t) ? LEGACY_TIMES[t] : t;
	}

	function SchedulerNode(n) {
		RED.nodes.createNode(this, n);
		var node = this;

		node.lat = Number(n.lat);
		node.lon = Number(n.lon);
		node.start = n.start || "sunrise";
		node.end = n.end || "sunset";
		node.startt = parseTime(n.starttime);
		node.endt = parseTime(n.endtime);
		node.duskOff = Number(n.duskoff) || 0;
		node.dawnOff = Number(n.dawnoff) || 0;
		node.outtopic = n.outtopic;
		node.outPayload1 = n.outpayload1;
		node.outPayload2 = n.outpayload2;
		node.days = DAYS.map(function (d) { return !!n[d]; });
		node.months = MONTHS.map(function (m) { return !!n[m]; });

		// null = state unknown (just started): the first evaluation only
		// initialises the state and does not emit on output 1.
		var lastState = null;

		function resolve(value, dawn, dusk) {
			if (value === DAWN) { return dawn; }
			if (value === DUSK) { return dusk; }
			return value;
		}

		function evaluate(now) {
			// utcOffset pins the computation to the local calendar day of the server
			var times = SunCalc.getTimes(now, node.lat, node.lon, 0, -now.getTimezoneOffset());
			var sunrise = times[node.start];
			var sunset = times[node.end];
			var dawn = NaN;
			var dusk = NaN;
			if (sunrise && !isNaN(sunrise.getTime())) {
				dawn = wrap(minutesOfDay(sunrise) + node.dawnOff);
			}
			if (sunset && !isNaN(sunset.getTime())) {
				dusk = wrap(minutesOfDay(sunset) + node.duskOff);
			}

			var startTime = resolve(node.startt, dawn, dusk);
			var endTime;
			if (node.endt > DURATION_BASE) {
				endTime = wrap(startTime + (node.endt - DURATION_BASE));
			} else {
				endTime = resolve(node.endt, dawn, dusk);
			}

			if (isNaN(startTime) || isNaN(endTime)) {
				// e.g. no sunrise/sunset at this latitude today
				return { on: false, error: "no dawn/dusk today" };
			}

			if (!node.days[now.getDay()] || !node.months[now.getMonth()]) {
				return { on: false };
			}

			// Active interval is [startTime, endTime), handling midnight wrap.
			var today = minutesOfDay(now);
			var on;
			if (startTime <= endTime) {
				on = today >= startTime && today < endTime;
			} else {
				on = today >= startTime || today < endTime;
			}
			return { on: on, remaining: on ? wrap(endTime - today) : 0 };
		}

		node.on("input", function (inmsg, send, done) {
			send = send || function () { node.send.apply(node, arguments); };
			var forced = !!(inmsg && inmsg.payload === "reset");
			var result;
			try {
				result = evaluate(new Date());
			} catch (err) {
				if (done) { done(err); } else { node.error(err, inmsg); }
				return;
			}

			if (result.error) {
				node.status({ fill: "red", shape: "ring", text: result.error });
			} else if (result.on) {
				node.status({ fill: "yellow", shape: "dot", text: "on for " + result.remaining + " mins" });
			} else {
				node.status({ fill: "blue", shape: "dot", text: "off" });
			}

			var changed = lastState !== null && lastState !== result.on;
			lastState = result.on;

			var outmsg = null;
			if (forced || changed) {
				outmsg = {
					topic: node.outtopic,
					payload: result.on ? node.outPayload1 : node.outPayload2
				};
			}
			var outmsg2 = { topic: "status", payload: result.on ? "1" : "0" };

			send([outmsg, outmsg2]);
			if (done) { done(); }
		});

		// wait 2 secs before starting to let things settle down - e.g. UI connect
		var tock = setTimeout(function () {
			tock = null;
			node.receive({});
		}, 2000);

		var tick = setInterval(function () {
			node.receive({});
		}, 60000); // trigger every 60 secs

		node.on("close", function () {
			if (tock) {
				clearTimeout(tock);
				tock = null;
			}
			clearInterval(tick);
		});
	}

	RED.nodes.registerType("scheduler", SchedulerNode);

	RED.httpAdmin.post("/scheduler/:id", RED.auth.needsPermission("scheduler.write"), function (req, res) {
		var node = RED.nodes.getNode(req.params.id);
		if (node === null || node === undefined) {
			res.sendStatus(404);
			return;
		}
		try {
			node.receive({ payload: "reset" });
			res.sendStatus(200);
		} catch (err) {
			res.sendStatus(500);
			node.error("Inject failed: " + err);
		}
	});
};
