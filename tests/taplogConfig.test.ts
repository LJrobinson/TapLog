import assert from "node:assert/strict";
import test from "node:test";
import { parseTaplogBlockConfig, validateTaplogConfig } from "../src/taplogConfig";

test("valid snack-style config passes", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig());

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.equal(result.config.id, "snacks");
		assert.deepEqual(result.config.columns, ["timestamp", "item", "quantity", "unit", "category"]);
		assert.equal(result.config.buttons.length, 2);
	}
});

test("taplog block config parses id and source", () => {
	assert.deepEqual(parseTaplogBlockConfig("id: snacks\nsource: tracker"), {
		id: "snacks",
		source: "tracker"
	});
});

test("valid cannabis-style config with defaults passes", () => {
	const result = validateTaplogConfig("id: cannabis", {
		id: "cannabis",
		output_type: "csv",
		output_folder: "TapLog/Logs",
		output_file_pattern: "YYYY-MM/cannabis.csv",
		columns: ["timestamp", "strain", "method", "size"],
		defaults: {
			strain: "Neon Moon - Gunpowder Haze",
			method: "dab"
		},
		buttons: [
			{
				label: "Small Dab",
				values: {
					size: "small"
				}
			}
		]
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.config.defaults, {
			strain: "Neon Moon - Gunpowder Haze",
			method: "dab"
		});
	}
});

test("missing taplog config fails", () => {
	const result = validateTaplogConfig("id: snacks", undefined);

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.message, "Missing taplog config in this note.");
	}
});

test("taplog config as string fails", () => {
	const result = validateTaplogConfig("id: snacks", "not an object");

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.message, "taplog config must be a YAML object.");
	}
});

test("missing id fails", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig({id: ""}));

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.message, "Missing taplog id in this note's frontmatter.");
	}
});

test("missing buttons fails", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig({buttons: []}));

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.message, "Missing taplog buttons. Add at least one button in frontmatter.");
	}
});

test("button missing label fails", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig({
		buttons: [
			{
				values: {
					item: "Mosh Bar"
				}
			}
		]
	}));

	assert.equal(result.ok, false);
	if (!result.ok) {
		assert.equal(result.message, "Button 1 is missing a label.");
	}
});

test("button values object validates", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig());

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.config.buttons[0]?.values, {
			item: "Mosh Bar",
			quantity: 1,
			unit: "bar",
			category: "snack"
		});
	}
});

test("well-formed par levels validate", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig());

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.config.parLevels["Mosh Bar"], {
			par: 12,
			unit: "bar"
		});
	}
});

test("malformed par levels do not break otherwise valid config", () => {
	const result = validateTaplogConfig("id: snacks", createSnackConfig({
		par_levels: {
			"Mosh Bar": {
				par: "nope",
				unit: ""
			}
		}
	}));

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.config.parLevels, {});
	}
});

function createSnackConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "snacks",
		output_type: "csv",
		output_folder: "TapLog/Logs",
		output_file_pattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item", "quantity", "unit", "category"],
		par_levels: {
			"Mosh Bar": {
				par: 12,
				unit: "bar"
			}
		},
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar",
					quantity: 1,
					unit: "bar",
					category: "snack"
				}
			},
			{
				label: "Beef Jerky",
				values: {
					item: "Beef Jerky",
					quantity: 1,
					unit: "bag",
					category: "snack"
				}
			}
		],
		...overrides
	};
}
