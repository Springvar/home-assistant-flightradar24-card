import type { CardState } from '../types/cardState';
import type { ToggleConfig } from '../types/config';

export function renderToggles(cardState: CardState, toggleContainer: HTMLElement | null): void {
    if (!toggleContainer) return;
    toggleContainer.innerHTML = '';
    const toggles = cardState.config.toggles || {};
    const haSwitchAvailable = !!window.customElements && !!customElements.get('ha-switch');

    Object.keys(toggles).forEach((toggleKey) => {
        const toggleDef = toggles[toggleKey] as ToggleConfig;
        const toggleDiv = document.createElement('div');
        toggleDiv.className = 'toggle';

        const label = document.createElement('label');
        label.textContent = toggleDef.label || toggleKey;
        toggleDiv.appendChild(label);

        let input: HTMLInputElement;
        if (haSwitchAvailable) {
            input = document.createElement('ha-switch') as unknown as HTMLInputElement;
        } else {
            input = document.createElement('input');
            input.type = 'checkbox';
        }
        input.checked = toggleDef.default === true;
        input.addEventListener('change', () => {
            if (cardState.setToggleValue) {
                cardState.setToggleValue(toggleKey, input.checked);
            }
        });

        toggleDiv.appendChild(input);
        toggleContainer.appendChild(toggleDiv);
    });
}
