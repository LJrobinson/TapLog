import { Notice, PluginSettingTab, Setting, TFile, type App, type Plugin } from "obsidian";
import { createDashboardNote } from "./dashboard";
import {
	type CustomTrackerDefinition,
	buildCustomTrackerTemplate,
	normalizeCustomTrackers,
	upsertCustomTracker
} from "./customTracker";
import { getQuickRibbonTrackerOptions } from "./ribbonActions";
import { normalizeTrackerOrder } from "./trackerOrder";
import {
	BUILT_IN_TRACKER_IDS,
	BUILT_IN_TRACKER_TEMPLATES,
	createTrackerNote,
	getTrackerTemplateById
} from "./trackerTemplates";
import {
	addEditableButtonRow,
	addEditableValueRow,
	buildEditableTrackerForm,
	removeEditableButtonRow,
	removeEditableValueRow,
	updateTaplogFrontmatter,
	type EditableButtonRow,
	type EditableButtonValueRow,
	type EditableTrackerForm
} from "./trackerEditor";
import {
	getTaplogFromFrontmatter,
	isRecord as isTaplogRecord,
	validateTaplogFrontmatterConfig
} from "./taplogConfig";

export interface TapLogSettings {
	trackerOrder: string[];
	customTrackers: CustomTrackerDefinition[];
	showIndexRibbonAction: boolean;
	showDashboardRibbonAction: boolean;
	showQuickTrackerRibbonAction: boolean;
	quickRibbonTrackerId: string;
}

export interface TapLogSettingsHost extends Plugin {
	settings: TapLogSettings;
	saveSettings(): Promise<void>;
	refreshRibbonActions(): void;
}

export const DEFAULT_TAPLOG_SETTINGS: TapLogSettings = {
	trackerOrder: ["snacks", "cannabis", "basic", "custom"],
	customTrackers: [],
	showIndexRibbonAction: true,
	showDashboardRibbonAction: true,
	showQuickTrackerRibbonAction: true,
	quickRibbonTrackerId: "snacks"
};

export function normalizeTapLogSettings(rawSettings: unknown): TapLogSettings {
	if (!isRecord(rawSettings)) {
		const customTrackers = normalizeCustomTrackers(undefined);
		return {
			trackerOrder: normalizeTrackerOrder(DEFAULT_TAPLOG_SETTINGS.trackerOrder, getKnownTrackerIds(customTrackers)),
			customTrackers,
			showIndexRibbonAction: DEFAULT_TAPLOG_SETTINGS.showIndexRibbonAction,
			showDashboardRibbonAction: DEFAULT_TAPLOG_SETTINGS.showDashboardRibbonAction,
			showQuickTrackerRibbonAction: DEFAULT_TAPLOG_SETTINGS.showQuickTrackerRibbonAction,
			quickRibbonTrackerId: DEFAULT_TAPLOG_SETTINGS.quickRibbonTrackerId
		};
	}

	const customTrackers = normalizeCustomTrackers(rawSettings["customTrackers"]);
	const rawTrackerOrder = Array.isArray(rawSettings["trackerOrder"]) ? rawSettings["trackerOrder"] : DEFAULT_TAPLOG_SETTINGS.trackerOrder;

	return {
		trackerOrder: normalizeTrackerOrder(rawTrackerOrder, getKnownTrackerIds(customTrackers)),
		customTrackers,
		showIndexRibbonAction: typeof rawSettings["showIndexRibbonAction"] === "boolean"
			? rawSettings["showIndexRibbonAction"]
			: DEFAULT_TAPLOG_SETTINGS.showIndexRibbonAction,
		showDashboardRibbonAction: typeof rawSettings["showDashboardRibbonAction"] === "boolean"
			? rawSettings["showDashboardRibbonAction"]
			: DEFAULT_TAPLOG_SETTINGS.showDashboardRibbonAction,
		showQuickTrackerRibbonAction: typeof rawSettings["showQuickTrackerRibbonAction"] === "boolean"
			? rawSettings["showQuickTrackerRibbonAction"]
			: DEFAULT_TAPLOG_SETTINGS.showQuickTrackerRibbonAction,
		quickRibbonTrackerId: typeof rawSettings["quickRibbonTrackerId"] === "string" && rawSettings["quickRibbonTrackerId"].trim().length > 0
			? rawSettings["quickRibbonTrackerId"].trim()
			: DEFAULT_TAPLOG_SETTINGS.quickRibbonTrackerId
	};
}

export function registerCustomTracker(settings: TapLogSettings, tracker: CustomTrackerDefinition): TapLogSettings {
	const customTrackers = upsertCustomTracker(settings.customTrackers, tracker);
	const trackerOrder = normalizeTrackerOrder([...settings.trackerOrder, tracker.id], getKnownTrackerIds(customTrackers));

	return {
		trackerOrder,
		customTrackers,
		showIndexRibbonAction: settings.showIndexRibbonAction,
		showDashboardRibbonAction: settings.showDashboardRibbonAction,
		showQuickTrackerRibbonAction: settings.showQuickTrackerRibbonAction,
		quickRibbonTrackerId: settings.quickRibbonTrackerId
	};
}

export function getKnownTrackerIds(customTrackers: readonly CustomTrackerDefinition[]): string[] {
	return [
		...BUILT_IN_TRACKER_IDS,
		...customTrackers.map((tracker) => tracker.id)
	];
}

export class TapLogSettingTab extends PluginSettingTab {
	private plugin: TapLogSettingsHost;
	private editTrackerPath = "";
	private loadedEditTrackerPath = "";

	constructor(app: App, plugin: TapLogSettingsHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Create tracker from template")
			.setHeading();
		for (const template of BUILT_IN_TRACKER_TEMPLATES) {
			new Setting(containerEl)
				.setName(template.name)
				.setDesc(`Create or open ${template.path}.`)
				.addButton((button) => {
					button
						.setButtonText(`Create ${template.name.toLowerCase()}`)
						.onClick(() => {
							void createTrackerNote(this.plugin.app, template);
						});
				});
		}

		this.renderEditExistingTrackerSection(containerEl);
		this.renderSimpleCustomTrackerSection(containerEl);
		this.renderDashboardSection(containerEl);
		this.renderRibbonActionsSection(containerEl);

		new Setting(containerEl)
			.setName("Tracker order")
			.setHeading();
		containerEl.createEl("p", {
			text: "Controls the order used by the generated tracker index and monthly rollup."
		});

		const trackerOrder = normalizeTrackerOrder(this.plugin.settings.trackerOrder, getKnownTrackerIds(this.plugin.settings.customTrackers));
		for (let index = 0; index < trackerOrder.length; index++) {
			const trackerId = trackerOrder[index];
			const tracker = trackerId ? this.getTrackerDisplayInfo(trackerId) : undefined;
			if (!tracker) {
				continue;
			}

			new Setting(containerEl)
				.setName(tracker.name)
				.setDesc(tracker.id)
				.addButton((button) => {
					button
						.setButtonText("Move up")
						.setDisabled(index === 0)
						.onClick(() => {
							void this.moveTracker(index, -1);
						});
				})
				.addButton((button) => {
					button
						.setButtonText("Move down")
						.setDisabled(index === trackerOrder.length - 1)
						.onClick(() => {
							void this.moveTracker(index, 1);
						});
				});
		}

		new Setting(containerEl)
			.setName("Reset order")
			.setDesc("Restore the default tracker order.")
			.addButton((button) => {
				button
					.setButtonText("Reset order")
					.onClick(() => {
						void this.updateTrackerOrder(DEFAULT_TAPLOG_SETTINGS.trackerOrder);
					});
			});
	}

	private async moveTracker(index: number, direction: -1 | 1) {
		const trackerOrder = normalizeTrackerOrder(this.plugin.settings.trackerOrder, getKnownTrackerIds(this.plugin.settings.customTrackers));
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= trackerOrder.length) {
			return;
		}

		const nextOrder = [...trackerOrder];
		const movedTracker = nextOrder[index];
		const targetTracker = nextOrder[targetIndex];
		if (movedTracker === undefined || targetTracker === undefined) {
			return;
		}

		nextOrder[index] = targetTracker;
		nextOrder[targetIndex] = movedTracker;
		await this.updateTrackerOrder(nextOrder);
	}

	private async updateTrackerOrder(trackerOrder: readonly string[]) {
		this.plugin.settings.trackerOrder = normalizeTrackerOrder(trackerOrder, getKnownTrackerIds(this.plugin.settings.customTrackers));
		await this.plugin.saveSettings();
		this.display();
	}

	private renderSimpleCustomTrackerSection(containerEl: HTMLElement) {
		let trackerName = "";
		let trackerId = "";
		let columns = "";
		let defaults = "";
		let buttons = "";

		new Setting(containerEl)
			.setName("Create simple custom tracker")
			.setHeading();

		new Setting(containerEl)
			.setName("Tracker name")
			.setDesc("Used for the tracker note title and file name.")
			.addText((text) => {
				text
					.setPlaceholder("Health tracker")
					.onChange((value) => {
						trackerName = value;
					});
			});

		new Setting(containerEl)
			.setName("Tracker identifier")
			.setDesc("Optional; blank uses a safe identifier from the tracker name.")
			.addText((text) => {
				text
					.setPlaceholder("Health")
					.onChange((value) => {
						trackerId = value;
					});
			});

		new Setting(containerEl)
			.setName("Columns")
			.setDesc("Optional. One column per line; timestamp is always added first.")
			.addTextArea((text) => {
				text
					.onChange((value) => {
						columns = value;
					});
				text.inputEl.rows = 4;
			});

		new Setting(containerEl)
			.setName("Defaults")
			.setDesc("Optional. One key=value pair per line.")
			.addTextArea((text) => {
				text
					.onChange((value) => {
						defaults = value;
					});
				text.inputEl.rows = 3;
			});

		new Setting(containerEl)
			.setName("Buttons")
			.setDesc("One button per line. Use label only, or label | key=value, key=value.")
			.addTextArea((text) => {
				text
					.onChange((value) => {
						buttons = value;
					});
				text.inputEl.rows = 4;
			});

		new Setting(containerEl)
			.setName("Create tracker")
			.setDesc("Generates a plain Markdown tracker note you can edit afterward.")
			.addButton((button) => {
				button
					.setButtonText("Create custom tracker")
					.onClick(() => {
						void this.createSimpleCustomTracker(trackerName, trackerId, columns, defaults, buttons);
					});
			});
	}

	private renderEditExistingTrackerSection(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Edit existing tracker")
			.setHeading();

		containerEl.createEl("p", {
			text: "Select a tracker note, change common fields, and save updates back to the Markdown tracker note."
		});

		let trackerOptions: Array<{ path: string; name: string; id: string }>;
		try {
			trackerOptions = this.getEditableTrackerOptions();
		} catch (error) {
			console.error("TapLog failed to discover tracker notes.", error);
			containerEl.createEl("p", {
				text: `TapLog could not find tracker notes: ${getErrorMessage(error)}`
			});
			return;
		}

		if (trackerOptions.length === 0) {
			containerEl.createEl("p", {
				text: "No tracker notes found yet. Create a tracker first."
			});
			return;
		}

		if (!this.editTrackerPath || !trackerOptions.some((tracker) => tracker.path === this.editTrackerPath)) {
			this.editTrackerPath = trackerOptions[0]?.path ?? "";
		}

		const selectedTracker = trackerOptions.find((tracker) => tracker.path === this.editTrackerPath) ?? trackerOptions[0];
		if (!selectedTracker) {
			return;
		}

		if (this.loadedEditTrackerPath && !trackerOptions.some((tracker) => tracker.path === this.loadedEditTrackerPath)) {
			this.loadedEditTrackerPath = "";
		}

		new Setting(containerEl)
			.setName("Tracker")
			.setDesc("Choose a tracker note to edit.")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(Object.fromEntries(trackerOptions.map((tracker) => [tracker.path, `${tracker.name} (${tracker.id})`])))
					.setValue(selectedTracker.path)
					.onChange((value) => {
						this.editTrackerPath = value;
						this.loadedEditTrackerPath = "";
						this.display();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Load tracker")
					.onClick(() => {
						this.loadedEditTrackerPath = selectedTracker.path;
						this.display();
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Open tracker note")
					.onClick(() => {
						void this.openEditableTracker(selectedTracker.path);
					});
			});

		if (!this.loadedEditTrackerPath) {
			containerEl.createEl("p", {
				text: "Select a tracker note and load it to edit common fields."
			});
			return;
		}

		const loadResult = this.loadEditableTracker(this.loadedEditTrackerPath);
		if (!loadResult.ok) {
			new Setting(containerEl)
				.setName("Tracker setup problem")
				.setDesc(loadResult.message)
				.addButton((button) => {
					button
						.setButtonText("Reload")
						.onClick(() => {
							this.display();
						});
				});
			return;
		}

		const form: EditableTrackerForm = {
			...loadResult.form
		};

		new Setting(containerEl)
			.setName("Tracker identifier")
			.setDesc("Read-only for now so the note, code block, and dashboard links stay aligned.")
			.addText((text) => {
				text
					.setValue(form.id)
					.setDisabled(true);
			});

		new Setting(containerEl)
			.setName("Output folder")
			.setDesc("Folder where the plugin writes CSV files.")
			.addText((text) => {
				text
					.setValue(form.outputFolder)
					.onChange((value) => {
						form.outputFolder = value;
					});
			});

		new Setting(containerEl)
			.setName("Output file pattern")
			.setDesc("Use YYYY and MM for monthly CSV paths, such as YYYY-MM/snacks.csv.")
			.addText((text) => {
				text
					.setValue(form.outputFilePattern)
					.onChange((value) => {
						form.outputFilePattern = value;
					});
			});

		new Setting(containerEl)
			.setName("Columns")
			.setDesc("One column per line; timestamp is always kept first.")
			.addTextArea((text) => {
				text
					.setValue(form.columnsText)
					.onChange((value) => {
						form.columnsText = value;
					});
				text.inputEl.rows = 7;
				text.inputEl.classList.add("taplog-settings-textarea");
			});

		new Setting(containerEl)
			.setName("Defaults")
			.setDesc("One default per line, like method=dab.")
			.addTextArea((text) => {
				text
					.setValue(form.defaultsText)
					.onChange((value) => {
						form.defaultsText = value;
					});
				text.inputEl.rows = 5;
				text.inputEl.classList.add("taplog-settings-textarea");
			});

		this.renderEditableButtonRows(containerEl, form);

		new Setting(containerEl)
			.setName("Save tracker changes")
			.setDesc("Writes changes back to the selected Markdown tracker note. Existing CSV logs are not deleted.")
			.addButton((button) => {
				button
					.setButtonText("Save tracker changes")
					.setCta()
					.onClick(() => {
						void this.saveEditableTracker(loadResult.file, loadResult.rawConfig, form);
					});
			})
			.addButton((button) => {
				button
					.setButtonText("Reload tracker")
					.onClick(() => {
						this.display();
					});
			});
	}

	private renderEditableButtonRows(containerEl: HTMLElement, form: EditableTrackerForm) {
		new Setting(containerEl)
			.setName("Buttons")
			.setDesc("Edit each tracker button with fields below.");

		const buttonListEl = containerEl.createEl("div", {
			cls: "taplog-settings-button-list"
		});

		const renderRows = () => {
			buttonListEl.empty();

			if (form.buttons.length === 0) {
				buttonListEl.createEl("p", {
					cls: "taplog-settings-help",
					text: "No buttons yet. Add a button before saving."
				});
			}

			for (let index = 0; index < form.buttons.length; index++) {
				const button = form.buttons[index];
				if (!button) {
					continue;
				}

				this.renderEditableButtonRow(buttonListEl, button, index, () => {
					form.buttons = removeEditableButtonRow(form.buttons, index);
					renderRows();
				});
			}
		};

		renderRows();

		new Setting(containerEl)
			.setName("Add button")
			.setDesc("Add another button row to this tracker.")
			.addButton((button) => {
				button
					.setButtonText("Add button")
					.onClick(() => {
						form.buttons = addEditableButtonRow(form.buttons);
						renderRows();
					});
			});
	}

	private renderEditableButtonRow(
		containerEl: HTMLElement,
		button: EditableButtonRow,
		index: number,
		onRemove: () => void
	) {
		const rowEl = containerEl.createEl("div", {
			cls: "taplog-settings-button-card"
		});

		const headingEl = rowEl.createEl("div", {
			cls: "taplog-settings-button-card-heading"
		});
		headingEl.createEl("div", {
			cls: "taplog-settings-button-title",
			text: `Button ${index + 1}`
		});
		const removeButton = headingEl.createEl("button", {
			cls: "taplog-settings-card-button",
			text: "Remove button"
		});
		removeButton.type = "button";
		removeButton.addEventListener("click", onRemove);

		const nameLabel = rowEl.createEl("label", {
			cls: "taplog-settings-stacked-field"
		});
		nameLabel.createEl("span", {
			text: "Name"
		});
		const nameInput = nameLabel.createEl("input", {
			cls: "taplog-settings-text-input"
		});
		nameInput.type = "text";
		nameInput.placeholder = "Ate snack";
		nameInput.value = button.label;
		nameInput.addEventListener("input", () => {
			button.label = nameInput.value;
		});

		rowEl.createEl("div", {
			cls: "taplog-settings-section-label",
			text: "Logged values"
		});
		const valuesEl = rowEl.createEl("div", {
			cls: "taplog-settings-value-list"
		});

		const renderValueRows = () => {
			valuesEl.empty();

			if (button.values.length === 0) {
				valuesEl.createEl("p", {
					cls: "taplog-settings-help",
					text: "No logged values. Add a value or leave this button empty."
				});
			}

			for (let valueIndex = 0; valueIndex < button.values.length; valueIndex++) {
				const valueRow = button.values[valueIndex];
				if (!valueRow) {
					continue;
				}

				this.renderEditableValueRow(valuesEl, valueRow, () => {
					button.values = removeEditableValueRow(button, valueIndex).values;
					renderValueRows();
				});
			}
		};

		renderValueRows();

		const addValueButton = rowEl.createEl("button", {
			cls: "taplog-settings-card-button",
			text: "Add logged value"
		});
		addValueButton.type = "button";
		addValueButton.addEventListener("click", () => {
			button.values = addEditableValueRow(button).values;
			renderValueRows();
		});
	}

	private renderEditableValueRow(
		containerEl: HTMLElement,
		valueRow: EditableButtonValueRow,
		onRemove: () => void
	) {
		const rowEl = containerEl.createEl("div", {
			cls: "taplog-settings-value-row"
		});

		const fieldLabel = rowEl.createEl("label", {
			cls: "taplog-settings-value-label"
		});
		fieldLabel.createEl("span", {
			text: "Value"
		});
		const fieldInput = fieldLabel.createEl("input", {
			cls: "taplog-settings-value-input"
		});
		fieldInput.type = "text";
		fieldInput.placeholder = "Item";
		fieldInput.value = valueRow.field;
		fieldInput.addEventListener("input", () => {
			valueRow.field = fieldInput.value;
		});

		const valueLabel = rowEl.createEl("label", {
			cls: "taplog-settings-value-label"
		});
		valueLabel.createEl("span", {
			text: "Logged value"
		});
		const valueInput = valueLabel.createEl("input", {
			cls: "taplog-settings-value-input"
		});
		valueInput.type = "text";
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- Required product example value.
		valueInput.placeholder = "Mosh Bar";
		valueInput.value = valueRow.value;
		valueInput.addEventListener("input", () => {
			valueRow.value = valueInput.value;
		});

		const removeButton = rowEl.createEl("button", {
			cls: "taplog-settings-value-remove",
			text: "Remove value"
		});
		removeButton.type = "button";
		removeButton.addEventListener("click", onRemove);
	}

	private renderDashboardSection(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Dashboard")
			.setHeading();

		new Setting(containerEl)
			.setName("Create dashboard")
			.setDesc("Create or open a Markdown dashboard note for the current tracker order.")
			.addButton((button) => {
				button
					.setButtonText("Create dashboard")
					.onClick(() => {
						void createDashboardNote(this.plugin.app, this.plugin.settings.trackerOrder, this.plugin.settings.customTrackers);
					});
			});
	}

	private getEditableTrackerOptions(): Array<{ path: string; name: string; id: string }> {
		return this.plugin.app.vault.getMarkdownFiles()
			.map((file) => {
				const taplogConfig = getTaplogFromFrontmatter(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter);
				if (taplogConfig === undefined) {
					return undefined;
				}

				const id = isTaplogRecord(taplogConfig) && typeof taplogConfig["id"] === "string" && taplogConfig["id"].trim().length > 0
					? taplogConfig["id"].trim()
					: "invalid taplog config";

				return {
					path: file.path,
					name: file.basename,
					id
				};
			})
			.filter((tracker): tracker is { path: string; name: string; id: string } => tracker !== undefined)
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	private loadEditableTracker(path: string): { ok: true; file: TFile; rawConfig: unknown; form: EditableTrackerForm } | { ok: false; message: string } {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			return {
				ok: false,
				message: "TapLog could not find the selected tracker note."
			};
		}

		const rawConfig = getTaplogFromFrontmatter(this.plugin.app.metadataCache.getFileCache(file)?.frontmatter);
		const validationResult = validateTaplogFrontmatterConfig(rawConfig);
		if (!validationResult.ok) {
			return {
				ok: false,
				message: validationResult.message
			};
		}

		return {
			ok: true,
			file,
			rawConfig,
			form: buildEditableTrackerForm(validationResult.config)
		};
	}

	private async openEditableTracker(path: string) {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice("The selected tracker note could not be found.");
			return;
		}

		await this.plugin.app.workspace.getLeaf(false).openFile(file);
	}

	private async saveEditableTracker(file: TFile, rawConfig: unknown, form: EditableTrackerForm) {
		try {
			const content = await this.plugin.app.vault.read(file);
			const updateResult = updateTaplogFrontmatter(content, rawConfig, form);
			if (!updateResult.ok) {
				new Notice(`TapLog could not save tracker changes: ${updateResult.message}`);
				return;
			}

			await this.plugin.app.vault.modify(file, updateResult.value);
			new Notice(`Saved TapLog tracker changes to ${file.path}.`);
		} catch (error) {
			console.error("TapLog failed to save tracker changes.", error);
			new Notice(`TapLog could not save tracker changes: ${getErrorMessage(error)}`);
		}
	}

	private renderRibbonActionsSection(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Ribbon actions")
			.setHeading();

		new Setting(containerEl)
			.setName("Show index ribbon action")
			.setDesc("Adds a ribbon shortcut that opens or creates the index.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showIndexRibbonAction)
					.onChange((value) => {
						void this.updateRibbonSetting("showIndexRibbonAction", value);
					});
			});

		new Setting(containerEl)
			.setName("Show quick tracker ribbon action")
			.setDesc("Adds a ribbon shortcut for one tracker.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showQuickTrackerRibbonAction)
					.onChange((value) => {
						void this.updateRibbonSetting("showQuickTrackerRibbonAction", value);
					});
			});

		new Setting(containerEl)
			.setName("Show dashboard ribbon action")
			.setDesc("Adds a ribbon shortcut that opens or creates the dashboard.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showDashboardRibbonAction)
					.onChange((value) => {
						void this.updateRibbonSetting("showDashboardRibbonAction", value);
					});
			});

		const quickTrackerOptions = Object.fromEntries(
			getQuickRibbonTrackerOptions(this.plugin.settings.customTrackers).map((option) => [option.id, option.name])
		);

		new Setting(containerEl)
			.setName("Quick tracker")
			.setDesc("Choose the tracker opened by the quick tracker ribbon shortcut.")
			.addDropdown((dropdown) => {
				dropdown
					.addOptions(quickTrackerOptions)
					.setValue(this.plugin.settings.quickRibbonTrackerId)
					.onChange((value) => {
						void this.updateRibbonSetting("quickRibbonTrackerId", value);
					});
			});
	}

	private async createSimpleCustomTracker(name: string, id: string, columns: string, defaults: string, buttons: string) {
		const result = buildCustomTrackerTemplate({
			name,
			id,
			columns,
			defaults,
			buttons
		});

		if (!result.ok) {
			new Notice(result.message);
			return;
		}

		const createdOrOpened = await createTrackerNote(this.plugin.app, result.template);
		if (!createdOrOpened) {
			return;
		}

		this.plugin.settings = registerCustomTracker(this.plugin.settings, result.tracker);
		await this.plugin.saveSettings();
		this.display();
	}

	private getTrackerDisplayInfo(trackerId: string): { id: string; name: string } | undefined {
		const builtInTemplate = getTrackerTemplateById(trackerId);
		if (builtInTemplate) {
			return {
				id: builtInTemplate.taplogId,
				name: builtInTemplate.name
			};
		}

		const customTracker = this.plugin.settings.customTrackers.find((tracker) => tracker.id === trackerId);
		if (customTracker) {
			return {
				id: customTracker.id,
				name: customTracker.name
			};
		}

		return undefined;
	}

	private async updateRibbonSetting(setting: "showIndexRibbonAction" | "showDashboardRibbonAction" | "showQuickTrackerRibbonAction", value: boolean): Promise<void>;
	private async updateRibbonSetting(setting: "quickRibbonTrackerId", value: string): Promise<void>;
	private async updateRibbonSetting(setting: keyof TapLogSettings, value: boolean | string): Promise<void> {
		this.plugin.settings = {
			...this.plugin.settings,
			[setting]: value
		};
		await this.plugin.saveSettings();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}

	return "Check the tracker note and try again.";
}
