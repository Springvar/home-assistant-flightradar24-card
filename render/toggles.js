export function renderToggles(instance) {
  const toggleContainer = instance.shadowRoot.getElementById("toggle-container");
  if (instance.config.toggles && toggleContainer) {
    for (const toggleKey in instance.config.toggles) {
      if (instance.config.toggles.hasOwnProperty(toggleKey)) {
        const toggle = instance.config.toggles[toggleKey];

        const toggleElement = document.createElement("div");
        toggleElement.className = "toggle";

        const label = document.createElement("label");
        label.textContent = toggle.label;

        const input = document.createElement("ha-switch");
        input.checked = toggle.default;
        input.addEventListener("change", () => {
          instance.defines[toggleKey] = input.checked;
          instance.renderDynamic();
        });

        toggleElement.appendChild(label);
        toggleElement.appendChild(input);

        toggleContainer.appendChild(toggleElement);
      }
    }
  }
}