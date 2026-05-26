import assert from "node:assert/strict";
import test from "node:test";
import {
	buildCustomTrackerTemplate,
	normalizeTrackerId,
	normalizeTrackerName,
	parseButtonLabels,
	upsertCustomTracker
} from "../src/customTracker";

test("tracker id normalization creates lowercase kebab ids", () => {
	assert.equal(normalizeTrackerId("Health Tracker"), "health-tracker");
	assert.equal(normalizeTrackerId("Walked Moby!"), "walked-moby");
	assert.equal(normalizeTrackerId("  already_safe  "), "already-safe");
});

test("tracker name normalization keeps readable file names", () => {
	assert.equal(normalizeTrackerName(" Health Tracker "), "Health Tracker");
	assert.equal(normalizeTrackerName("Health/Tracker"), "Health-Tracker");
});

test("button labels are parsed one per non-empty line", () => {
	assert.deepEqual(parseButtonLabels("Took Vitamin\n\nHeadache\nTook Vitamin"), [
		"Took Vitamin",
		"Headache"
	]);
});

test("custom tracker template uses generated id when id is blank", () => {
	const result = buildCustomTrackerTemplate({
		name: "Health Tracker",
		id: "",
		buttonLabels: "Took Vitamin\nHeadache"
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.tracker.id, "health-tracker");
		assert.equal(result.tracker.path, "TapLog/Trackers/Health Tracker.md");
		assert.match(result.template.content, /taplog:\n {2}id: health-tracker/);
		assert.match(result.template.content, /output_file_pattern: YYYY-MM\/health-tracker.csv/);
		assert.match(result.template.content, /label: "Took Vitamin"/);
		assert.match(result.template.content, /value: 1/);
		assert.match(result.template.content, /```taplog\nid: health-tracker\n```/);
	}
});

test("custom tracker template uses normalized explicit id", () => {
	const result = buildCustomTrackerTemplate({
		name: "Health Tracker",
		id: "Health",
		buttonLabels: "Took Vitamin"
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.tracker.id, "health");
		assert.match(result.template.content, /output_file_pattern: YYYY-MM\/health.csv/);
	}
});

test("custom tracker template rejects missing name or buttons", () => {
	assert.equal(buildCustomTrackerTemplate({name: "", id: "", buttonLabels: "Took Vitamin"}).ok, false);
	assert.equal(buildCustomTrackerTemplate({name: "Health Tracker", id: "health", buttonLabels: ""}).ok, false);
});

test("custom tracker registration upserts by id", () => {
	assert.deepEqual(upsertCustomTracker([
		{
			id: "health",
			name: "Old Health",
			path: "TapLog/Trackers/Old Health.md"
		}
	], {
		id: "health",
		name: "Health Tracker",
		path: "TapLog/Trackers/Health Tracker.md"
	}), [
		{
			id: "health",
			name: "Health Tracker",
			path: "TapLog/Trackers/Health Tracker.md"
		}
	]);
});
