/**
 * Recursively compiles a template string with possible sub-template references.
 */
export function compileTemplate(templates = {}, templateId, trace = []) {
  if (trace.includes(templateId)) {
    console.error(
      "Circular template dependencies detected. " +
        trace.join(" -> ") +
        " -> " +
        templateId
    );
    return "";
  }
  if (templates["compiled_" + templateId]) {
    return templates["compiled_" + templateId];
  }
  let template = templates[templateId];
  if (template === undefined) {
    console.error("Missing template reference: " + templateId);
    return "";
  }
  const tplRegex = /tpl\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  let tplMatch;
  const compiledTemplates = {};
  while ((tplMatch = tplRegex.exec(template)) !== null) {
    const innerTemplateId = tplMatch[1];
    if (!compiledTemplates[innerTemplateId]) {
      compiledTemplates[innerTemplateId] = compileTemplate(
        templates,
        innerTemplateId,
        [...trace, templateId]
      );
    }
    template = template.replace(
      `tpl.${innerTemplateId}`,
      "(`" +
        compiledTemplates[innerTemplateId] +
        '`).replace(/^undefined$/, "")'
    );
  }
  templates["compiled_" + templateId] = template;
  return template;
}

/**
 * Safely parses and interpolates a template string with provided context.
 * Accepts an optional joinList helper.
 * Accepts cardState object as first argument.
 */
export function parseTemplate(
  cardState = {},
  templateId,
  flight,
  joinList
) {
  const templates = cardState.templates || {};
  const flightsContext = cardState.flightsContext || {};
  const units = cardState.units || {};
  const radar = cardState.radar || {};
  const compiledTemplate = compileTemplate(templates, templateId);
  try {
    const parsedTemplate = new Function(
      "flights",
      "flight",
      "tpl",
      "units",
      "radar_range",
      "joinList",
      `return \`${compiledTemplate.replace(/\${(.*?)}/g, (_, expr) => `\${${expr}}`)}\``
    )(flightsContext, flight, {}, units, Math.round(radar.range), joinList);
    return parsedTemplate !== "undefined" ? parsedTemplate : "";
  } catch (e) {
    console.error("Error when rendering: " + compiledTemplate, e);
    return "";
  }
}

/**
 * Substitute placeholders in a string with values from context objects.
 * Accepts cardState object as first argument.
 */
export function resolvePlaceholders(cardState = {}, value, defaultValue, renderDynamicOnRangeChangeSetter) {
  const { defines = {}, config = {}, radar = {}, selectedFlights = [] } = cardState;
  if (typeof value === "string" && value.startsWith("${") && value.endsWith("}")) {
    const key = value.slice(2, -1);
    if (key === "selectedFlights") return selectedFlights;
    else if (key === "radar_range") {
      if (renderDynamicOnRangeChangeSetter) renderDynamicOnRangeChangeSetter(true);
      return radar.range;
    } else if (key in defines) return defines[key];
    else if (config.toggles && key in config.toggles) return config.toggles[key].default;
    else if (defaultValue !== undefined) return defaultValue;
    else { console.error("Unresolved placeholder: " + key); console.debug("Defines", defines); }
  }
  return value;
}
