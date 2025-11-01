import { resolvePlaceholders } from './template.js';

function applyFilter(cardState, filter) {
    return cardState.flights.filter((flight) => applyConditions(cardState, flight, filter));
}

function applyConditions(cardState, flight, conditions) {
    if (Array.isArray(conditions)) {
        return conditions.every((condition) => applyCondition(cardState, flight, condition, resolvePlaceholders));
    } else {
        return applyCondition(cardState, flight, conditions);
    }
}

function applyCondition(cardState, flight, condition) {
    const { field, defined, defaultValue, _, comparator } = condition;
    const value = resolvePlaceholders(cardState, condition.value);

    let result = true;

    if (condition.type === 'AND') {
        result = condition.conditions.every((cond) => applyCondition(cardState, flight, cond, resolvePlaceholders));
    } else if (condition.type === 'OR') {
        result = condition.conditions.some((cond) => applyCondition(cardState, flight, cond, resolvePlaceholders));
    } else if (condition.type === 'NOT') {
        result = !applyCondition(cardState, flight, condition.condition);
    } else {
        const comparand = flight[field] ?? (defined ? resolvePlaceholders(cardState, '${' + defined + '}', defaultValue) : undefined);

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
                result = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map((v) => v.trim()) : []).includes(comparand);
                break;
            }
            case 'containsOneOf': {
                result =
                    comparand && (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',').map((v) => v.trim()) : []).some((val) => comparand.includes(val));
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
