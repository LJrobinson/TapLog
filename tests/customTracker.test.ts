import assert from "node:assert/strict";
import test from "node:test";
import {
	buildCustomTrackerTemplate,
	normalizeColumnName,
	normalizeTrackerId,
	normalizeTrackerName,
	parseButtonLabels,
	parseButtonDefinitions,
	parseColumnNames,
	parseKeyValueLines,
	resolveCustomTrackerColumns,
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
	assert.deepEqual(parseButtonLabels("Took Vitamin | activity=Took Vitamin\n\nHeadache\nTook Vitamin"), [
		"Took Vitamin",
		"Headache"
	]);
});

test("column names normalize to safe snake style", () => {
	assert.equal(normalizeColumnName("Activity Type"), "activity_type");
	assert.equal(normalizeColumnName(" quantity! "), "quantity");
	assert.deepEqual(parseColumnNames("Timestamp\nActivity Type\nActivity Type"), [
		"timestamp",
		"activity_type"
	]);
});

test("defaults parse multiline key value pairs", () => {
	assert.deepEqual(parseKeyValueLines("category=health\nunit=count\ninvalid"), {
		category: "health",
		unit: "count"
	});
});

test("button definitions parse label-only lines", () => {
	assert.deepEqual(parseButtonDefinitions("Took Vitamin"), [
		{
			label: "Took Vitamin",
			values: {
				label: "Took Vitamin",
				value: 1
			}
		}
	]);
});

test("button definitions parse label plus key value pairs", () => {
	assert.deepEqual(parseButtonDefinitions("Took Vitamin | activity=Took Vitamin, quantity=1, unit=count"), [
		{
			label: "Took Vitamin",
			values: {
				activity: "Took Vitamin",
				quantity: 1,
				unit: "count"
			}
		}
	]);
});

test("custom tracker columns include timestamp first and append button/default keys", () => {
	assert.deepEqual(resolveCustomTrackerColumns(
		"activity\nquantity",
		{category: "health"},
		parseButtonDefinitions("Took Vitamin | unit=count")
	), [
		"timestamp",
		"activity",
		"quantity",
		"category",
		"unit"
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
		columns: "timestamp\nactivity\nquantity\nunit\ncategory",
		defaults: "category=health",
		buttons: "Took Vitamin | activity=Took Vitamin, quantity=1, unit=count"
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.tracker.id, "health");
		assert.deepEqual(result.tracker.columns, ["timestamp", "activity", "quantity", "unit", "category"]);
		assert.deepEqual(result.tracker.defaults, {category: "health"});
		assert.deepEqual(result.tracker.buttons, [
			{
				label: "Took Vitamin",
				values: {
					activity: "Took Vitamin",
					quantity: 1,
					unit: "count"
				}
			}
		]);
		assert.match(result.template.content, /output_file_pattern: YYYY-MM\/health.csv/);
		assert.match(result.template.content, /defaults:\n {4}category: "health"/);
		assert.match(result.template.content, /activity: "Took Vitamin"/);
		assert.match(result.template.content, /quantity: 1/);
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
