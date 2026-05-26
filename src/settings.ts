import { PluginSettingTab, Setting, type App, type Plugin } from "obsidian";
import { normalizeTrackerOrder } from "./trackerOrder";
import {
	BUILT_IN_TRACKER_IDS,
	BUILT_IN_TRACKER_TEMPLATES,
	createTrackerNote,
	getTrackerTemplateById
} from "./trackerTemplates";

export interface TapLogSettings {
	trackerOrder: string[];
}

export interface TapLogSettingsHost extends Plugin {
	settings: TapLogSettings;
	saveSettings(): Promise<void>;
}

export const DEFAULT_TAPLOG_SETTINGS: TapLogSettings = {
	trackerOrder: ["snacks", "cannabis", "basic", "custom"]
};

export function normalizeTapLogSettings(rawSettings: unknown): TapLogSettings {
	if (!isRecord(rawSettings)) {
		return {
			trackerOrder: normalizeTrackerOrder(DEFAULT_TAPLOG_SETTINGS.trackerOrder, BUILT_IN_TRACKER_IDS)
		};
	}

	const rawTrackerOrder = Array.isArray(rawSettings["trackerOrder"]) ? rawSettings["trackerOrder"] : DEFAULT_TAPLOG_SETTINGS.trackerOrder;

	return {
		trackerOrder: normalizeTrackerOrder(rawTrackerOrder, BUILT_IN_TRACKER_IDS)
	};
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

		new Setting(containerEl)
			.setName("Tracker order")
			.setHeading();
		containerEl.createEl("p", {
			text: "Controls the order used by the generated tracker index and monthly rollup."
		});

		const trackerOrder = normalizeTrackerOrder(this.plugin.settings.trackerOrder, BUILT_IN_TRACKER_IDS);
		for (let index = 0; index < trackerOrder.length; index++) {
			const trackerId = trackerOrder[index];
			const template = trackerId ? getTrackerTemplateById(trackerId) : undefined;
			if (!template) {
				continue;
			}

			new Setting(containerEl)
				.setName(template.name)
				.setDesc(template.taplogId)
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
		const trackerOrder = normalizeTrackerOrder(this.plugin.settings.trackerOrder, BUILT_IN_TRACKER_IDS);
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
		this.plugin.settings.trackerOrder = normalizeTrackerOrder(trackerOrder, BUILT_IN_TRACKER_IDS);
		await this.plugin.saveSettings();
		this.display();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
