import { renderStyle } from './style';
import { renderToggles } from './toggles';
import { renderRadarScreen } from './radarScreen';
import { setupZoomHandlers } from '../utils/zoom';
import { handleRadarTap } from '../utils/action';
import type { CardState, MainCard } from '../types/cardState';

interface StaticMainCard extends MainCard {
    updateRadarRange: (delta: number) => void;
    renderDynamic: () => void;
}

interface StaticCardState extends CardState {
    mainCard?: StaticMainCard;
}

export function renderStatic(cardState: StaticCardState, mainCard: StaticMainCard): void {
    mainCard.shadowRoot.innerHTML = '';

    const card = document.createElement('ha-card');
    card.id = 'flights-card';

    // Layout wrapper that holds the radar/map and the flights list. The class
    // reflects the configured list position so CSS can lay them out side by side
    // on wide cards, falling back to a stacked "below" layout on narrow cards.
    const layoutRoot = document.createElement('div');
    layoutRoot.id = 'layout-root';
    const listPosition = cardState.list?.position || 'below';
    layoutRoot.classList.add(`layout-${listPosition}`);
    if (cardState.radar?.view === 'map') {
        layoutRoot.classList.add('view-map');
    }

    if (!cardState.radar?.hide) {
        const radarContainer = document.createElement('div');
        radarContainer.id = 'radar-container';

        const radarOverlay = document.createElement('div');
        radarOverlay.id = 'radar-overlay';
        radarContainer.appendChild(radarOverlay);

        const radarInfoDisplay = document.createElement('div');
        radarInfoDisplay.id = 'radar-info';
        radarContainer.appendChild(radarInfoDisplay);

        const toggleContainer = document.createElement('div');
        toggleContainer.id = 'toggle-container';

        const radar = document.createElement('div');
        radar.id = 'radar';
        const radarScreenDiv = document.createElement('div');
        radarScreenDiv.id = 'radar-screen';
        radar.appendChild(radarScreenDiv);

        const tracker = document.createElement('div');
        tracker.id = 'tracker';
        radar.appendChild(tracker);

        const planesContainer = document.createElement('div');
        planesContainer.id = 'planes';
        radar.appendChild(planesContainer);

        radarContainer.appendChild(radar);
        radarContainer.appendChild(toggleContainer);
        layoutRoot.appendChild(radarContainer);

        requestAnimationFrame(() => {
            renderRadarScreen(cardState);
            mainCard.observeRadarResize();
            setupZoomHandlers(cardState as Parameters<typeof setupZoomHandlers>[0], radar);
            radar.addEventListener('click', (e: MouseEvent) => {
                if ((e as MouseEvent).composedPath().some((el: EventTarget) => (el as HTMLElement).classList?.contains?.('plane'))) return;
                handleRadarTap(cardState as CardState, e.clientX, e.clientY);
            });
        });

        cardState.dom = cardState.dom || {};
        cardState.dom.toggleContainer = toggleContainer;
        cardState.dom.planesContainer = planesContainer;
        cardState.dom.radar = radar;
        cardState.dom.radarScreen = radarScreenDiv;
        cardState.dom.radarInfoDisplay = radarInfoDisplay;
        cardState.dom.radarContainer = radarContainer;
        cardState.dom.shadowRoot = mainCard.shadowRoot;
        cardState.mainCard = mainCard;
    }

    const flightsContainer = document.createElement('div');
    flightsContainer.id = 'flights';
    if (cardState.list && cardState.list.hide === true) {
        flightsContainer.style.display = 'none';
    }
    layoutRoot.appendChild(flightsContainer);

    card.appendChild(layoutRoot);

    mainCard.shadowRoot.appendChild(card);

    renderStyle(cardState, mainCard.shadowRoot);

    if (cardState.dom?.toggleContainer) {
        renderToggles(cardState, cardState.dom.toggleContainer);
    }
}
