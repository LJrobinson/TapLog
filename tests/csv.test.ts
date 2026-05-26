import assert from "node:assert/strict";
import test from "node:test";
import { buildOutputPath, parseCsvData, serializeCsvRow, valueToCsvText } from "../src/csv";
import type { TaplogConfig } from "../src/taplogConfig";

test("CSV rows quote values with commas", () => {
	assert.equal(serializeCsvRow(["Mosh, Bar"]), "\"Mosh, Bar\"");
});

test("CSV rows escape quoted values", () => {
	assert.equal(serializeCsvRow(["He said \"hi\""]), "\"He said \"\"hi\"\"\"");
});

test("CSV rows quote values with newlines", () => {
	assert.equal(serializeCsvRow(["line one\nline two"]), "\"line one\nline two\"");
});

test("CSV text conversion handles primitive and empty values", () => {
	assert.equal(valueToCsvText("snack"), "snack");
	assert.equal(valueToCsvText(12), "12");
	assert.equal(valueToCsvText(true), "true");
	assert.equal(valueToCsvText(null), "");
	assert.equal(valueToCsvText(undefined), "");
});

test("CSV parser reads normal rows", () => {
	const data = parseCsvData("timestamp,item,quantity\n2026-05-26 10:00:00,Mosh Bar,1\n");

	assert.deepEqual(data.headers, ["timestamp", "item", "quantity"]);
	assert.deepEqual(data.rows, [
		{
			timestamp: "2026-05-26 10:00:00",
			item: "Mosh Bar",
			quantity: "1"
		}
	]);
});

test("CSV parser reads quoted comma values", () => {
	const data = parseCsvData("item,quantity\n\"Mosh, Bar\",1\n");

	assert.deepEqual(data.rows, [
		{
			item: "Mosh, Bar",
			quantity: "1"
		}
	]);
});

test("CSV parser reads quoted quote values", () => {
	const data = parseCsvData("note\n\"He said \"\"hi\"\"\"\n");

	assert.deepEqual(data.rows, [
		{
			note: "He said \"hi\""
		}
	]);
});

test("output paths resolve YYYY and MM tokens", () => {
	const config: TaplogConfig = {
		id: "snacks",
		outputType: "csv",
		outputFolder: "TapLog/Logs",
		outputFilePattern: "YYYY-MM/snacks.csv",
		columns: ["timestamp", "item"],
		defaults: {},
		parLevels: {},
		buttons: []
	};

	assert.equal(buildOutputPath(config, new Date(2026, 4, 26, 12, 0, 0)), "TapLog/Logs/2026-05/snacks.csv");
});
