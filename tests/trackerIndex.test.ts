import assert from "node:assert/strict";
import test from "node:test";
import { TRACKER_INDEX_PATH, buildTrackerIndexContent } from "../src/trackerIndex";

test("tracker index content includes built-in tracker links", () => {
	const content = buildTrackerIndexContent();

	assert.equal(TRACKER_INDEX_PATH, "TapLog/TapLog Index.md");
	assert.match(content, /\[\[TapLog\/Trackers\/Snack Tracker\|Snack Tracker\]\]/);
	assert.match(content, /\[\[TapLog\/Trackers\/Cannabis Tracker\|Cannabis Tracker\]\]/);
	assert.match(content, /\[\[TapLog\/Trackers\/Basic Tracker\|Basic Tracker\]\]/);
	assert.match(content, /\[\[TapLog\/Trackers\/Custom Tracker\|Custom Tracker\]\]/);
});

test("tracker index content lists TapLog commands and output paths", () => {
	const content = buildTrackerIndexContent();

	assert.match(content, /TapLog: Create tracker index/);
	assert.match(content, /TapLog: Create snack tracker/);
	assert.match(content, /TapLog: Create cannabis tracker/);
	assert.match(content, /TapLog: Create basic tracker template/);
	assert.match(content, /TapLog: Create custom tracker template/);
	assert.match(content, /TapLog: Create monthly summary for active tracker/);
	assert.match(content, /TapLog: Create monthly rollup summary/);
	assert.match(content, /TapLog\/Trackers\//);
	assert.match(content, /TapLog\/Logs\/YYYY-MM\//);
	assert.match(content, /TapLog\/Summaries\/YYYY-MM\//);
});
