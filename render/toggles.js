export function renderToggles(cardState, toggleContainer) {
    toggleContainer.innerHTML = '';
    const toggles = cardState.config.toggles || {};
    const haSwitchAvailable = !!window.customElements && !!customElements.get('ha-switch');

    Object.keys(toggles).forEach((toggleKey) => {
        const toggleDef = toggles[toggleKey];
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'toggle';

        const label = document.createElement('label');
        label.textContent = toggleDef.label || toggleKey;
        toggleDiv.appendChild(label);

        let input;
        if (haSwitchAvailable) {
            input = document.createElement('ha-switch');
        } else {
            input = document.createElement('input');
            input.type = 'checkbox';
        }
        input.checked = toggleDef.default === 'true';
        input.addEventListener('change', () => {
            cardState.setToggleValue(toggleKey, input.checked);
        });

        toggleDiv.appendChild(input);
        toggleContainer.appendChild(toggleDiv);
    });
}
