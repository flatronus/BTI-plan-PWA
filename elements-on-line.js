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

            const element = elements[i + 2];
            const elementThickness = code === 'KO1' && Number.isFinite(Number(element.thickness))
                ? Number(element.thickness)
                : thickness / scale;
            const elementOffset = code === 'KO1' && Number.isFinite(Number(element.offset))
                ? Number(element.offset)
                : 0;
            const elementLineLength = code === 'KO1'
                ? (curve ? curve.arcLength / scale : Number(element.lineLength || len / scale))
                : 0;
            const elementStart = code === 'KO1' && element.reverseReference
                ? elementLineLength - end / scale
                : start / scale;
            const elementEnd = code === 'KO1' && element.reverseReference
                ? elementLineLength - start / scale
                : end / scale;
            const drawStart = code === 'KO1' ? elementStart * scale : start;
            const drawEnd = code === 'KO1' ? elementEnd * scale : end;
            if (code === 'KO1') {
                side *= _chimneyInteriorSide(curveShapePoints || G.shapePoints || []);
            }
            if (curve) {
                drawCurvedArchitecturalElement(svg, code, curve, drawStart, drawEnd,
                    elementThickness * scale, side, false,
                    { fill: element.fill || '#ff0000', offset: elementOffset * scale });
            } else {
                const sx   = x1 + ux * drawStart;
                const sy   = y1 + uy * drawStart;
                const elen = drawEnd - drawStart;
                drawArchitecturalElement(svg, code, sx, sy, ux, uy, px, py, elen,
                    code === 'KO1' ? elementThickness * scale : thickness, side, false,
                    { fill: element.fill || '#ff0000', offset: elementOffset * scale });
            }

            i += 2;
        }
    }
};

window._chimneyInteriorSide = function (shapePoints, figureLines, hostLine, x1, y1, x2, y2) {
    let points = (shapePoints || []).filter(function(point) { return !point.isTemp; });
    if (Array.isArray(figureLines) && figureLines.length) {
        const contour = [];
        figureLines.forEach(function(line) {
            if (line.isDiagonal || line.isPending) return;
            const from = shapePoints.find(function(point) { return point.num === line.from; });
            const to = line.isClosing
                ? shapePoints[0]
                : shapePoints.find(function(point) { return point.num === line.to; });
            if (!from || !to) return;
            if (contour.length === 0) contour.push({ x: from.x, y: from.y });
            if (line.lineType === 'curve' && typeof _getLineCurveHeight === 'function') {
                const height = _getLineCurveHeight(line);
                const curve = height !== null
                    ? _getSvgCurveGeometry(from.x, from.y, to.x, to.y, height * SCALE, shapePoints)
                    : null;
                if (curve) {
                    const count = Math.max(12, Math.ceil(Math.abs(curve.deltaAngle) * 24));
                    for (let i = 1; i <= count; i++) {
                        const point = curve.pointAtDistance(curve.arcLength * i / count);
                        contour.push({ x: point.x, y: point.y });
                    }
                } else {
                    contour.push({ x: to.x, y: to.y });
                }
            } else {
                contour.push({ x: to.x, y: to.y });
            }
        });
        if (contour.length >= 3) points = contour;
    }
    if (hostLine && Number.isFinite(x1) && Number.isFinite(y1)) {
        const from = (shapePoints || []).find(function(point) { return point.num === hostLine.from; });
        if (from) {
            const offsetX = x1 - from.x;
            const offsetY = y1 - from.y;
            points = points.map(function(point) {
                return { x: point.x + offsetX, y: point.y + offsetY };
            });
        }
    }

    if (hostLine && hostLine.lineType === 'curve' &&
        Number.isFinite(x1) && Number.isFinite(y1) &&
        Number.isFinite(x2) && Number.isFinite(y2)) {
        const height = _getLineCurveHeight(hostLine);
        const curve = height !== null
            ? _getSvgCurveGeometry(x1, y1, x2, y2, height * SCALE, shapePoints)
            : null;
        if (curve) {
            const middle = curve.pointAtDistance(curve.arcLength / 2);
            const probeDistance = 1;
            const isInside = function(x, y) {
                let inside = false;
                for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                    const a = points[i];
                    const b = points[j];
                    if ((a.y > y) !== (b.y > y) &&
                        x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) {
                        inside = !inside;
                    }
                }
                return inside;
            };
            const rightInside = isInside(
                middle.x + middle.px * probeDistance,
                middle.y + middle.py * probeDistance
            );
            const leftInside = isInside(
                middle.x - middle.px * probeDistance,
                middle.y - middle.py * probeDistance
            );
            if (rightInside !== leftInside) return rightInside ? 1 : -1;
        }
    }

    let signedArea = 0;
    for (let i = 0; i < points.length; i++) {
        const next = points[(i + 1) % points.length];
        signedArea += points[i].x * next.y - next.x * points[i].y;
    }
    return signedArea >= 0 ? -1 : 1;
};

window.drawCurvedArchitecturalElement = function (target, code, curve, start, end, thickness, side, addHitArea, options) {
    if (code !== 'WI1' && code !== 'DV1' && code !== 'OT1' && code !== 'KO1') return;
    options = options || {};
    start = Math.max(0, Math.min(curve.arcLength, start));
    end = Math.max(start, Math.min(curve.arcLength, end));
    if (end <= start) return;
    const count = Math.max(3, Math.ceil(Math.abs(curve.deltaAngle) * Math.max(0, end - start) /
        curve.arcLength * 24));
    const base = [];
    const outer = [];
    const startPoint = curve.pointAtDistance(start);
    const endPoint = curve.pointAtDistance(end);
    const chordLength = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    let outerNormal = null;
    if (code === 'KO1' && chordLength > 0) {
        const chordUx = (endPoint.x - startPoint.x) / chordLength;
        const chordUy = (endPoint.y - startPoint.y) / chordLength;
        let normalX = chordUy;
        let normalY = -chordUx;
        const middlePoint = curve.pointAtDistance((start + end) / 2);
        if ((normalX * middlePoint.px + normalY * middlePoint.py) * side < 0) {
            normalX = -normalX;
            normalY = -normalY;
        }
        outerNormal = { x: normalX * thickness, y: normalY * thickness };
    }
    for (let i = 0; i <= count; i++) {
        const distance = start + (end - start) * i / count;
        const point = curve.pointAtDistance(distance);
        base.push({
            x: point.x + point.px * (options.offset || 0) * side,
            y: point.y + point.py * (options.offset || 0) * side
        });
        if (code !== 'KO1') {
            outer.push({
                x: point.x + point.px * ((options.offset || 0) + thickness) * side,
                y: point.y + point.py * ((options.offset || 0) + thickness) * side
            });
        }
    }
    if (outerNormal) {
        outer.push({
            x: base[0].x + outerNormal.x,
            y: base[0].y + outerNormal.y
        });
        const baseEnd = base[base.length - 1];
        outer.push({
            x: baseEnd.x + outerNormal.x,
            y: baseEnd.y + outerNormal.y
        });
    } else if (code === 'KO1') {
        outer.push(base[0], base[base.length - 1]);
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
    rect.setAttribute('fill', code === 'KO1' ? (options.fill || '#ff0000') : 'none');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    target.appendChild(rect);

    if (code === 'KO1' && (options.offset || 0) === 0) {
        const basePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        basePath.setAttribute('d', base.map(function(point, index) {
            return (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y;
        }).join(' '));
        basePath.setAttribute('fill', 'none');
        basePath.setAttribute('stroke', options.fill || '#ff0000');
        basePath.setAttribute('stroke-width', '1');
        basePath.setAttribute('vector-effect', 'non-scaling-stroke');
        target.appendChild(basePath);
    } else if (code === 'WI1') {
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

window.drawArchitecturalElement = function (target, code, sx, sy, ux, uy, px, py, elen, thickness, side, addHitArea, options) {
    if (code !== 'WI1' && code !== 'DV1' && code !== 'OT1' && code !== 'KO1') return;
    options = options || {};

    const offsetX = px * (options.offset || 0) * side;
    const offsetY = py * (options.offset || 0) * side;
    const baseX = sx + offsetX, baseY = sy + offsetY;
    const c1x = baseX,               c1y = baseY;
    const c2x = baseX + ux * elen,   c2y = baseY + uy * elen;
    const c3x = c2x + px * thickness * side, c3y = c2y + py * thickness * side;
    const c4x = c1x + px * thickness * side, c4y = c1y + py * thickness * side;

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
    rect.setAttribute('fill', code === 'KO1' ? (options.fill || '#ff0000') : 'none');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('stroke-width', '1');
    rect.setAttribute('vector-effect', 'non-scaling-stroke');
    target.appendChild(rect);

    if (code === 'KO1' && (options.offset || 0) === 0) {
        const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        baseLine.setAttribute('x1', c1x);
        baseLine.setAttribute('y1', c1y);
        baseLine.setAttribute('x2', c2x);
        baseLine.setAttribute('y2', c2y);
        baseLine.setAttribute('stroke', options.fill || '#ff0000');
        baseLine.setAttribute('stroke-width', '1');
        baseLine.setAttribute('vector-effect', 'non-scaling-stroke');
        target.appendChild(baseLine);
    } else if (code === 'WI1' || code === 'DV1') {
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
