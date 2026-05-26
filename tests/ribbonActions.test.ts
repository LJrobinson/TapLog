import assert from "node:assert/strict";
import test from "node:test";
import { getQuickRibbonTrackerOptions, resolveQuickRibbonTrackerTarget } from "../src/ribbonActions";

const CUSTOM_TRACKERS = [
	{
		id: "health",
		name: "Health Tracker",
		path: "TapLog/Trackers/Health Tracker.md",
		buttonLabels: ["Took Vitamin", "Headache"]
	}
];

test("quick ribbon tracker options include built-ins plus custom trackers", () => {
	assert.deepEqual(getQuickRibbonTrackerOptions(CUSTOM_TRACKERS).map((option) => option.id), [
		"snacks",
		"cannabis",
		"basic",
		"custom",
		"health"
	]);
});

test("quick ribbon target resolves built-in trackers", () => {
	const target = resolveQuickRibbonTrackerTarget("cannabis", CUSTOM_TRACKERS);

	assert.equal(target.ok, true);
	if (target.ok) {
		assert.equal(target.name, "Cannabis Tracker");
		assert.equal(target.template.taplogId, "cannabis");
	}
});

test("quick ribbon target resolves settings-built custom trackers", () => {
	const target = resolveQuickRibbonTrackerTarget("health", CUSTOM_TRACKERS);

	assert.equal(target.ok, true);
	if (target.ok) {
		assert.equal(target.name, "Health Tracker");
		assert.equal(target.template.path, "TapLog/Trackers/Health Tracker.md");
		assert.match(target.template.content, /label: "Took Vitamin"/);
		assert.match(target.template.content, /output_file_pattern: YYYY-MM\/health.csv/);
	}
});

test("quick ribbon target reports unknown tracker ids", () => {
	assert.deepEqual(resolveQuickRibbonTrackerTarget("missing", CUSTOM_TRACKERS), {
		ok: false,
		id: "missing"
	});
});
