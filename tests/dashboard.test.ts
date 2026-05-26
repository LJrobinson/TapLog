import assert from "node:assert/strict";
import test from "node:test";
import { DASHBOARD_PATH, buildDashboardContent, getOrderedDashboardTrackers, resolveDashboardTracker } from "../src/dashboard";

const CUSTOM_TRACKERS = [
	{
		id: "health",
		name: "Health Tracker",
		path: "TapLog/Trackers/Health Tracker.md"
	}
];

test("dashboard content includes taplog source tracker blocks", () => {
	const content = buildDashboardContent();

	assert.equal(DASHBOARD_PATH, "TapLog/Dashboard.md");
	assert.match(content, /## Snack Tracker/);
	assert.match(content, /```taplog\nid: snacks\nsource: tracker\n```/);
	assert.match(content, /## Cannabis Tracker/);
	assert.match(content, /```taplog\nid: cannabis\nsource: tracker\n```/);
});

test("dashboard content follows tracker order and includes custom trackers", () => {
	const content = buildDashboardContent(["health", "custom", "snacks"], CUSTOM_TRACKERS);
	const healthIndex = content.indexOf("## Health Tracker");
	const customIndex = content.indexOf("## Custom Tracker");
	const snackIndex = content.indexOf("## Snack Tracker");

	assert.ok(healthIndex > -1);
	assert.ok(healthIndex < customIndex);
	assert.ok(customIndex < snackIndex);
});

test("dashboard tracker ordering returns built-ins plus custom trackers", () => {
	assert.deepEqual(getOrderedDashboardTrackers(["health", "snacks"], CUSTOM_TRACKERS).map((tracker) => tracker.id), [
		"health",
		"snacks",
		"cannabis",
		"basic",
		"custom"
	]);
});

test("dashboard tracker resolution uses built-ins and custom trackers", () => {
	assert.deepEqual(resolveDashboardTracker("snacks", CUSTOM_TRACKERS), {
		id: "snacks",
		name: "Snack Tracker",
		path: "TapLog/Trackers/Snack Tracker.md"
	});
	assert.deepEqual(resolveDashboardTracker("health", CUSTOM_TRACKERS), {
		id: "health",
		name: "Health Tracker",
		path: "TapLog/Trackers/Health Tracker.md"
	});
	assert.equal(resolveDashboardTracker("missing", CUSTOM_TRACKERS), undefined);
});
