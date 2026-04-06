import type { CardState, MainCard } from '../types/cardState';

interface ZoomCardState extends CardState {
    mainCard: MainCard & {
        updateRadarRange: (delta: number) => void;
        renderDynamic: () => void;
    };
}

export function setupZoomHandlers(cardState: ZoomCardState, radarOverlay: HTMLElement | null): () => void {
    let initialPinchDistance: number | null = null;
    let initialRadarRange: number | null = null;

    function getPinchDistance(touches: TouchList): number {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function handleWheel(event: WheelEvent): void {
        event.preventDefault();
        const delta = Math.sign(event.deltaY);
        cardState.radar.range += delta * 2;
        const minRange = cardState.radar.min_range || 1;
        const maxRange = cardState.radar.max_range || Math.max(100, cardState.radar.initialRange || 35);
        if (cardState.radar.range < minRange) cardState.radar.range = minRange;
        if (cardState.radar.range > maxRange) cardState.radar.range = maxRange;
        cardState.mainCard.updateRadarRange(delta * 2);
    }

    function handleTouchStart(event: TouchEvent): void {
        if (event.touches.length === 2) {
            initialPinchDistance = getPinchDistance(event.touches);
            initialRadarRange = cardState.radar.range;
        }
    }

    function handleTouchMove(event: TouchEvent): void {
        if (event.touches.length === 2 && initialPinchDistance !== null && initialRadarRange !== null) {
            event.preventDefault();
            const currentDistance = getPinchDistance(event.touches);
            const scale = initialPinchDistance / currentDistance;
            const minRange = cardState.radar.min_range || 1;
            const maxRange = cardState.radar.max_range || Math.max(100, cardState.radar.initialRange || 35);
            let newRange = Math.round(initialRadarRange * scale);
            if (newRange < minRange) newRange = minRange;
            if (newRange > maxRange) newRange = maxRange;
            cardState.radar.range = newRange;
            cardState.mainCard.updateRadarRange(0);
        }
    }

    function handleTouchEnd(): void {
        if (initialPinchDistance !== null) {
            initialPinchDistance = null;
            initialRadarRange = null;
            if (cardState.config.updateRangeFilterOnTouchEnd && cardState.renderDynamicOnRangeChange) {
                cardState.mainCard.renderDynamic();
            }
        }
    }

    if (radarOverlay) {
        radarOverlay.addEventListener('wheel', handleWheel, { passive: false });
        radarOverlay.addEventListener('touchstart', handleTouchStart, { passive: true });
        radarOverlay.addEventListener('touchmove', handleTouchMove, { passive: false });
        radarOverlay.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
        if (radarOverlay) {
            radarOverlay.removeEventListener('wheel', handleWheel);
            radarOverlay.removeEventListener('touchstart', handleTouchStart);
            radarOverlay.removeEventListener('touchmove', handleTouchMove);
            radarOverlay.removeEventListener('touchend', handleTouchEnd);
        }
    };
}
