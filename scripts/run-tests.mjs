import { spawnSync } from "node:child_process";
import { readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const testDir = path.join(rootDir, "tests");
const testFiles = (await readdir(testDir))
	.filter((fileName) => fileName.endsWith(".test.ts"))
	.sort()
	.map((fileName) => path.join(testDir, fileName));

if (testFiles.length === 0) {
	throw new Error("No TapLog test files found.");
}

const outDir = await mkdtemp(path.join(tmpdir(), "taplog-tests-"));
const outputFiles = testFiles.map((testFile) => path.join(outDir, `${path.basename(testFile, ".ts")}.mjs`));

try {
	for (let index = 0; index < testFiles.length; index++) {
		const testFile = testFiles[index];
		const outputFile = outputFiles[index];

		await esbuild.build({
			entryPoints: [testFile],
			outfile: outputFile,
			bundle: true,
			format: "esm",
			platform: "node",
			target: "node20",
			plugins: [obsidianTestStubPlugin()]
		});
	}

	const testResult = spawnSync(process.execPath, ["--test", ...outputFiles], {
		cwd: rootDir,
		stdio: "inherit"
	});

	if (testResult.error) {
		throw testResult.error;
	}

	process.exitCode = typeof testResult.status === "number" ? testResult.status : 1;
} finally {
	await rm(outDir, {recursive: true, force: true});
}

function obsidianTestStubPlugin() {
	return {
		name: "obsidian-test-stub",
		setup(build) {
			build.onResolve({filter: /^obsidian$/}, () => ({
				path: "obsidian",
				namespace: "obsidian-test-stub"
			}));

			build.onLoad({filter: /.*/, namespace: "obsidian-test-stub"}, () => ({
				loader: "js",
				contents: `
					export class Notice {
						constructor(message) {
							this.message = message;
						}
					}

					export class Plugin {}
					export class PluginSettingTab {
						constructor(app, plugin) {
							this.app = app;
							this.plugin = plugin;
							this.containerEl = {
								empty() {},
								createEl() {
									return {};
								}
							};
						}
					}
					export class Setting {
						constructor(containerEl) {
							this.containerEl = containerEl;
						}

						setName() {
							return this;
						}

						setDesc() {
							return this;
						}

						setHeading() {
							return this;
						}

						addButton(callback) {
							callback({
								setButtonText() {
									return this;
								},
								setDisabled() {
									return this;
								},
								onClick() {
									return this;
								}
							});
							return this;
						}

						addDropdown(callback) {
							callback({
								addOptions() {
									return this;
								},
								setValue() {
									return this;
								},
								onChange() {
									return this;
								}
							});
							return this;
						}

						addText(callback) {
							callback({
								setPlaceholder() {
									return this;
								},
								onChange() {
									return this;
								}
							});
							return this;
						}

						addTextArea(callback) {
							callback({
								inputEl: {
									rows: 0
								},
								onChange() {
									return this;
								}
							});
							return this;
						}

						addToggle(callback) {
							callback({
								setValue() {
									return this;
								},
								onChange() {
									return this;
								}
							});
							return this;
						}
					}
					export class TFile {}
					export class TFolder {}

					export function normalizePath(value) {
						return value
							.replace(/\\\\/g, "/")
							.replace(/\\/+/g, "/")
							.replace(/\\/$/, "");
					}
				`
			}));
		}
	};
}
