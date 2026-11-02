"use strict";

const EventEmitter = require("node:events");
const path = require("node:path");

const DAYS_AND_MONTHS = [
	"sun", "mon", "tue", "wed", "thu", "fri", "sat",
	"jan", "feb", "mar", "apr", "may", "jun",
	"jul", "aug", "sep", "oct", "nov", "dec"
];

/**
 * Loads scheduler.js against a minimal fake Node-RED runtime.
 * Returns helpers to create nodes and call the admin HTTP endpoint.
 */
function loadScheduler() {
	const registry = new Map();
	let Constructor = null;
	let adminRoute = null;

	const RED = {
		nodes: {
			createNode() {},
			registerType(type, ctor) {
				if (type === "scheduler") {
					Constructor = ctor;
				}
			},
			getNode(id) {
				return registry.get(id) || null;
			}
		},
		httpAdmin: {
			post(route, permission, handler) {
				adminRoute = handler;
			}
		},
		auth: {
			needsPermission() {
				return function (req, res, next) { next(); };
			}
		}
	};

	const modulePath = path.join(__dirname, "..", "scheduler.js");
	delete require.cache[require.resolve(modulePath)];
	require(modulePath)(RED);

	function createNode(config) {
		const node = new EventEmitter();
		node.id = "n" + (registry.size + 1);
		node.sent = [];
		node.statuses = [];
		node.errors = [];
		node.send = (msgs) => node.sent.push(msgs);
		node.status = (s) => node.statuses.push(s);
		node.error = (e) => node.errors.push(e);
		node.receive = (msg) => node.emit("input", msg, node.send, () => {});
		node.lastStatus = () => node.statuses[node.statuses.length - 1];
		node.lastSent = () => node.sent[node.sent.length - 1];

		const defaults = {
			lat: "48.85",
			lon: "2.35",
			start: "sunrise",
			end: "sunset",
			starttime: "420",
			endtime: "480",
			duskoff: "0",
			dawnoff: "0",
			outtopic: "light",
			outpayload1: "ON",
			outpayload2: "OFF"
		};
		DAYS_AND_MONTHS.forEach((k) => { defaults[k] = true; });

		Constructor.call(node, Object.assign(defaults, config));
		registry.set(node.id, node);
		return node;
	}

	function postAdmin(id) {
		let status = null;
		adminRoute({ params: { id } }, { sendStatus(code) { status = code; } });
		return status;
	}

	return { createNode, postAdmin };
}

/** Minutes since local midnight → "HH:MM". */
function hhmm(minutes) {
	const pad = (n) => String(n).padStart(2, "0");
	return pad(Math.floor(minutes / 60)) + ":" + pad(minutes % 60);
}

module.exports = { loadScheduler, hhmm };
