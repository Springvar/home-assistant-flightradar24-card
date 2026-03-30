import { resolvePlaceholders } from './template';
import type { Flight } from '../types/flight';
import type { Condition } from '../types/config';
import type { PartialCardState } from '../types/cardState';

interface ConditionWithDebug {
    debugIf?: boolean;
    type?: 'AND' | 'OR' | 'NOT';
    conditions?: Condition[];
    condition?: Condition;
    field?: string;
    defined?: string;
    defaultValue?: unknown;
    comparator?: string;
    value?: unknown;
}

function applyFilter(cardState: PartialCardState, filter: Condition[]): Flight[] {
    return (cardState.flights || []).filter((flight) => applyConditions(cardState, flight, filter));
}

function applyConditions(cardState: PartialCardState, flight: Flight, conditions: Condition | Condition[]): boolean {
    if (Array.isArray(conditions)) {
        return conditions.every((condition) => applyCondition(cardState, flight, condition as ConditionWithDebug));
    } else {
        return applyCondition(cardState, flight, conditions as ConditionWithDebug);
    }
}

function applyCondition(cardState: PartialCardState, flight: Flight, condition: ConditionWithDebug): boolean {
    let result = true;

    if (condition.type === 'AND' && condition.conditions) {
        result = condition.conditions.every((cond) => applyCondition(cardState, flight, cond as ConditionWithDebug));
    } else if (condition.type === 'OR' && condition.conditions) {
        result = condition.conditions.some((cond) => applyCondition(cardState, flight, cond as ConditionWithDebug));
    } else if (condition.type === 'NOT' && condition.condition) {
        result = !applyCondition(cardState, flight, condition.condition as ConditionWithDebug);
    } else {
        const { field, defined, defaultValue, comparator } = condition;
        const value = resolvePlaceholders(cardState, condition.value);
        const comparand = field
            ? (flight as unknown as Record<string, unknown>)[field]
            : defined
              ? resolvePlaceholders(cardState, '${' + defined + '}', defaultValue)
              : undefined;

        switch (comparator) {
            case 'eq':
                result = comparand === value;
                break;
            case 'lt':
                result = Number(comparand) < Number(value);
                break;
            case 'lte':
                result = Number(comparand) <= Number(value);
                break;
            case 'gt':
                result = Number(comparand) > Number(value);
                break;
            case 'gte':
                result = Number(comparand) >= Number(value);
                break;
            case 'oneOf': {
                const valueArray = Array.isArray(value)
                    ? value
                    : typeof value === 'string'
                      ? value.split(',').map((v) => v.trim())
                      : [];
                result = valueArray.includes(comparand);
                break;
            }
            case 'containsOneOf': {
                const valueArray = Array.isArray(value)
                    ? value
                    : typeof value === 'string'
                      ? value.split(',').map((v) => v.trim())
                      : [];
                result =
                    !!comparand &&
                    valueArray.some((val) => (comparand as string).includes(val as string));
                break;
            }
            default:
                result = false;
        }
    }

    if (condition.debugIf === result) {
        console.debug('applyCondition', condition, flight, result);
    }

    return result;
}

export { applyFilter, applyConditions, applyCondition };
