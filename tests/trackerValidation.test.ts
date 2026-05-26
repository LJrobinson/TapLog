import assert from "node:assert/strict";
import test from "node:test";
import { buildValidationReportContent, buildValidationReportPath } from "../src/trackerValidation";
import type { TaplogConfig } from "../src/taplogConfig";

test("validation report path uses tracker id and current month", () => {
	assert.equal(buildValidationReportPath(createSnackConfig(), new Date(2026, 4, 26)), "TapLog/Summaries/2026-05/snacks Validation.md");
});

test("validation report content includes tracker details", () => {
	const content = buildValidationReportContent(
		createSnackConfig(),
		"TapLog/Trackers/Snack Tracker.md",
		"TapLog/Logs/2026-05/snacks.csv",
		new Date(2026, 4, 26)
	);

	assert.match(content, /Status: config is valid/);
	assert.match(content, /Tracker id: snacks/);
	assert.match(content, /Tracker note: `TapLog\/Trackers\/Snack Tracker.md`/);
	assert.match(content, /Resolved current month CSV: `TapLog\/Logs\/2026-05\/snacks.csv`/);
	assert.match(content, /Output type: csv/);
	assert.match(content, /Defaults exist: no/);
	assert.match(content, /par_levels exist: yes/);
	assert.match(content, /- timestamp/);
	assert.match(content, /- item/);
	assert.match(content, /Button count: 2/);
	assert.match(content, /- Ate Mosh Bar/);
	assert.match(content, /- Beef Jerky/);
});

function createSnackConfig(): TaplogConfig {
	return {
		id: "snacks",
		outputType: "csv",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item", "quantity", "unit", "category"],
		defaults: {},
		parLevels: {
			"Mosh Bar": {
				par: 12,
				unit: "bar"
			}
		},
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar"
				}
			},
			{
				label: "Beef Jerky",
				values: {
					item: "Beef Jerky"
				}
			}
		]
	};
}
