import assert from "node:assert/strict";
import test from "node:test";
import {
	addEditableButtonRow,
	addEditableValueRow,
	buildEditableTrackerForm,
	buildEditedTaplogConfig,
	buttonConfigToEditableRows,
	editableButtonRowsToConfig,
	parseEditableButtonLines,
	removeEditableButtonRow,
	removeEditableValueRow,
	serializeTaplogConfig,
	updateTaplogFrontmatter
} from "../src/trackerEditor";
import type { TaplogConfig } from "../src/taplogConfig";

test("editable button lines parse plain labels and inline values", () => {
	assert.deepEqual(parseEditableButtonLines("Took Vitamin\nHeadache | severity=2, unit=event"), [
		{
			label: "Took Vitamin",
			values: {
				label: "Took Vitamin",
				value: 1
			}
		},
		{
			label: "Headache",
			values: {
				severity: 2,
				unit: "event"
			}
		}
	]);
});

test("edited tracker form serializes buttons back to taplog config", () => {
	const result = buildEditedTaplogConfig(createRawConfig(), {
		id: "snacks",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snack-log.csv",
		columnsText: "timestamp\nitem\nquantity\nunit",
		defaultsText: "unit=bar",
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: [
					{
						field: "item",
						value: "Mosh Bar"
					},
					{
						field: "quantity",
						value: "1"
					}
				]
			}
		]
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.value["buttons"], [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar",
					quantity: 1
				}
			}
		]);
		assert.deepEqual(result.value["defaults"], {
			unit: "bar"
		});
		assert.deepEqual(result.value["columns"], ["timestamp", "item", "quantity", "unit"]);
		assert.deepEqual(result.value["par_levels"], createRawConfig()["par_levels"]);
	}
});

test("editable tracker form renders existing config as simple text fields", () => {
	assert.deepEqual(buildEditableTrackerForm(createValidatedConfig()), {
		id: "snacks",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columnsText: "timestamp\nitem\nquantity\nunit",
		defaultsText: "unit=bar",
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: [
					{
						field: "item",
						value: "Mosh Bar"
					},
					{
						field: "quantity",
						value: "1"
					}
				]
			}
		]
	});
});

test("button config renders as editable rows", () => {
	assert.deepEqual(buttonConfigToEditableRows([
		{
			label: "Ate Mosh Bar",
			values: {
				item: "Mosh Bar",
				quantity: 1,
				favorite: true
			}
		}
	]), [
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				},
				{
					field: "quantity",
					value: "1"
				},
				{
					field: "favorite",
					value: "true"
				}
			]
		}
	]);
});

test("editable button rows serialize back to button config", () => {
	const result = editableButtonRowsToConfig([
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				},
				{
					field: "quantity",
					value: "1"
				},
				{
					field: "favorite",
					value: "true"
				}
			]
		}
	]);

	assert.deepEqual(result, {
		ok: true,
		value: [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar",
					quantity: 1,
					favorite: true
				}
			}
		]
	});
});

test("editable button rows allow empty values without dropping the button", () => {
	const result = buildEditedTaplogConfig(createRawConfig(), {
		id: "snacks",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columnsText: "timestamp\nitem\nquantity\nunit",
		defaultsText: "",
		buttons: [
			{
				label: "New button",
				values: [
					{
						field: "",
						value: ""
					}
				]
			}
		]
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.value["buttons"], [
			{
				label: "New button",
				values: {}
			}
		]);
	}
});

test("taplog serializer writes empty button values as an object", () => {
	const serialized = serializeTaplogConfig({
		id: "snacks",
		output_type: "csv",
		output_folder: "TapLog/Logs",
		output_file_pattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp"],
		buttons: [
			{
				label: "New button",
				values: {}
			}
		]
	});

	assert.ok(serialized.includes("values: {}"));
});

test("editable button rows ignore fully blank value rows", () => {
	const result = editableButtonRowsToConfig([
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				},
				{
					field: "",
					value: ""
				}
			]
		}
	]);

	assert.deepEqual(result, {
		ok: true,
		value: [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar"
				}
			}
		]
	});
});

test("editable button rows reject blank fields with values", () => {
	assert.deepEqual(editableButtonRowsToConfig([
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "",
					value: "Mosh Bar"
				}
			]
		}
	]), {
		ok: false,
		message: "Button 1 logged value 1 needs a field before saving."
	});
});

test("editable button rows reject duplicate fields", () => {
	assert.deepEqual(editableButtonRowsToConfig([
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "Item",
					value: "Mosh Bar"
				},
				{
					field: "item",
					value: "Protein Bar"
				}
			]
		}
	]), {
		ok: false,
		message: "Button 1 has duplicate value key \"item\"."
	});
});

test("editable button rows reject blank button labels", () => {
	assert.deepEqual(editableButtonRowsToConfig([
		{
			label: "  ",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				}
			]
		}
	]), {
		ok: false,
		message: "Button 1 needs a label before saving."
	});
});

test("editable button row helpers add and remove rows", () => {
	const addedRows = addEditableButtonRow([
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				}
			]
		}
	]);

	assert.deepEqual(addedRows, [
		{
			label: "Ate Mosh Bar",
			values: [
				{
					field: "item",
					value: "Mosh Bar"
				}
			]
		},
		{
			label: "New button",
			values: [
				{
					field: "",
					value: ""
				}
			]
		}
	]);
	assert.deepEqual(removeEditableButtonRow(addedRows, 0), [
		{
			label: "New button",
			values: [
				{
					field: "",
					value: ""
				}
			]
		}
	]);
});

test("editable value row helpers add and remove rows", () => {
	const addedRows = addEditableValueRow({
		label: "Ate Mosh Bar",
		values: [
			{
				field: "item",
				value: "Mosh Bar"
			}
		]
	});

	assert.deepEqual(addedRows.values, [
		{
			field: "item",
			value: "Mosh Bar"
		},
		{
			field: "",
			value: ""
		}
	]);
	assert.deepEqual(removeEditableValueRow(addedRows, 0).values, [
		{
			field: "",
			value: ""
		}
	]);
});

test("updating taplog frontmatter preserves note body and other frontmatter", () => {
	const result = updateTaplogFrontmatter(createTrackerNoteContent(), createRawConfig(), {
		id: "snacks",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snack-log.csv",
		columnsText: "timestamp\nitem\nquantity\nunit",
		defaultsText: "",
		buttons: [
			{
				label: "Protein Bar",
				values: [
					{
						field: "item",
						value: "Protein Bar"
					},
					{
						field: "quantity",
						value: "1"
					},
					{
						field: "unit",
						value: "bar"
					}
				]
			}
		]
	});

	assert.equal(result.ok, true);
	if (result.ok) {
		assert.match(result.value, /aliases:\n {2}- Snacks/);
		assert.match(result.value, /par_levels:\n {4}Mosh Bar:\n {4} {2}par: 12\n {4} {2}unit: "bar"/);
		assert.match(result.value, /output_file_pattern: "YYYY-MM\/snack-log.csv"/);
		assert.match(result.value, /label: "Protein Bar"/);
		assert.match(result.value, /# Snack Tracker\n\nUser-written note body stays here\./);
	}
});

test("updating taplog frontmatter refuses notes without taplog config", () => {
	const result = updateTaplogFrontmatter("---\ntitle: Plain note\n---\n# Plain", createRawConfig(), {
		id: "snacks",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columnsText: "timestamp\nitem",
		defaultsText: "",
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: [
					{
						field: "item",
						value: "Mosh Bar"
					}
				]
			}
		]
	});

	assert.deepEqual(result, {
		ok: false,
		message: "The selected note has no taplog config in its frontmatter."
	});
});

function createRawConfig(): Record<string, unknown> {
	return {
		id: "snacks",
		output_type: "csv",
		output_folder: "TapLog/Logs",
		output_file_pattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item", "quantity", "unit"],
		defaults: {
			unit: "bar"
		},
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
					quantity: 1
				}
			}
		]
	};
}

function createValidatedConfig(): TaplogConfig {
	return {
		id: "snacks",
		outputType: "csv",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item", "quantity", "unit"],
		defaults: {
			unit: "bar"
		},
		parLevels: {},
		buttons: [
			{
				label: "Ate Mosh Bar",
				values: {
					item: "Mosh Bar",
					quantity: 1
				}
			}
		]
	};
}

function createTrackerNoteContent(): string {
	return `---
aliases:
  - Snacks
taplog:
  id: snacks
  output_type: csv
  output_folder: TapLog/Logs
  output_file_pattern: YYYY-MM/snacks.csv
  columns:
    - timestamp
    - item
    - quantity
    - unit
  defaults:
    unit: bar
  par_levels:
    Mosh Bar:
      par: 12
      unit: bar
  buttons:
    - label: Ate Mosh Bar
      values:
        item: Mosh Bar
        quantity: 1
---
# Snack Tracker

User-written note body stays here.
`;
}
