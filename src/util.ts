export function groupBy<T>(array: T[], keyGetter: (item: T) => string | number): Record<string | number, T[]> {
    return array.reduce((result, currentItem) => {
        const key = keyGetter(currentItem);
        if (!result[key]) {
            result[key] = [];
        }
        result[key].push(currentItem);
        return result;
    }, {} as Record<string | number, T[]>);
}
