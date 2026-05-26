import assert from "node:assert/strict";
import test from "node:test";
import { buildLogSuccessNotice } from "../src/logNotice";
import type { TaplogButton, TaplogConfig } from "../src/taplogConfig";

test("log success notice includes the button label and resolved CSV path", () => {
	assert.equal(
		buildLogSuccessNotice(createConfig(), createButton(), new Date(2026, 4, 26, 22, 46, 0)),
		"Logged Ate Mosh Bar to TapLog/Logs/2026-05/snacks.csv."
	);
});

function createConfig(): TaplogConfig {
	return {
		id: "snacks",
		outputType: "csv",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item"],
		defaults: {},
		parLevels: {},
		buttons: []
	};
}

function createButton(): TaplogButton {
	return {
		label: "Ate Mosh Bar",
		values: {
			item: "Mosh Bar"
		}
	};
}
