import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_TAPLOG_SETTINGS, normalizeTapLogSettings } from "../src/settings";

test("settings defaults include ribbon actions", () => {
	assert.equal(DEFAULT_TAPLOG_SETTINGS.showIndexRibbonAction, true);
	assert.equal(DEFAULT_TAPLOG_SETTINGS.showQuickTrackerRibbonAction, true);
	assert.equal(DEFAULT_TAPLOG_SETTINGS.quickRibbonTrackerId, "snacks");
});

test("settings normalization preserves ribbon action settings", () => {
	assert.deepEqual(normalizeTapLogSettings({
		trackerOrder: ["health", "snacks"],
		customTrackers: [
			{
				id: "health",
				name: "Health Tracker",
				path: "TapLog/Trackers/Health Tracker.md"
			}
		],
		showIndexRibbonAction: false,
		showQuickTrackerRibbonAction: true,
		quickRibbonTrackerId: "health"
	}), {
		trackerOrder: ["health", "snacks", "cannabis", "basic", "custom"],
		customTrackers: [
			{
				id: "health",
				name: "Health Tracker",
				path: "TapLog/Trackers/Health Tracker.md"
			}
		],
		showIndexRibbonAction: false,
		showQuickTrackerRibbonAction: true,
		quickRibbonTrackerId: "health"
	});
});
