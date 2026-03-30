import type { SortCriterion, Comparator } from '../types/config';

type ResolvePlaceholders = (value: unknown) => unknown;

export function parseSortField<T extends Record<string, unknown>>(obj: T, field: string): unknown {
    return field.split(' ?? ').reduce<unknown>((acc, cur) => acc ?? obj[cur], undefined);
}

/**
 * Returns a comparison function for sorting arrays of objects using config.
 * @param sortConfig Array of sort criteria
 * @param resolvePlaceholders Function to resolve placeholders (optional)
 */
export function getSortFn<T extends Record<string, unknown>>(
    sortConfig: SortCriterion[],
    resolvePlaceholders: ResolvePlaceholders = (v) => v
): (a: T, b: T) => number {
    return function (a: T, b: T): number {
        for (const criterion of sortConfig) {
            const { field, comparator, order = 'ASC' } = criterion;
            const value = resolvePlaceholders(criterion.value);
            const fieldA = parseSortField(a, field);
            const fieldB = parseSortField(b, field);
            let result = 0;
            switch (comparator as Comparator | undefined) {
                case 'eq':
                    if (fieldA === value && fieldB !== value) {
                        result = 1;
                    } else if (fieldA !== value && fieldB === value) {
                        result = -1;
                    }
                    break;
                case 'lt':
                    if ((fieldA as number) < (value as number) && (fieldB as number) >= (value as number)) {
                        result = 1;
                    } else if ((fieldA as number) >= (value as number) && (fieldB as number) < (value as number)) {
                        result = -1;
                    }
                    break;
                case 'lte':
                    if ((fieldA as number) <= (value as number) && (fieldB as number) > (value as number)) {
                        result = 1;
                    } else if ((fieldA as number) > (value as number) && (fieldB as number) <= (value as number)) {
                        result = -1;
                    }
                    break;
                case 'gt':
                    if ((fieldA as number) > (value as number) && (fieldB as number) <= (value as number)) {
                        result = 1;
                    } else if ((fieldA as number) <= (value as number) && (fieldB as number) > (value as number)) {
                        result = -1;
                    }
                    break;
                case 'gte':
                    if ((fieldA as number) >= (value as number) && (fieldB as number) < (value as number)) {
                        result = 1;
                    } else if ((fieldA as number) < (value as number) && (fieldB as number) >= (value as number)) {
                        result = -1;
                    }
                    break;
                case 'oneOf':
                    if (value !== undefined && value !== null && (Array.isArray(value) || typeof value === 'string')) {
                        const isAInValue = (value as unknown[]).includes(fieldA);
                        const isBInValue = (value as unknown[]).includes(fieldB);
                        if (isAInValue && !isBInValue) {
                            result = 1;
                        } else if (!isAInValue && isBInValue) {
                            result = -1;
                        }
                    }
                    break;
                case 'containsOneOf':
                    if (Array.isArray(value) && value.length > 0) {
                        const isAContainsValue = value.some(
                            (val) => (Array.isArray(fieldA) || typeof fieldA === 'string') && (fieldA as string).includes(val as string)
                        );
                        const isBContainsValue = value.some(
                            (val) => (Array.isArray(fieldB) || typeof fieldB === 'string') && (fieldB as string).includes(val as string)
                        );
                        if (isAContainsValue && !isBContainsValue) {
                            result = 1;
                        } else if (!isAContainsValue && isBContainsValue) {
                            result = -1;
                        }
                    }
                    break;
                default:
                    result = (fieldA as number) - (fieldB as number);
                    break;
            }
            if (result !== 0) {
                return order.toUpperCase() === 'DESC' ? -result : result;
            }
        }
        return 0;
    };
}
