import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTrackerOrder, orderTrackerItems } from "../src/trackerOrder";

const KNOWN_TRACKER_IDS = ["snacks", "cannabis", "basic", "custom"];

test("tracker order ignores unknown ids and appends missing known trackers", () => {
	assert.deepEqual(normalizeTrackerOrder(["custom", "unknown", "snacks"], KNOWN_TRACKER_IDS), [
		"custom",
		"snacks",
		"cannabis",
		"basic"
	]);
});

test("tracker order supports custom tracker ids when known", () => {
	assert.deepEqual(normalizeTrackerOrder(["health", "snacks"], [...KNOWN_TRACKER_IDS, "health"]), [
		"health",
		"snacks",
		"cannabis",
		"basic",
		"custom"
	]);
});

test("tracker order removes duplicates and non-string values", () => {
	assert.deepEqual(normalizeTrackerOrder(["basic", "basic", 42, "snacks"], KNOWN_TRACKER_IDS), [
		"basic",
		"snacks",
		"cannabis",
		"custom"
	]);
});

test("tracker items are ordered by saved tracker order, then remaining ids alphabetically", () => {
	const orderedItems = orderTrackerItems(
		[
			{id: "z-other"},
			{id: "snacks"},
			{id: "basic"},
			{id: "a-other"},
			{id: "cannabis"}
		],
		(item) => item.id,
		["cannabis", "snacks"]
	);

	assert.deepEqual(orderedItems.map((item) => item.id), [
		"cannabis",
		"snacks",
		"a-other",
		"basic",
		"z-other"
	]);
});
