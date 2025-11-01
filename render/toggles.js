export function renderToggles(cardState, toggleContainer) {
    toggleContainer.innerHTML = '';
    const toggles = cardState.config.toggles || {};
    Object.keys(toggles).forEach((toggleKey) => {
        const toggleDef = toggles[toggleKey];
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'toggle';
        const label = document.createElement('label');
        label.textContent = toggleDef.label || toggleKey;
        toggleDiv.appendChild(label);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = toggleDef.default === 'true';
        input.onchange = (evt) => {
            cardState.config.toggles[toggleKey].default = evt.target.checked ? 'true' : 'false';
            if (typeof cardState.mainCard?.renderDynamic === 'function') {
                cardState.mainCard.renderDynamic();
            }
        };
        toggleDiv.appendChild(input);
        toggleContainer.appendChild(toggleDiv);
    });
}
