export function parseSortField(obj, field) {
  return field.split(" ?? ").reduce((acc, cur) => acc ?? obj[cur], undefined);
}

/**
 * Returns a comparison function for sorting arrays of objects using config.
 * @param {Array} sortConfig Array of sort criteria
 * @param {Function} resolvePlaceholders Function to resolve placeholders (optional)
 */
export function getSortFn(sortConfig, resolvePlaceholders = (v) => v) {
  return function(a, b) {
    for (let criterion of sortConfig) {
      const { field, comparator, order = "ASC" } = criterion;
      const value = resolvePlaceholders(criterion.value);
      const fieldA = parseSortField(a, field);
      const fieldB = parseSortField(b, field);
      let result = 0;
      switch (comparator) {
        case "eq":
          if (fieldA === value && fieldB !== value) {
            result = 1;
          } else if (fieldA !== value && fieldB === value) {
            result = -1;
          }
          break;
        case "lt":
          if (fieldA < value && fieldB >= value) {
            result = 1;
          } else if (fieldA >= value && fieldB < value) {
            result = -1;
          }
          break;
        case "lte":
          if (fieldA <= value && fieldB > value) {
            result = 1;
          } else if (fieldA > value && fieldB <= value) {
            result = -1;
          }
          break;
        case "gt":
          if (fieldA > value && fieldB <= value) {
            result = 1;
          } else if (fieldA <= value && fieldB > value) {
            result = -1;
          }
          break;
        case "gte":
          if (fieldA >= value && fieldB < value) {
            result = 1;
          } else if (fieldA < value && fieldB >= value) {
            result = -1;
          }
          break;
        case "oneOf":
          if (value !== undefined && value !== null && (Array.isArray(value) || typeof value === "string")) {
            const isAInValue = value.includes(fieldA);
            const isBInValue = value.includes(fieldB);
            if (isAInValue && !isBInValue) {
              result = 1;
            } else if (!isAInValue && isBInValue) {
              result = -1;
            }
          }
          break;
        case "containsOneOf":
          if (Array.isArray(value) && value.length > 0) {
            const isAContainsValue = value.some(val => (Array.isArray(fieldA) || typeof fieldA === "string") && fieldA.includes(val));
            const isBContainsValue = value.some(val => (Array.isArray(fieldB) || typeof fieldB === "string") && fieldB.includes(val));
            if (isAContainsValue && !isBContainsValue) {
              result = 1;
            } else if (!isAContainsValue && isBContainsValue) {
              result = -1;
            }
          }
          break;
        default:
          result = fieldA - fieldB;
          break;
      }
      if (result !== 0) {
        return order.toUpperCase() === "DESC" ? -result : result;
      }
    }
    return 0;
  }
}