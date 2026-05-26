import { Notice, PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
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

export interface TapLogSettings {
	trackerOrder: string[];
	customTrackers: CustomTrackerDefinition[];
	showIndexRibbonAction: boolean;
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

		this.renderSimpleCustomTrackerSection(containerEl);
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
		let buttonLabels = "";

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
			.setName("Button labels")
			.setDesc("One button label per line.")
			.addTextArea((text) => {
				text
					.onChange((value) => {
						buttonLabels = value;
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
						void this.createSimpleCustomTracker(trackerName, trackerId, buttonLabels);
					});
			});
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

	private async createSimpleCustomTracker(name: string, id: string, buttonLabels: string) {
		const result = buildCustomTrackerTemplate({
			name,
			id,
			buttonLabels
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

	private async updateRibbonSetting(setting: "showIndexRibbonAction" | "showQuickTrackerRibbonAction", value: boolean): Promise<void>;
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
