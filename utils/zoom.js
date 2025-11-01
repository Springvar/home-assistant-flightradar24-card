export function setupZoomHandlers(cardState, radarOverlay) {
    let initialPinchDistance = null;
    let initialRadarRange = null;

    function getPinchDistance(touches) {
        const [touch1, touch2] = touches;
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function handleWheel(event) {
        event.preventDefault();
        const delta = Math.sign(event.deltaY);
        cardState.radar.range += delta * 5; // Direct state mutation
        cardState.mainCard.updateRadarRange(0); // Should propagate updates
    }

    function handleTouchStart(event) {
        if (event.touches.length === 2) {
            initialPinchDistance = getPinchDistance(event.touches);
            initialRadarRange = cardState.radar.range;
        }
    }

    function handleTouchMove(event) {
        if (event.touches.length === 2) {
            event.preventDefault();
            const currentPinchDistance = getPinchDistance(event.touches);
            if (currentPinchDistance > 0 && initialPinchDistance > 0) {
                const pinchRatio = currentPinchDistance / initialPinchDistance;
                const newRadarRange = initialRadarRange / pinchRatio;
                cardState.radar.range = newRadarRange; // Mutate
                cardState.mainCard.updateRadarRange(0); // Trigger render with updated range
            }
        }
    }

    function handleTouchEnd() {
        initialPinchDistance = null;
        initialRadarRange = null;
        if (cardState.renderDynamicOnRangeChange && cardState.config.updateRangeFilterOnTouchEnd) {
            cardState.mainCard.renderDynamic();
        }
    }

    if (radarOverlay) {
        radarOverlay.addEventListener('wheel', handleWheel, { passive: false });
        radarOverlay.addEventListener('touchstart', handleTouchStart, { passive: true });
        radarOverlay.addEventListener('touchmove', handleTouchMove, { passive: false });
        radarOverlay.addEventListener('touchend', handleTouchEnd, { passive: true });
        radarOverlay.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    }

    // Optional cleanup method
    return function cleanup() {
        if (radarOverlay) {
            radarOverlay.removeEventListener('wheel', handleWheel);
            radarOverlay.removeEventListener('touchstart', handleTouchStart);
            radarOverlay.removeEventListener('touchmove', handleTouchMove);
            radarOverlay.removeEventListener('touchend', handleTouchEnd);
            radarOverlay.removeEventListener('touchcancel', handleTouchEnd);
        }
    };
}
