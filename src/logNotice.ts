import { buildOutputPath } from "./csv";
import type { TaplogButton, TaplogConfig } from "./taplogConfig";

export function buildLogSuccessNotice(config: TaplogConfig, button: TaplogButton, now: Date): string {
	return `Logged ${button.label} to ${buildOutputPath(config, now)}.`;
}
