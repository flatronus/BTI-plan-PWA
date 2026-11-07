/**
 * elements-on-line.js — Малювання архітектурних елементів на лінії.
 * Залежності: constants.js, svg-primitives.js
 */

window.drawElementsOnLine = function (parsedData, x1, y1, x2, y2, scale, targetGroup, overrideThickness, curveShapePoints) {
    const svg       = targetGroup || document.getElementById('shapeCanvas');
    const thickness = (overrideThickness !== undefined ? overrideThickness : ELEMENT_THICKNESS) * scale;

    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len, uy = dy / len;
    const px = uy,       py = -ux;

    const elements = parsedData.elements || [];
    const curveValues = elements.filter(function(element) { return element.type === 'number'; });
    const curve = parsedData.lineType === 'curve' && curveValues.length > 1
        ? _getSvgCurveGeometry(x1, y1, x2, y2, Number(curveValues[1].value) * scale,
            curveShapePoints || (typeof G !== 'undefined' ? G.shapePoints : []))
        : null;

    for (let i = 0; i < elements.length; i++) {
        if (elements[i].type      === 'number' &&
            elements[i + 1]?.type === 'number' &&
            elements[i + 2]?.type === 'element') {

            const start = elements[i].value     * scale;
            const end   = elements[i + 1].value * scale;
            let code    = elements[i + 2].value;

            let side = 1;
            if (code.startsWith('-')) { side = -1; code = code.substring(1); }

            if (curve) {
                drawCurvedArchitecturalElement(svg, code, curve, start, end, thickness, side, false);
            } else {
                const sx   = x1 + ux * start;
                const sy   = y1 + uy * start;
                const elen = end - start;
                drawArchitecturalElement(svg, code, sx, sy, ux, uy, px, py, elen, thickness, side, false);
            }

            i += 2;
        }
    }
};

window.drawCurvedArchitecturalElement = function (target, code, curve, start, end, thickness, side, addHitArea) {
    if (code !== 'WI1' && code !== 'DV1' && code !== 'OT1') return;
    start = Math.max(0, Math.min(curve.arcLength, start));
    end = Math.max(start, Math.min(curve.arcLength, end));
    if (end <= start) return;
    const count = Math.max(3, Math.ceil(Math.abs(curve.deltaAngle) * Math.max(0, end - start) /
        curve.arcLength * 24));
    const base = [];
    const outer = [];
    for (let i = 0; i <= count; i++) {
        const distance = start + (end - start) * i / count;
        const point = curve.pointAtDistance(distance);
        base.push({ x: point.x, y: point.y });
        outer.push({
            x: point.x + point.px * thickness * side,
            y: point.y + point.py * thickness * side
        });
    }

    const polygonPoints = base.concat(outer.slice().reverse());
    const pointsValue = polygonPoints.map(function(point) { return point.x + ',' + point.y; }).join(' ');
    if (addHitArea) {
        const hitPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hitPoly.setAttribute('points', pointsValue);
        hitPoly.setAttribute('fill', 'transparent');
        hitPoly.setAttribute('stroke', 'none');
        hitPoly.setAttribute('data-hit-area', '1');
        target.appendChild(hitPoly);
    }

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    rect.setAttribute('points', pointsValue);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    target.appendChild(rect);

    if (code === 'WI1') {
        const middlePoints = base.map(function(point, index) {
            const outerPoint = outer[index];
            return { x: (point.x + outerPoint.x) / 2, y: (point.y + outerPoint.y) / 2 };
        });
        const midPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        midPath.setAttribute('d', middlePoints.map(function(point, index) {
            return (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y;
        }).join(' '));
        midPath.setAttribute('fill', 'none');
        midPath.setAttribute('stroke', 'black');
        midPath.setAttribute('stroke-width', '1');
        midPath.setAttribute('vector-effect', 'non-scaling-stroke');
        target.appendChild(midPath);
    } else if (code === 'DV1') {
        const middle = curve.pointAtDistance((start + end) / 2);
        const halfLength = thickness * 1.5;
        const midLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        midLine.setAttribute('x1', middle.x - middle.ux * halfLength);
        midLine.setAttribute('y1', middle.y - middle.uy * halfLength);
        midLine.setAttribute('x2', middle.x + middle.ux * halfLength);
        midLine.setAttribute('y2', middle.y + middle.uy * halfLength);
        midLine.setAttribute('stroke', 'black');
        midLine.setAttribute('stroke-width', '1');
        midLine.setAttribute('vector-effect', 'non-scaling-stroke');
        target.appendChild(midLine);
    }
};

window.drawArchitecturalElement = function (target, code, sx, sy, ux, uy, px, py, elen, thickness, side, addHitArea) {
    if (code !== 'WI1' && code !== 'DV1' && code !== 'OT1') return;

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

    if (code === 'WI1' || code === 'DV1') {
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
    }
};
