import { buildCustomTrackerTemplateFromDefinition, normalizeCustomTrackers, type CustomTrackerDefinition } from "./customTracker";
import {
	BUILT_IN_TRACKER_TEMPLATES,
	getTrackerTemplateById
} from "./trackerTemplates";
import type { TrackerTemplate } from "./taplogConfig";

export interface QuickRibbonTrackerOption {
	id: string;
	name: string;
}

export type QuickRibbonTrackerTarget =
	| {
		ok: true;
		id: string;
		name: string;
		template: TrackerTemplate;
	}
	| {
		ok: false;
		id: string;
	};

export function getQuickRibbonTrackerOptions(customTrackers: readonly CustomTrackerDefinition[]): QuickRibbonTrackerOption[] {
	const options = BUILT_IN_TRACKER_TEMPLATES.map((template) => ({
		id: template.taplogId,
		name: template.name
	}));

	for (const customTracker of normalizeCustomTrackers(customTrackers)) {
		if (options.some((option) => option.id === customTracker.id)) {
			continue;
		}

		options.push({
			id: customTracker.id,
			name: customTracker.name
		});
	}

	return options;
}

export function resolveQuickRibbonTrackerTarget(
	trackerId: string,
	customTrackers: readonly CustomTrackerDefinition[]
): QuickRibbonTrackerTarget {
	const builtInTemplate = getTrackerTemplateById(trackerId);
	if (builtInTemplate) {
		return {
			ok: true,
			id: builtInTemplate.taplogId,
			name: builtInTemplate.name,
			template: builtInTemplate
		};
	}

	const customTracker = normalizeCustomTrackers(customTrackers).find((tracker) => tracker.id === trackerId);
	if (customTracker) {
		return {
			ok: true,
			id: customTracker.id,
			name: customTracker.name,
			template: buildCustomTrackerTemplateFromDefinition(customTracker)
		};
	}

	return {
		ok: false,
		id: trackerId
	};
}
