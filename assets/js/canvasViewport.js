// Shared canvas zoom/pan behavior, extracted from the Floor Creator map
// viewer so Map Creator and Tile Editor can have the same mouse-wheel
// zoom-to-cursor and two-finger pinch-to-zoom/pan support.
//
// Works with any editor that tracks pan/zoom as a zoom number and an
// { x, y } offset, and redraws itself via a canvas-space translate(offset)
// + scale(zoom) (which is how creator.js, mapCreator.js, and tileEditor.js
// all already draw).
//
// Usage:
//   attachCanvasZoomPan(canvas, {
//     getZoom, setZoom,      // () => number / (number) => void
//     getOffset, setOffset,  // () => {x,y} / ({x,y}) => void
//     minZoom, maxZoom,      // optional, default 0.1 / 8
//     zoomStep,              // optional wheel step, default 0.1
//     pinchZoomSpeed,        // optional, default 0.005
//     pinchPan,              // optional, default true — two-finger drag also pans
//     onChange               // called after any zoom/offset change (e.g. redraw)
//   });
//
// Single-finger touch is left completely alone so each editor's own
// drawing/panning/tool logic keeps working exactly as before — this only
// ever acts on the wheel event or on two-or-more-finger touch gestures.
function attachCanvasZoomPan(canvas, opts) {
    const minZoom = opts.minZoom ?? 0.1;
    const maxZoom = opts.maxZoom ?? 8;
    const zoomStep = opts.zoomStep ?? 0.1;
    const pinchZoomSpeed = opts.pinchZoomSpeed ?? 0.005;
    const pinchPan = opts.pinchPan !== false;

    function clampZoom(z) {
        return Math.max(minZoom, Math.min(maxZoom, z));
    }

    function relativePoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function touchDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }

    function touchMidpoint(touches) {
        return relativePoint(
            (touches[0].clientX + touches[1].clientX) / 2,
            (touches[0].clientY + touches[1].clientY) / 2
        );
    }

    // Mouse wheel: zoom in/out centered on the cursor position.
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const point = relativePoint(e.clientX, e.clientY);
        const oldZoom = opts.getZoom();
        const newZoom = clampZoom(e.deltaY < 0 ? oldZoom + zoomStep : oldZoom - zoomStep);
        if (newZoom === oldZoom) return;

        const offset = opts.getOffset();
        const ratio = newZoom / oldZoom;
        opts.setZoom(newZoom);
        opts.setOffset({
            x: point.x - (point.x - offset.x) * ratio,
            y: point.y - (point.y - offset.y) * ratio
        });
        opts.onChange();
    }, { passive: false });

    // Two-finger touch: pinch to zoom, drag to pan (single-finger untouched).
    let lastTouchDist = null;
    let lastTouchMid = null;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            lastTouchDist = touchDistance(e.touches);
            lastTouchMid = touchMidpoint(e.touches);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length !== 2) return;
        e.preventDefault();

        const dist = touchDistance(e.touches);
        const mid = touchMidpoint(e.touches);

        if (lastTouchDist && lastTouchMid) {
            const oldZoom = opts.getZoom();
            const newZoom = clampZoom(oldZoom + (dist - lastTouchDist) * pinchZoomSpeed);
            const offset = opts.getOffset();
            const ratio = newZoom / oldZoom;

            // Anchoring on the *previous* midpoint (when pinchPan is on) makes
            // the zoom track the pinch and a two-finger drag pan at the same
            // time. Anchoring on the current midpoint (pinchPan off) zooms in
            // place with no added pan.
            const anchor = pinchPan ? lastTouchMid : mid;
            opts.setZoom(newZoom);
            opts.setOffset({
                x: mid.x - (anchor.x - offset.x) * ratio,
                y: mid.y - (anchor.y - offset.y) * ratio
            });
            opts.onChange();
        }
        lastTouchDist = dist;
        lastTouchMid = mid;
    }, { passive: false });

    function endPinch(e) {
        if (e.touches.length < 2) {
            lastTouchDist = null;
            lastTouchMid = null;
        }
    }
    canvas.addEventListener('touchend', endPinch, { passive: false });
    canvas.addEventListener('touchcancel', endPinch, { passive: false });
}

window.attachCanvasZoomPan = attachCanvasZoomPan;
