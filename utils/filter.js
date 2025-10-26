function applyFilter(flights, filter, resolvePlaceholders) {
  return flights.filter(flight => applyConditions(flight, filter, resolvePlaceholders));
}

function applyConditions(flight, conditions, resolvePlaceholders) {
  if (Array.isArray(conditions)) {
    return conditions.every(condition => applyCondition(flight, condition, resolvePlaceholders));
  } else {
    return applyCondition(flight, conditions, resolvePlaceholders);
  }
}

function applyCondition(flight, condition, resolvePlaceholders) {
  const { field, defined, defaultValue, _, comparator } = condition;
  const value = resolvePlaceholders ? resolvePlaceholders(condition.value) : condition.value;

  let result = true;

  if (condition.type === "AND") {
    result = condition.conditions.every(cond => applyCondition(flight, cond, resolvePlaceholders));
  } else if (condition.type === "OR") {
    result = condition.conditions.some(cond => applyCondition(flight, cond, resolvePlaceholders));
  } else if (condition.type === "NOT") {
    result = !applyCondition(flight, condition.condition, resolvePlaceholders);
  } else {
    const comparand =
      flight[field] ??
      (defined
        ? resolvePlaceholders
          ? resolvePlaceholders("${" + defined + "}", defaultValue)
          : defaultValue
        : undefined);

    switch (comparator) {
      case "eq":
        result = comparand === value;
        break;
      case "lt":
        result = Number(comparand) < Number(value);
        break;
      case "lte":
        result = Number(comparand) <= Number(value);
        break;
      case "gt":
        result = Number(comparand) > Number(value);
        break;
      case "gte":
        result = Number(comparand) >= Number(value);
        break;
      case "oneOf": {
        result = (
          Array.isArray(value)
            ? value
            : typeof value === "string"
            ? value.split(",").map(v => v.trim())
            : []
        ).includes(comparand);
        break;
      }
      case "containsOneOf": {
        result =
          comparand &&
          (Array.isArray(value)
            ? value
            : typeof value === "string"
            ? value.split(",").map(v => v.trim())
            : []
          ).some(val => comparand.includes(val));
        break;
      }
      default:
        result = false;
    }
  }

  if (condition.debugIf === result) {
    console.debug("applyCondition", condition, flight, result);
  }

  return result;
}

export { applyFilter, applyConditions, applyCondition };
