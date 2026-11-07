/**
 * elements-on-line.js — Малювання архітектурних елементів на лінії.
 * Залежності: constants.js, svg-primitives.js
 */

window.drawElementsOnLine = function (parsedData, x1, y1, x2, y2, scale, targetGroup, overrideThickness) {
    const svg       = targetGroup || document.getElementById('shapeCanvas');
    const thickness = (overrideThickness !== undefined ? overrideThickness : ELEMENT_THICKNESS) * scale;

    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len, uy = dy / len;
    const px = uy,       py = -ux;

    const elements = parsedData.elements || [];

    for (let i = 0; i < elements.length; i++) {
        if (elements[i].type      === 'number' &&
            elements[i + 1]?.type === 'number' &&
            elements[i + 2]?.type === 'element') {

            const start = elements[i].value     * scale;
            const end   = elements[i + 1].value * scale;
            let code    = elements[i + 2].value;

            let side = 1;
            if (code.startsWith('-')) { side = -1; code = code.substring(1); }

            const sx   = x1 + ux * start;
            const sy   = y1 + uy * start;
            const elen = end - start;

            drawArchitecturalElement(svg, code, sx, sy, ux, uy, px, py, elen, thickness, side, false);

            i += 2;
        }
    }
};

window.drawArchitecturalElement = function (target, code, sx, sy, ux, uy, px, py, elen, thickness, side, addHitArea) {
    if (code !== 'WI1' && code !== 'DV1') return;

    const c1x = sx,               c1y = sy;
    const c2x = sx + ux * elen,   c2y = sy + uy * elen;
    const c3x = c2x + px * thickness * side, c3y = c2y + py * thickness * side;
    const c4x = sx  + px * thickness * side, c4y = sy  + py * thickness * side;

    if (addHitArea) {
        const hitPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hitPoly.setAttribute('points', `${c1x},${c1y} ${c2x},${c2y} ${c3x},${c3y} ${c4x},${c4y}`);
        hitPoly.setAttribute('fill', 'transparent');
        hitPoly.setAttribute('stroke', 'none');
        hitPoly.setAttribute('data-hit-area', '1');
        target.appendChild(hitPoly);
    }

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    rect.setAttribute('points', `${c1x},${c1y} ${c2x},${c2y} ${c3x},${c3y} ${c4x},${c4y}`);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    target.appendChild(rect);

    const midLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    if (code === 'WI1') {
        midLine.setAttribute('x1', sx + px * (thickness / 2) * side);
        midLine.setAttribute('y1', sy + py * (thickness / 2) * side);
        midLine.setAttribute('x2', c2x + px * (thickness / 2) * side);
        midLine.setAttribute('y2', c2y + py * (thickness / 2) * side);
    } else {
        const midX = (c1x + c2x + c3x + c4x) / 4;
        const midY = (c1y + c2y + c3y + c4y) / 4;
        const halfLength = thickness * 1.5;
        const crossX = -uy * halfLength;
        const crossY = ux * halfLength;
        midLine.setAttribute('x1', midX - crossX);
        midLine.setAttribute('y1', midY - crossY);
        midLine.setAttribute('x2', midX + crossX);
        midLine.setAttribute('y2', midY + crossY);
    }
    midLine.setAttribute('stroke', 'black');
    midLine.setAttribute('stroke-width', '1');
    midLine.setAttribute('vector-effect', 'non-scaling-stroke');
    target.appendChild(midLine);
};
