export function normalizeTrackerOrder(savedOrder: readonly unknown[], knownTrackerIds: readonly string[]): string[] {
	const knownIds = new Set(knownTrackerIds);
	const normalizedOrder: string[] = [];

	for (const value of savedOrder) {
		if (typeof value !== "string") {
			continue;
		}

		const trackerId = value.trim();
		if (!knownIds.has(trackerId) || normalizedOrder.includes(trackerId)) {
			continue;
		}

		normalizedOrder.push(trackerId);
	}

	for (const trackerId of knownTrackerIds) {
		if (!normalizedOrder.includes(trackerId)) {
			normalizedOrder.push(trackerId);
		}
	}

	return normalizedOrder;
}

export function orderTrackerItems<T>(items: readonly T[], getTrackerId: (item: T) => string, trackerOrder: readonly string[]): T[] {
	const orderRank = new Map<string, number>();
	for (let index = 0; index < trackerOrder.length; index++) {
		orderRank.set(trackerOrder[index] ?? "", index);
	}

	return items
		.map((item, index) => ({
			item,
			index,
			id: getTrackerId(item)
		}))
		.sort((left, right) => {
			const leftRank = orderRank.get(left.id);
			const rightRank = orderRank.get(right.id);

			if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) {
				return leftRank - rightRank;
			}

			if (leftRank !== undefined) {
				return -1;
			}

			if (rightRank !== undefined) {
				return 1;
			}

			const nameComparison = left.id.localeCompare(right.id);
			return nameComparison === 0 ? left.index - right.index : nameComparison;
		})
		.map(({item}) => item);
}
