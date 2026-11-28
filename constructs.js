/**
 * constructs.js — Конструктиви: перетягування полосок на канву.
 * Залежності: core-state.js, canvas-manager.js
 */

/** Товщина полоски конструктиву в метрах */
const CONSTRUCT_THICKNESS_M = 0.2;
const WINDOW_LENGTH_M = 1.2;
const DOOR_LENGTH_M = 0.9;
const CONSTRUCT_FIGURE_SIZE_M = 3;

/** Ініціалізує панель Конструктиви */
window.initConstructsPanel = function () {
    const body = document.getElementById('constructs-body');
    if (!body) return;
    body.innerHTML = '';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#6b7280;padding:6px 4px 8px;';
    hint.textContent = 'Перетягніть «Фігуру» на полотно або лінію; інші конструктиви — на лінію фігури.';
    body.appendChild(hint);

    // Полоска конструктиву 0.20 м
    const strip = _makeConstructStrip('Перекриття 0.20 м', CONSTRUCT_THICKNESS_M);
    body.appendChild(strip);

    // Вікно WI1
    body.appendChild(_makeWindowStrip());
    body.appendChild(_makeDoorStrip());
    body.appendChild(_makeOpeningStrip());
    body.appendChild(_makeElementStrip('Комин 1', 'KO1', 'chimney'));
    body.appendChild(_makeFigureStrip('Прямокутник', 'rectangle'));
    body.appendChild(_makeFigureStrip('Трикутник', 'triangle'));
    body.appendChild(_makeFigureStrip('Трапеція', 'trapezoid'));
    body.appendChild(_makeFigureStrip('Півкруг', 'semicircle'));
    body.appendChild(_makeFigureStrip('Четвертькруг', 'quarter'));
};

/** Будує drag-джерело полоски */
function _makeConstructStrip(label, thicknessM) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:8px 4px;margin-bottom:6px;',
        'background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;',
        'cursor:grab;user-select:none;',
    ].join('');
    wrap.title = 'Перетягніть на лінію фігури';

    // Маленька візуалізація полоски
    const preview = document.createElement('div');
    preview.style.cssText = [
        'width:80px;height:10px;',
        'background:rgba(125,211,252,0.55);',
        'border:1px solid #38bdf8;border-radius:2px;',
    ].join('');
    wrap.appendChild(preview);

    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:11px;color:#0369a1;font-weight:600;';
    lbl.textContent = label;
    wrap.appendChild(lbl);

    // Drag (миша + дотик)
    wrap.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        _startConstructDrag(e.clientX, e.clientY, thicknessM);
    });

    wrap.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        _startConstructDrag(e.touches[0].clientX, e.touches[0].clientY, thicknessM);
    }, { passive: false });

    return wrap;
}

/** Будує drag-джерело вікна */
function _makeWindowStrip() {
    return _makeElementStrip('Вікно', 'WI1', 'window');
}

/** Будує drag-джерело дверей */
function _makeDoorStrip() {
    return _makeElementStrip('Двері', 'DV1', 'door');
}

function _makeOpeningStrip() {
    return _makeElementStrip('Отвір', 'OT1', 'opening');
}

function _makeElementStrip(labelText, code, dragType) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:8px 4px;margin-bottom:6px;',
        'background:' + (code === 'KO1' ? '#fff1f2' : '#fdf4ff') + ';border:1px solid ' + (code === 'KO1' ? '#fecaca' : '#e9d5ff') + ';border-radius:6px;',
        'cursor:grab;user-select:none;',
    ].join('');
    wrap.title = 'Перетягніть на будь-яку лінію фігури';

    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview.setAttribute('width', '80');
    preview.setAttribute('height', '36');
    preview.setAttribute('viewBox', '0 0 80 36');
    preview.style.border = '1px solid #d1d5db';

    const windowShape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    windowShape.setAttribute('x', '1');
    windowShape.setAttribute('y', '12');
    windowShape.setAttribute('width', '78');
    windowShape.setAttribute('height', '12');
    windowShape.setAttribute('fill', code === 'KO1' ? '#ff0000' : 'none');
    windowShape.setAttribute('stroke', code === 'KO1' ? '#ff0000' : 'black');
    preview.appendChild(windowShape);

    if (code === 'WI1') {
        const midLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        midLine.setAttribute('x1', '1');
        midLine.setAttribute('y1', '18');
        midLine.setAttribute('x2', '79');
        midLine.setAttribute('y2', '18');
        midLine.setAttribute('stroke', 'black');
        preview.appendChild(midLine);
    } else if (code === 'DV1') {
        const midLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        midLine.setAttribute('x1', '40');
        midLine.setAttribute('y1', '0');
        midLine.setAttribute('x2', '40');
        midLine.setAttribute('y2', '36');
        midLine.setAttribute('stroke', 'black');
        preview.appendChild(midLine);
    }
    wrap.appendChild(preview);

    const label = document.createElement('span');
    label.style.cssText = 'font-size:11px;color:' + (code === 'KO1' ? '#b91c1c' : '#7e22ce') + ';font-weight:600;';
    label.textContent = labelText;
    wrap.appendChild(label);

    wrap.addEventListener('mousedown', function (e) {
        if (e.button !== 0) return;
        _startConstructDrag(e.clientX, e.clientY, CONSTRUCT_THICKNESS_M, dragType);
    });

    wrap.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        _startConstructDrag(e.touches[0].clientX, e.touches[0].clientY, CONSTRUCT_THICKNESS_M, dragType);
    }, { passive: false });

    return wrap;
}

function _makeFigureStrip(labelText, figureType) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
        'display:flex;flex-direction:column;align-items:center;gap:4px;',
        'padding:8px 4px;margin-bottom:6px;',
        'background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;',
        'cursor:grab;user-select:none;',
    ].join('');
    wrap.title = 'Перетягніть ' + labelText.toLowerCase() + ' на полотно або лінію фігури';

    const preview = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    preview.setAttribute('width', '80');
    preview.setAttribute('height', '36');
    preview.setAttribute('viewBox', '0 0 80 36');
    preview.style.border = '1px solid #d1d5db';

    if (figureType === 'rectangle') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '21'); rect.setAttribute('y', '5');
        rect.setAttribute('width', '38'); rect.setAttribute('height', '26');
        rect.setAttribute('fill', '#dbeafe'); rect.setAttribute('stroke', '#2563eb');
        preview.appendChild(rect);
    } else if (figureType === 'triangle') {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', '40,5 67,31 13,31');
        poly.setAttribute('fill', '#dbeafe'); poly.setAttribute('stroke', '#2563eb');
        preview.appendChild(poly);
    } else if (figureType === 'trapezoid') {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', '13,31 67,31 53,7 13,7');
        poly.setAttribute('fill', '#dbeafe'); poly.setAttribute('stroke', '#2563eb');
        preview.appendChild(poly);
    } else if (figureType === 'semicircle') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 13 31 A 27 27 0 0 1 67 31');
        path.setAttribute('fill', '#dbeafe'); path.setAttribute('stroke', '#2563eb');
        preview.appendChild(path);
    } else if (figureType === 'quarter') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 13 31 L 13 7 A 24 24 0 0 1 37 31 Z');
        path.setAttribute('fill', '#dbeafe'); path.setAttribute('stroke', '#2563eb');
        preview.appendChild(path);
    }
    wrap.appendChild(preview);

    const label = document.createElement('span');
    label.style.cssText = 'font-size:11px;color:#1d4ed8;font-weight:600;';
    label.textContent = labelText;
    wrap.appendChild(label);

    wrap.addEventListener('mousedown', function(e) {
        if (e.button !== 0) return;
        _startConstructDrag(e.clientX, e.clientY, CONSTRUCT_THICKNESS_M, 'figure-' + figureType);
    });
    wrap.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        _startConstructDrag(e.touches[0].clientX, e.touches[0].clientY, CONSTRUCT_THICKNESS_M, 'figure-' + figureType);
    }, { passive: false });

    return wrap;
}

/* ── Drag-стан ── */
let _cDragging    = false;
let _cThicknessM  = CONSTRUCT_THICKNESS_M;
let _cDragType    = 'construct';
let _cGhost       = null;   // SVG <rect> або <line> — візуальний привид
let _cTargetLine  = null;   // { x1,y1,x2,y2, lineData, item } — знайдена лінія
let _cActiveSvg   = null;

function _selectDroppedConstructItem(item) {
    if (!item) return;
    if (typeof selectHierarchyItem === 'function') selectHierarchyItem(item);
    if (typeof window.toggleAccordion === 'function') {
        window.toggleAccordion('panel-properties');
    } else {
        document.querySelectorAll('.accordion-section').forEach(function(section) {
            section.classList.toggle('accordion-open', section.id === 'panel-properties');
        });
    }
}

function _findDroppedLineElementItem(parentItem, lineData, code, start) {
    if (!parentItem || !lineData) return null;
    const lineTo = lineData.to ?? 'c';
    const elKey = `wi_${lineData.from}_${lineTo}_${code}_${start}`;
    const children = parentItem.children || [];

    let elItem = children.find(function(child) {
        return child.type === 'element' &&
            (child._elKey === elKey || (
                child.elCode === code &&
                child.lineFrom === lineData.from &&
                child.lineTo === lineData.to &&
                Math.abs(Number(child.elStart) - Number(start)) < 0.001
            ));
    });

    if (!elItem) {
        elItem = children.find(function(child) {
            return child.type === 'element' &&
                child.elCode === code &&
                child._hostLineId === lineData.id;
        });
    }

    if (!elItem) {
        const elGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        elItem = {
            id: G.hierarchyIdCounter++,
            type: 'element',
            name: ((typeof ELEMENT_NAMES !== 'undefined' ? ELEMENT_NAMES[code] : null) || code),
            _elKey: elKey,
            _hostLineId: lineData.id,
            elCode: code,
            elStart: start,
            elEnd: start + (code === 'WI1' ? WINDOW_LENGTH_M : code === 'KO1' ? 1 : DOOR_LENGTH_M),
            elSide: 1,
            elThickness: code === 'KO1' ? 0.4 : ELEMENT_THICKNESS,
            elOffset: 0,
            elPlacement: 'inside',
            elFill: code === 'KO1' ? '#ff0000' : '#ff0000',
            ignoreArea: false,
            reverseReference: false,
            lineFrom: lineData.from,
            lineTo: lineData.to,
            svgGroup: elGroup,
            children: [],
            expanded: false,
            parentId: parentItem.id
        };
        elGroup.setAttribute('data-hierarchy-id', elItem.id);
        parentItem.children.push(elItem);
    }
    return elItem;
}

function _startConstructDrag(clientX, clientY, thicknessM, dragType) {
    _cDragging   = true;
    _cThicknessM = thicknessM;
    _cDragType   = dragType || 'construct';
    _cTargetLine = null;

    // Знаходимо активне SVG полотно
    const canvas  = window.canvasManager?.canvases.find(c => c.id === window.canvasManager?.activeCanvasId);
    _cActiveSvg   = canvas ? document.querySelector(`[data-canvas-id="${canvas.id}"] svg`) : null;

    // Створюємо привид (overlay div — не SVG, щоб слідкувати за курсором)
    _cGhost = document.createElement('div');
    const isFigure = _cDragType === 'figure' || _cDragType.startsWith('figure-');
    _cGhost.style.cssText = [
        'position:fixed;pointer-events:none;z-index:9000;',
        'width:60px;height:' + (isFigure ? '60px' : '8px') + ';',
        'background:' + (isFigure ? 'rgba(37,99,235,0.18)' : 'rgba(125,211,252,0.6)') + ';',
        'border:1px solid ' + (isFigure ? '#2563eb' : '#38bdf8') + ';border-radius:2px;',
        'transform:translate(-50%,-50%);',
    ].join('');
    document.body.appendChild(_cGhost);

    _moveGhost(clientX, clientY);

    document.addEventListener('mousemove', _onConstructMouseMove);
    document.addEventListener('mouseup',   _onConstructMouseUp);
    document.addEventListener('touchmove', _onConstructTouchMove, { passive: false });
    document.addEventListener('touchend',  _onConstructTouchEnd);
}

function _moveGhost(clientX, clientY) {
    if (!_cGhost) return;
    _cGhost.style.left = clientX + 'px';
    _cGhost.style.top  = clientY + 'px';
}

function _onConstructMouseMove(e) {
    if (!_cDragging) return;
    _moveGhost(e.clientX, e.clientY);
    _detectSnapLine(e.clientX, e.clientY);
}

function _onConstructTouchMove(e) {
    if (!_cDragging || e.touches.length !== 1) return;
    e.preventDefault();
    _moveGhost(e.touches[0].clientX, e.touches[0].clientY);
    _detectSnapLine(e.touches[0].clientX, e.touches[0].clientY);
}

function _onConstructMouseUp(e) {
    _finishConstructDrop(e.clientX, e.clientY);
}

function _onConstructTouchEnd(e) {
    const t = e.changedTouches[0];
    _finishConstructDrop(t ? t.clientX : 0, t ? t.clientY : 0);
}

/**
 * Конвертує координати екрану в SVG-координати активного полотна
 */
function _screenToSvg(clientX, clientY) {
    if (!_cActiveSvg) return null;
    const pt = _cActiveSvg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    try { return pt.matrixTransform(_cActiveSvg.getScreenCTM().inverse()); }
    catch(e) { return null; }
}

/**
 * Шукає найближчу лінію будь-якої фігури на канві, підсвічує її
 */
function _detectSnapLine(clientX, clientY) {
    if (!_cActiveSvg) return;
    const svgPt = _screenToSvg(clientX, clientY);
    if (!svgPt) return;

    let best = null;
    let bestDist = Infinity;
    const SNAP_THRESHOLD = 30; // SVG-пікселів

    // Перебираємо всі елементи ієрархії на поточній канві
    const allItems = _flattenHierarchy(G.hierarchyData);
    allItems.forEach(function(item) {
        if (!item.figureLines || !item.shapePoints || !item.svgGroup) return;

        const offsetX = item._anchorOnCanvas
            ? item._anchorOnCanvas.x - START_X
            : (item._offsetX || 0);
        const offsetY = item._anchorOnCanvas
            ? item._anchorOnCanvas.y - START_Y
            : (item._offsetY || 0);
        // Отримуємо CTM групи → SVG
        let groupCTM = null;
        try {
            const svgScreen = _cActiveSvg.getScreenCTM();
            const grpScreen = item.svgGroup.getScreenCTM();
            if (svgScreen && grpScreen)
                groupCTM = svgScreen.inverse().multiply(grpScreen);
        } catch(e) {}

        item.figureLines.forEach(function(lineData) {
            if (lineData.isDiagonal) return;
            const fromPt = item.shapePoints.find(function(p) { return p.num === lineData.from; });
            const toPt   = lineData.isClosing
                ? item.shapePoints[0]
                : item.shapePoints.find(function(p) { return p.num === lineData.to; });
            if (!fromPt || !toPt) return;

            let x1 = fromPt.x + offsetX, y1 = fromPt.y + offsetY;
            let x2 = toPt.x   + offsetX, y2 = toPt.y   + offsetY;

            // Трансформуємо у SVG-координати через CTM групи
            if (groupCTM) {
                const p1 = _applyMatrix(groupCTM, x1, y1);
                const p2 = _applyMatrix(groupCTM, x2, y2);
                x1 = p1.x; y1 = p1.y;
                x2 = p2.x; y2 = p2.y;
            }

            let dist;
            let dropFraction;
            let curve = null;
            let curveShapePoints = item.shapePoints.map(function(point) {
                let transformed = { x: point.x + offsetX, y: point.y + offsetY };
                return groupCTM ? _applyMatrix(groupCTM, transformed.x, transformed.y) : transformed;
            });
            if (lineData.lineType === 'curve' && typeof _getLineCurveHeight === 'function') {
                const height = _getLineCurveHeight(lineData);
                if (height !== null) {
                    curve = _getSvgCurveGeometry(x1, y1, x2, y2, height * SCALE, curveShapePoints);
                }
            }
            if (curve) {
                let closestDistance = Infinity;
                let closestFraction = 0;
                const segmentCount = Math.max(24, Math.ceil(Math.abs(curve.deltaAngle) * 24));
                let previous = curve.pointAtDistance(0);
                for (let segment = 0; segment < segmentCount; segment++) {
                    const nextDistance = curve.arcLength * (segment + 1) / segmentCount;
                    const next = curve.pointAtDistance(nextDistance);
                    const t = _projectToLine(svgPt.x, svgPt.y, previous.x, previous.y, next.x, next.y);
                    const px = previous.x + (next.x - previous.x) * t;
                    const py = previous.y + (next.y - previous.y) * t;
                    const segmentDist = Math.hypot(svgPt.x - px, svgPt.y - py);
                    if (segmentDist < closestDistance) {
                        closestDistance = segmentDist;
                        closestFraction = (segment + t) / segmentCount;
                    }
                    previous = next;
                }
                dist = closestDistance;
                dropFraction = closestFraction;
            } else {
                dist = _distToSegment(svgPt.x, svgPt.y, x1, y1, x2, y2);
                dropFraction = _projectToLine(svgPt.x, svgPt.y, x1, y1, x2, y2);
            }
            if (dist < SNAP_THRESHOLD && dist < bestDist) {
                bestDist = dist;
                best = { x1, y1, x2, y2, lineData, item, fromPt, toPt, groupCTM, offsetX, offsetY,
                         dropX: svgPt.x, dropY: svgPt.y, dropFraction, curve, curveShapePoints };
            }
        });
    });

    _removeSvgSnapHighlight();
    _cTargetLine = best;
    if (best) _drawSvgSnapHighlight(best);
}

let _cSnapEl = null;
function _drawSvgSnapHighlight(lineInfo) {
    if (!_cActiveSvg) return;
    const el = document.createElementNS('http://www.w3.org/2000/svg', lineInfo.curve ? 'path' : 'line');
    if (lineInfo.curve) {
        const largeArc = Math.abs(lineInfo.curve.deltaAngle) > Math.PI ? 1 : 0;
        const sweep = lineInfo.curve.deltaAngle > 0 ? 1 : 0;
        el.setAttribute('d', `M ${lineInfo.x1} ${lineInfo.y1} A ${lineInfo.curve.radius} ${lineInfo.curve.radius} 0 ${largeArc} ${sweep} ${lineInfo.x2} ${lineInfo.y2}`);
        lineInfo.curveArcLength = lineInfo.curve.arcLength;
    } else {
        el.setAttribute('x1', lineInfo.x1); el.setAttribute('y1', lineInfo.y1);
        el.setAttribute('x2', lineInfo.x2); el.setAttribute('y2', lineInfo.y2);
    }
    el.setAttribute('stroke', '#38bdf8');
    el.setAttribute('stroke-width', '4');
    el.setAttribute('stroke-dasharray', '6 3');
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    el.setAttribute('data-snap-highlight', '1');
    el.style.pointerEvents = 'none';
    _cActiveSvg.appendChild(el);
    _cSnapEl = el;
}

function _removeSvgSnapHighlight() {
    if (_cSnapEl && _cSnapEl.parentNode) _cSnapEl.parentNode.removeChild(_cSnapEl);
    _cSnapEl = null;
}

/**
 * Завершує перетягування і малює полоску
 */
function _finishConstructDrop(clientX, clientY) {
    if (!_cDragging) return;
    _cDragging = false;

    _removeSvgSnapHighlight();
    if (_cGhost) { _cGhost.parentNode && _cGhost.parentNode.removeChild(_cGhost); _cGhost = null; }

    document.removeEventListener('mousemove', _onConstructMouseMove);
    document.removeEventListener('mouseup',   _onConstructMouseUp);
    document.removeEventListener('touchmove', _onConstructTouchMove);
    document.removeEventListener('touchend',  _onConstructTouchEnd);

    if (_cDragType === 'figure' || _cDragType.startsWith('figure-')) {
        const figureType = _cDragType === 'figure'
            ? 'rectangle'
            : _cDragType.substring('figure-'.length);
        if (_cTargetLine) _placeBoundFigure(_cTargetLine, null, figureType);
        else _placeConstructFigure(clientX, clientY, null, figureType);
        _cTargetLine = null;
        return;
    }

    if (!_cTargetLine) return;  // Не потрапили на лінію — скасовуємо

    if (_cDragType === 'window' || _cDragType === 'door' || _cDragType === 'opening' || _cDragType === 'chimney') {
        const code = _cDragType === 'window' ? 'WI1' : _cDragType === 'door' ? 'DV1' :
            _cDragType === 'opening' ? 'OT1' : 'KO1';
        _placeLineElement(_cTargetLine, code);
    } else {
        _placeConstructStrip(_cTargetLine, _cThicknessM);
    }
    _cTargetLine = null;
}

window._buildConstructFigureGeometry = function (figureType, values, center) {
    const cx = center?.x || 0;
    const cy = center?.y || 0;
    const type = figureType === 'rectangle' ? 'rectangle' : figureType;

    if (type === 'rectangle') {
        const width = Number(values.width);
        const height = Number(values.height);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
        const halfWidth = width * SCALE / 2;
        const halfHeight = height * SCALE / 2;
        const points = [
            { x: cx - halfWidth, y: cy - halfHeight, num: 1 },
            { x: cx + halfWidth, y: cy - halfHeight, num: 2 },
            { x: cx + halfWidth, y: cy + halfHeight, num: 3 },
            { x: cx - halfWidth, y: cy + halfHeight, num: 4 }
        ];
        const lengths = [width, height, width, height];
        const lines = lengths.map(function(length, index) {
            const from = index + 1;
            const to = index === 3 ? 1 : index + 2;
            return {
                id: index + 1, from, to, direction: 'right', lineType: 'line',
                elements: [{ type: 'number', value: length }],
                code: 'right\nline\n' + length.toFixed(2),
                length, isClosing: index === 3, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            };
        });
        return { points, lines, dimensions: { width, height } };
    }

    if (type === 'triangle') {
        const a = Number(values.sideA);
        const b = Number(values.sideB);
        const c = Number(values.sideC);
        if (![a, b, c].every(function(value) { return Number.isFinite(value) && value > 0; })) return null;
        if (a + b <= c || a + c <= b || b + c <= a) return null;
        const px = (b * b - c * c + a * a) / (2 * a);
        const py = Math.sqrt(Math.max(0, b * b - px * px));
        const baseOffset = a * SCALE / 2;
        const points = [
            { x: cx - baseOffset, y: cy + py * SCALE / 2, num: 1 },
            { x: cx + baseOffset, y: cy + py * SCALE / 2, num: 2 },
            { x: cx - baseOffset + px * SCALE, y: cy + py * SCALE / 2 - py * SCALE, num: 3 }
        ];
        const lengths = [a, c, b];
        const linePairs = [[1, 2], [2, 3], [3, 1]];
        const lines = lengths.map(function(length, index) {
            const pair = linePairs[index];
            return {
                id: index + 1, from: pair[0], to: pair[1], direction: 'right', lineType: 'line',
                elements: [{ type: 'number', value: length }],
                code: 'right\nline\n' + length.toFixed(2),
                length, isClosing: index === 2, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            };
        });
        return { points, lines, dimensions: { sideA: a, sideB: b, sideC: c } };
    }

    if (type === 'trapezoid') {
        const top = Number(values.top);
        const bottom = Number(values.bottom);
        const height = Number(values.height);
        if (![top, bottom, height].every(function(value) { return Number.isFinite(value) && value > 0; })) return null;
        const halfHeight = height * SCALE / 2;
        const points = [
            { x: cx - bottom * SCALE / 2, y: cy + halfHeight, num: 1 },
            { x: cx + bottom * SCALE / 2, y: cy + halfHeight, num: 2 },
            { x: cx + bottom * SCALE / 2 - (bottom - top) * SCALE, y: cy - halfHeight, num: 3 },
            { x: cx - bottom * SCALE / 2, y: cy - halfHeight, num: 4 }
        ];
        const difference = Math.abs(bottom - top);
        const lengths = [bottom, Math.hypot(difference, height), top, height];
        const linePairs = [[1, 2], [2, 3], [3, 4], [4, 1]];
        const lines = lengths.map(function(length, index) {
            const pair = linePairs[index];
            return {
                id: index + 1, from: pair[0], to: pair[1], direction: 'right', lineType: 'line',
                elements: [{ type: 'number', value: length }],
                code: 'right\nline\n' + length.toFixed(2),
                length, isClosing: index === 3, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            };
        });
        return { points, lines, dimensions: { top, bottom, height } };
    }

    if (type === 'semicircle') {
        const chord = Number(values.chord);
        const sagitta = Number(values.sagitta);
        if (!Number.isFinite(chord) || !Number.isFinite(sagitta) || chord <= 0 || sagitta <= 0 ||
            sagitta > chord / 2) return null;
        const halfChord = chord * SCALE / 2;
        const points = [
            { x: cx - halfChord, y: cy, num: 1 },
            { x: cx + halfChord, y: cy, num: 2 }
        ];
        const arcLine = {
            id: 1, from: 1, to: 2, direction: 'right', lineType: 'curve',
            elements: [{ type: 'number', value: chord }, { type: 'number', value: sagitta }],
            code: 'right\ncurve\n' + chord.toFixed(2) + '\n' + sagitta.toFixed(2),
            length: chord, isClosing: false, isDiagonal: false,
            dimensionVisible: true, dimensionRotated: false
        };
        const chordLine = {
            id: 2, from: 2, to: 1, direction: 'right', lineType: 'line',
            elements: [{ type: 'number', value: chord }],
            code: 'right\nline\n' + chord.toFixed(2),
            length: chord, isClosing: true, isDiagonal: false,
            dimensionVisible: true, dimensionRotated: false
        };
        return { points, lines: [arcLine, chordLine], dimensions: { chord, sagitta } };
    }

    if (type === 'quarter') {
        const sideA = Number(values.sideA);
        const sideB = Number(values.sideB);
        if (![sideA, sideB].every(function(value) { return Number.isFinite(value) && value > 0; })) return null;
        const radius = (sideA + sideB) / 2;
        const chord = Math.sqrt(sideA * sideA + sideB * sideB);
        const sagitta = radius - radius / Math.sqrt(2);
        const points = [
            { x: cx - sideA * SCALE / 2, y: cy + sideB * SCALE / 2, num: 1 },
            { x: cx + sideA * SCALE / 2, y: cy + sideB * SCALE / 2, num: 2 },
            { x: cx - sideA * SCALE / 2, y: cy - sideB * SCALE / 2, num: 3 }
        ];
        const lines = [
            {
                id: 1, from: 1, to: 2, direction: 'right', lineType: 'line',
                elements: [{ type: 'number', value: sideA }],
                code: 'right\nline\n' + sideA.toFixed(2),
                length: sideA, isClosing: false, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            },
            {
                id: 2, from: 2, to: 3, direction: 'right', lineType: 'curve',
                elements: [{ type: 'number', value: chord }, { type: 'number', value: sagitta }],
                code: 'right\ncurve\n' + chord.toFixed(2) + '\n' + sagitta.toFixed(2),
                length: chord, isClosing: false, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            },
            {
                id: 3, from: 3, to: 1, direction: 'right', lineType: 'line',
                elements: [{ type: 'number', value: sideB }],
                code: 'right\nline\n' + sideB.toFixed(2),
                length: sideB, isClosing: true, isDiagonal: false,
                dimensionVisible: true, dimensionRotated: false
            }
        ];
        return { points, lines, dimensions: { sideA, sideB } };
    }
    return null;
};

window._buildBoundConstructFigureGeometry = function (parentItem, binding, figureType, values, lineInfo) {
    let x1, y1, x2, y2, lineLengthPx;
    if (lineInfo) {
        x1 = lineInfo.x1; y1 = lineInfo.y1;
        x2 = lineInfo.x2; y2 = lineInfo.y2;
    } else {
        const hostLine = (parentItem.figureLines || []).find(function(lineData) {
            return lineData.id === binding.hostLineId;
        });
        if (!hostLine) return null;
        const from = (parentItem.shapePoints || []).find(function(point) {
            return point.num === hostLine.from;
        });
        const to = hostLine.isClosing
            ? (parentItem.shapePoints || []).find(function(point) { return point.num === 1; })
            : (parentItem.shapePoints || []).find(function(point) { return point.num === hostLine.to; });
        if (!from || !to) return null;
        const offsetX = parentItem._anchorOnCanvas
            ? parentItem._anchorOnCanvas.x - START_X
            : (parentItem._offsetX || 0);
        const offsetY = parentItem._anchorOnCanvas
            ? parentItem._anchorOnCanvas.y - START_Y
            : (parentItem._offsetY || 0);
        x1 = from.x + offsetX; y1 = from.y + offsetY;
        x2 = to.x + offsetX; y2 = to.y + offsetY;
    }
    lineLengthPx = Math.hypot(x2 - x1, y2 - y1);
    if (!Number.isFinite(lineLengthPx) || lineLengthPx <= 0) return null;
    const parentLength = typeof _getLineBoundFigureLength === 'function'
        ? _getLineBoundFigureLength(parentItem, binding.hostLineId)
        : lineLengthPx / SCALE;
    if (!Number.isFinite(parentLength) || parentLength <= 0) return null;

    const local = window._buildConstructFigureGeometry(figureType, values, { x: 0, y: 0 });
    if (!local || local.points.length < 2) return null;
    const localBase1 = local.points[0];
    const localBase2 = local.points[1];
    const localBaseDx = localBase2.x - localBase1.x;
    const localBaseDy = localBase2.y - localBase1.y;
    const localBaseLength = Math.hypot(localBaseDx, localBaseDy);
    if (localBaseLength <= 0) return null;

    const pxPerMeter = lineLengthPx / parentLength;
    const startMeters = binding.reverseReference
        ? parentLength - binding.end
        : binding.start;
    const endMeters = binding.reverseReference
        ? parentLength - binding.start
        : binding.end;
    const hostDx = x2 - x1;
    const hostDy = y2 - y1;
    const hostLength = Math.hypot(hostDx, hostDy);
    const ux = hostDx / hostLength;
    const uy = hostDy / hostLength;
    const px = uy;
    const py = -ux;
    const side = binding.side === -1 ? -1 : 1;
    const offsetPx = Number(binding.offset || 0) * SCALE;
    const baseCenterMeter = (startMeters + endMeters) / 2;
    const hostCenter = {
        x: x1 + ux * baseCenterMeter * pxPerMeter + px * offsetPx * side,
        y: y1 + uy * baseCenterMeter * pxPerMeter + py * offsetPx * side
    };
    const hostBaseLength = (endMeters - startMeters) * pxPerMeter;
    const hostBase1 = {
        x: x1 + ux * startMeters * pxPerMeter + px * offsetPx * side,
        y: y1 + uy * startMeters * pxPerMeter + py * offsetPx * side
    };
    const hostBase2 = {
        x: x1 + ux * endMeters * pxPerMeter + px * offsetPx * side,
        y: y1 + uy * endMeters * pxPerMeter + py * offsetPx * side
    };
    const hostBaseDx = hostBase2.x - hostBase1.x;
    const hostBaseDy = hostBase2.y - hostBase1.y;
    const hostBaseLengthActual = Math.hypot(hostBaseDx, hostBaseDy);
    if (hostBaseLengthActual <= 0) return null;

    const localBaseCenter = {
        x: (localBase1.x + localBase2.x) / 2,
        y: (localBase1.y + localBase2.y) / 2
    };
    const localAngle = Math.atan2(localBaseDy, localBaseDx);
    const hostAngle = Math.atan2(hostBaseDy, hostBaseDx);
    const angle = hostAngle - localAngle;
    const scale = hostBaseLengthActual / localBaseLength;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const points = local.points.map(function(point) {
        const rx = point.x - localBaseCenter.x;
        const ry = point.y - localBaseCenter.y;
        const sx = rx * cos - ry * sin;
        const sy = rx * sin + ry * cos;
        return {
            x: hostCenter.x + sx * scale,
            y: hostCenter.y + sy * scale,
            num: point.num
        };
    });
    return { points, lines: local.lines };
};

function _placeConstructFigure(clientX, clientY, params, figureType) {
    if (!_cActiveSvg) return false;
    const bounds = _cActiveSvg.getBoundingClientRect();
    if (clientX < bounds.left || clientX > bounds.right ||
        clientY < bounds.top || clientY > bounds.bottom) {
        showToast('Кидайте фігуру всередину полотна', 'warning');
        return false;
    }

    const center = _screenToSvg(clientX, clientY);
    if (!center) {
        showToast('Не вдалося визначити позицію на полотні', 'error');
        return false;
    }

    const type = figureType || 'rectangle';
    const values = params || {};
    if (type === 'rectangle') {
        values.width = values.width ?? CONSTRUCT_FIGURE_SIZE_M;
        values.height = values.height ?? CONSTRUCT_FIGURE_SIZE_M;
    } else if (type === 'triangle') {
        values.sideA = values.sideA ?? 3;
        values.sideB = values.sideB ?? 3;
        values.sideC = values.sideC ?? 3;
    } else if (type === 'trapezoid') {
        values.top = values.top ?? 3;
        values.bottom = values.bottom ?? 3;
        values.height = values.height ?? 3;
    } else if (type === 'semicircle') {
        values.chord = values.chord ?? 3;
        values.sagitta = values.sagitta ?? 1.5;
    } else if (type === 'quarter') {
        values.sideA = values.sideA ?? 3;
        values.sideB = values.sideB ?? 3;
    }
    const geometry = window._buildConstructFigureGeometry(type, values, center);
    if (!geometry) {
        showToast('Некоректні розміри фігури', 'warning');
        return false;
    }
    const points = geometry.points;
    const lines = geometry.lines;
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    _cActiveSvg.appendChild(group);

    const item = addToHierarchy({
        name: type === 'rectangle' ? 'Прямокутник'
            : type === 'triangle' ? 'Трикутник'
            : type === 'trapezoid' ? 'Трапеція'
            : type === 'semicircle' ? 'Півкруг'
            : 'Четвертькруг',
        area: typeof calculateFigureArea === 'function'
            ? calculateFigureArea(lines, points).toFixed(1)
            : '0',
        figureLines: lines,
        shapePoints: points,
        svgGroup: group,
        constructFigure: true,
        constructType: type,
        constructWidth: geometry.dimensions.width ?? geometry.dimensions.sideA ?? 3,
        constructHeight: geometry.dimensions.height ?? geometry.dimensions.sideB ?? 3,
        constructSideA: geometry.dimensions.sideA,
        constructSideB: geometry.dimensions.sideB,
        constructSideC: geometry.dimensions.sideC,
        constructTop: geometry.dimensions.top,
        constructBottom: geometry.dimensions.bottom,
        constructChord: geometry.dimensions.chord,
        constructSagitta: geometry.dimensions.sagitta
    });
    group.setAttribute('data-hierarchy-id', item.id);
    item._offsetX = 0;
    item._offsetY = 0;
    _redrawItemSvgGroup(item);
    _syncHierarchyToCanvas();
    _selectDroppedConstructItem(item);
    showToast('Фігуру додано на полотно', 'success');
    return true;
}

function _placeBoundFigure(lineInfo, params, figureType) {
    const parentItem = lineInfo.item;
    const hostLine = lineInfo.lineData;
    if (!parentItem || !hostLine || typeof _buildLineBoundFigureGeometry !== 'function') return false;

    const lineLength = _getLineBoundFigureLength(parentItem, hostLine.id);
    if (!Number.isFinite(lineLength) || lineLength <= 0) {
        showToast('Не вдалося визначити довжину лінії прив’язки', 'error');
        return false;
    }

    const type = figureType || 'rectangle';
    if (type !== 'rectangle') {
        const values = params || {};
        if (type === 'triangle') {
            values.sideA = values.sideA ?? 3;
            values.sideB = values.sideB ?? 3;
            values.sideC = values.sideC ?? 3;
        } else if (type === 'trapezoid') {
            values.top = values.top ?? 3;
            values.bottom = values.bottom ?? 3;
            values.height = values.height ?? 3;
        } else if (type === 'semicircle') {
            values.chord = values.chord ?? 3;
            values.sagitta = values.sagitta ?? 1.5;
        } else {
            values.sideA = values.sideA ?? 3;
            values.sideB = values.sideB ?? 3;
        }
        const baseSize = type === 'triangle' ? values.sideA
            : type === 'trapezoid' ? values.bottom
            : type === 'semicircle' ? values.chord
            : values.sideA;
        const width = Math.min(baseSize, Math.floor(lineLength * 100) / 100);
        if (width <= 0) {
            showToast('Лінія закоротка для прив’язаної фігури', 'warning');
            return false;
        }
        if (type === 'triangle') values.sideA = width;
        if (type === 'trapezoid') values.bottom = width;
        if (type === 'semicircle') values.chord = width;
        if (type === 'quarter') values.sideA = width;

        const dropFraction = Number.isFinite(lineInfo.dropFraction)
            ? Math.max(0, Math.min(1, lineInfo.dropFraction))
            : 0.5;
        const center = dropFraction * lineLength;
        const maxStart = Math.floor((lineLength - width) * 100) / 100;
        const start = params
            ? params.start
            : Math.max(0, Math.min(maxStart, window.normalizeMeasurement(center - width / 2)));
        const end = window.normalizeMeasurement(start + width);
        const binding = {
            hostLineId: hostLine.id,
            start,
            end,
            offset: params ? params.offset : 0,
            reverseReference: params ? params.reverseReference : false,
            side: params ? params.side : _getBoundFigureSide(lineInfo)
        };
        const geometry = window._buildBoundConstructFigureGeometry
            ? window._buildBoundConstructFigureGeometry(parentItem, binding, type, values)
            : null;
        if (!geometry) {
            showToast('Не вдалося створити прив’язану фігуру', 'error');
            return false;
        }
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        _cActiveSvg.appendChild(group);
        const name = type === 'triangle' ? 'Трикутник'
            : type === 'trapezoid' ? 'Трапеція'
            : type === 'semicircle' ? 'Півкруг'
            : 'Четвертькруг';
        const item = addToHierarchy({
            name,
            area: typeof calculateFigureArea === 'function'
                ? calculateFigureArea(geometry.lines, geometry.points).toFixed(1)
                : '0',
            figureLines: geometry.lines,
            shapePoints: geometry.points,
            svgGroup: group,
            parentId: parentItem.id,
            constructFigure: true,
            constructType: type,
            constructWidth: width,
            constructHeight: type === 'trapezoid' ? values.height : values.sideB ?? 3,
            constructSideA: values.sideA,
            constructSideB: values.sideB,
            constructSideC: values.sideC,
            constructTop: values.top,
            constructBottom: values.bottom,
            constructChord: values.chord,
            constructSagitta: values.sagitta
        });
        item._figureBinding = binding;
        item._offsetX = 0;
        item._offsetY = 0;
        group.setAttribute('data-hierarchy-id', item.id);
        _redrawItemSvgGroup(item);
        if (typeof _refreshFigureAreaAncestors === 'function') _refreshFigureAreaAncestors(item);
        _syncHierarchyToCanvas();
        _selectDroppedConstructItem(item);
        showToast(name + ' прив’язано до лінії', 'success');
        return true;
    }

    const width = params
        ? params.width
        : Math.min(CONSTRUCT_FIGURE_SIZE_M, Math.floor(lineLength * 100) / 100);
    if (width <= 0) {
        showToast('Лінія закоротка для прив’язаної фігури', 'warning');
        return false;
    }
    const dropFraction = Number.isFinite(lineInfo.dropFraction)
        ? Math.max(0, Math.min(1, lineInfo.dropFraction))
        : 0.5;
    const center = dropFraction * lineLength;
    const maxStart = Math.floor((lineLength - width) * 100) / 100;
    const start = params
        ? params.start
        : Math.max(0, Math.min(maxStart, window.normalizeMeasurement(center - width / 2)));
    const end = params
        ? params.end
        : window.normalizeMeasurement(start + width);
    const binding = {
        hostLineId: hostLine.id,
        start,
        end,
        offset: params ? params.offset : 0,
        reverseReference: params ? params.reverseReference : false,
        side: params ? params.side : _getBoundFigureSide(lineInfo)
    };
    const height = params ? params.height : CONSTRUCT_FIGURE_SIZE_M;
    const geometry = _buildLineBoundFigureGeometry(parentItem, binding, height);
    if (!geometry) {
        showToast('Не вдалося створити прив’язану фігуру', 'error');
        return false;
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (geometry.transform) group.setAttribute('transform', geometry.transform);
    _cActiveSvg.appendChild(group);

    const item = addToHierarchy({
        name: 'Прямокутник',
        area: typeof calculateFigureArea === 'function'
            ? calculateFigureArea(geometry.lines, geometry.points).toFixed(1)
            : (geometry.width * geometry.height).toFixed(1),
        figureLines: geometry.lines,
        shapePoints: geometry.points,
        svgGroup: group,
        parentId: parentItem.id,
        constructFigure: true,
        constructType: 'rectangle',
        constructWidth: geometry.width,
        constructHeight: geometry.height
    });
    item._figureBinding = binding;
    item._offsetX = 0;
    item._offsetY = 0;
    group.setAttribute('data-hierarchy-id', item.id);
    _redrawItemSvgGroup(item);
    if (typeof _refreshFigureAreaAncestors === 'function') _refreshFigureAreaAncestors(item);
    _syncHierarchyToCanvas();
    _selectDroppedConstructItem(item);
    showToast('Фігуру прив’язано до лінії', 'success');
    return true;
}

function _getBoundFigureSide(lineInfo) {
    let normal;
    let anchor;
    if (lineInfo.curve) {
        const point = lineInfo.curve.pointAtDistance(
            lineInfo.curve.arcLength * (Number.isFinite(lineInfo.dropFraction)
                ? Math.max(0, Math.min(1, lineInfo.dropFraction))
                : 0.5)
        );
        normal = { x: point.px, y: point.py };
        anchor = point;
    } else {
        const dx = lineInfo.x2 - lineInfo.x1;
        const dy = lineInfo.y2 - lineInfo.y1;
        const length = Math.hypot(dx, dy) || 1;
        normal = { x: dy / length, y: -dx / length };
        const fraction = Number.isFinite(lineInfo.dropFraction)
            ? Math.max(0, Math.min(1, lineInfo.dropFraction))
            : 0.5;
        anchor = {
            x: lineInfo.x1 + dx * fraction,
            y: lineInfo.y1 + dy * fraction
        };
    }

    const distance = (lineInfo.dropX - anchor.x) * normal.x +
        (lineInfo.dropY - anchor.y) * normal.y;
    if (Math.abs(distance) > 2) return distance > 0 ? 1 : -1;

    const points = (lineInfo.item.shapePoints || []).filter(function(point) { return !point.isTemp; });
    const area = points.reduce(function(sum, point, index) {
        const next = points[(index + 1) % points.length];
        return sum + point.x * next.y - next.x * point.y;
    }, 0);
    return area >= 0 ? -1 : 1;
}

/** Додає елемент до даних лінії та перемальовує фігуру */
function _placeLineElement(lineInfo, code) {
    const lineData = lineInfo.lineData;
    const item = lineInfo.item;
    if (!lineData || !item || !item.svgGroup) return;

    const pixelLength = Math.hypot(lineInfo.x2 - lineInfo.x1, lineInfo.y2 - lineInfo.y1);
    const lineLength = lineInfo.curveArcLength > 0
        ? lineInfo.curveArcLength / SCALE
        : (Number(lineData.length) > 0 ? Number(lineData.length) : pixelLength / SCALE);
    if (lineLength <= 0) return;

    const elementLength = Math.min(code === 'WI1' ? WINDOW_LENGTH_M : code === 'KO1' ? 1 : DOOR_LENGTH_M, lineLength);
    const center = lineInfo.dropFraction * lineLength;
    const start = Math.max(0, Math.min(lineLength - elementLength, center - elementLength / 2));
    const end = start + elementLength;

    if (!Array.isArray(lineData.elements)) lineData.elements = [];
    if (code === 'KO1') {
        const element = {
            type: 'element',
            value: 'KO1',
            thickness: 0.4,
            offset: 0,
            fill: '#ff0000',
            placement: 'inside',
            lineLength: Number(lineData.length) > 0 ? Number(lineData.length) : lineLength
        };
        lineData.elements.push(
            { type: 'number', value: start },
            { type: 'number', value: end },
            element
        );
        lineData.code = _rebuildLineCode(lineData.elements, lineData.direction, lineData.lineType);
        if (typeof calculateFigureArea === 'function') {
            item.area = calculateFigureArea(item.figureLines, item.shapePoints).toFixed(1);
        }
        if (typeof _redrawItemSvgGroup === 'function') _redrawItemSvgGroup(item);
        if (typeof _syncHierarchyToCanvas === 'function') _syncHierarchyToCanvas();
        if (typeof renderHierarchy === 'function') renderHierarchy();
        const elItem = _findDroppedLineElementItem(item, lineData, code, start);
        _selectDroppedConstructItem(elItem);
        showToast('Комин 1 додано до лінії', 'success');
        return;
    }
    let insertAt = lineData.elements.length;
    if (lineData.lineType === 'curve') {
        insertAt = Math.max(2, lineData.elements.length);
    } else {
        for (let i = lineData.elements.length - 1; i >= 0; i--) {
            if (lineData.elements[i].type === 'number') {
                insertAt = i;
                break;
            }
        }
    }
    lineData.elements.splice(insertAt, 0,
        { type: 'number', value: start },
        { type: 'number', value: end },
        { type: 'element', value: code }
    );
    if (typeof _rebuildLineCode === 'function') {
        lineData.code = _rebuildLineCode(lineData.elements, lineData.direction, lineData.lineType);
    }

    if (code === 'OT1' && typeof calculateFigureArea === 'function') {
        item.area = calculateFigureArea(item.figureLines, item.shapePoints).toFixed(1);
    }
    if (typeof _redrawItemSvgGroup === 'function') _redrawItemSvgGroup(item);
    if (typeof _syncHierarchyToCanvas === 'function') _syncHierarchyToCanvas();
    if (typeof renderHierarchy === 'function') renderHierarchy();
    const elItem = _findDroppedLineElementItem(item, lineData, code, start);
    _selectDroppedConstructItem(elItem);
    const label = code === 'WI1' ? 'Вікно' : code === 'DV1' ? 'Двері' : 'Отвір';
    showToast(label + ' додано до лінії', 'success');
}

/**
 * Малює полоску конструктиву вздовж знайденої лінії.
 * Довжина обмежується: кутові точки фігури + точки перетину вже існуючих
 * полосок (data-construct) з цільовою лінією — нова полоска займає
 * вільний проміжок між найближчими обмежувачами навколо точки кидання.
 *
 * @param {{ x1,y1,x2,y2, clientX,clientY }} lineInfo
 * @param {number} thicknessM
 */
function _placeCurvedConstructStrip(lineInfo, thicknessM) {
    const curve = lineInfo.curve;
    const thicknessPx = thicknessM * SCALE;
    const centerDistance = lineInfo.dropFraction * curve.arcLength;
    const tValues = [0, 1];

    _cActiveSvg.querySelectorAll('polygon[data-construct]').forEach(function(poly) {
        _parsePolygonPoints(poly).forEach(function(point) {
            tValues.push(curve.closestDistance(point.x, point.y) / curve.arcLength);
        });
    });
    tValues.sort(function(a, b) { return a - b; });

    let tStart = 0, tEnd = 1;
    const centerFraction = centerDistance / curve.arcLength;
    for (let i = 0; i < tValues.length - 1; i++) {
        if (tValues[i] <= centerFraction && centerFraction <= tValues[i + 1]) {
            tStart = tValues[i];
            tEnd = tValues[i + 1];
            break;
        }
    }
    if (tEnd - tStart < 0.001) return;

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', _curvedConstructPoints(curve, tStart, tEnd, thicknessPx));
    poly.setAttribute('fill', 'rgba(125,211,252,0.35)');
    poly.setAttribute('stroke', '#38bdf8');
    poly.setAttribute('stroke-width', '1');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    poly.setAttribute('data-construct', '1');
    poly.style.cursor = 'pointer';
    poly.title = 'Подвійний клік — видалити';
    poly.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (poly.parentNode) poly.parentNode.removeChild(poly);
    });
    _cActiveSvg.appendChild(poly);

    const stripCount = G.hierarchyData.filter(function(i) { return i.type === 'construct'; }).length + 1;
    const hierarchyItem = {
        id: G.hierarchyIdCounter++,
        type: 'construct',
        name: 'Полоска ' + stripCount,
        constructThickness: thicknessM,
        constructFromEnd: false,
        constructLength: 0,
        visible: true,
        children: [],
        expanded: false,
        parentId: null,
        _lineX1: lineInfo.x1,
        _lineY1: lineInfo.y1,
        _lineX2: lineInfo.x2,
        _lineY2: lineInfo.y2,
        _tStart: tStart,
        _tEnd: tEnd,
        _curveHeight: _getLineCurveHeight(lineInfo.lineData) * SCALE,
        _curveShapePoints: lineInfo.curveShapePoints,
        _svgPoly: poly
    };
    G.hierarchyData.push(hierarchyItem);
    if (typeof _syncHierarchyToCanvas === 'function') _syncHierarchyToCanvas();
    if (typeof renderHierarchy === 'function') renderHierarchy();
    _selectDroppedConstructItem(hierarchyItem);
    poly.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof selectHierarchyItem === 'function') selectHierarchyItem(hierarchyItem);
    });
}

function _curvedConstructPoints(curve, tStart, tEnd, thicknessPx) {
    const startDistance = tStart * curve.arcLength;
    const endDistance = tEnd * curve.arcLength;
    const count = Math.max(3, Math.ceil(Math.abs(curve.deltaAngle) * (tEnd - tStart) * 24));
    const base = [];
    const offset = [];
    for (let i = 0; i <= count; i++) {
        const point = curve.pointAtDistance(startDistance + (endDistance - startDistance) * i / count);
        base.push({ x: point.x, y: point.y });
        offset.push({ x: point.x - point.px * thicknessPx, y: point.y - point.py * thicknessPx });
    }
    return base.concat(offset.reverse()).map(function(point) {
        return point.x + ',' + point.y;
    }).join(' ');
}

function _placeConstructStrip(lineInfo, thicknessM) {
    if (!_cActiveSvg) return;
    if (lineInfo.curve) {
        _placeCurvedConstructStrip(lineInfo, thicknessM);
        return;
    }

    const { x1, y1, x2, y2, dropX, dropY } = lineInfo;
    const thicknessPx = thicknessM * SCALE;

    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const ux = dx / len, uy = dy / len;     // одиничний вектор вздовж лінії
    const nx = -uy, ny = ux;               // перпендикуляр (вліво)

    // ── Збираємо параметричні t-значення вздовж відрізка [0..1] ──
    // Завжди є кінці самого відрізка
    const tValues = [0, 1];

    // Кут кидання у параметрі t
    const tDrop = dropX !== undefined
        ? _projectToLine(dropX, dropY, x1, y1, x2, y2)
        : 0.5;

    // Знаходимо перетини існуючих полосок з лінією
    _cActiveSvg.querySelectorAll('polygon[data-construct]').forEach(function(poly) {
        const pts = _parsePolygonPoints(poly);
        if (pts.length < 4) return;

        // Перші два і останні два кути — бічні ребра полоски.
        // Ребра: 0-3 (лівий торець) і 1-2 (правий торець).
        // Шукаємо перетин кожного з 4 ребер полоски з нашою лінією.
        const edges = [
            [pts[0], pts[1]],   // основа (вздовж лінії)
            [pts[1], pts[2]],   // правий торець
            [pts[2], pts[3]],   // верхній край
            [pts[3], pts[0]],   // лівий торець
        ];

        edges.forEach(function(edge) {
            const t = _segmentIntersectT(
                x1, y1, x2, y2,
                edge[0].x, edge[0].y, edge[1].x, edge[1].y
            );
            if (t !== null) tValues.push(t);
        });
    });

    // Сортуємо і беремо проміжок навколо tDrop
    tValues.sort(function(a, b) { return a - b; });

    let tStart = 0, tEnd = 1;
    for (let i = 0; i < tValues.length - 1; i++) {
        if (tValues[i] <= tDrop && tDrop <= tValues[i + 1]) {
            tStart = tValues[i];
            tEnd   = tValues[i + 1];
            break;
        }
    }

    if (tEnd - tStart < 0.001) return; // вільного місця немає

    const sx1 = x1 + ux * tStart * len, sy1 = y1 + uy * tStart * len;
    const sx2 = x1 + ux * tEnd   * len, sy2 = y1 + uy * tEnd   * len;

    const polyPts = [
        { x: sx1,                      y: sy1                      },
        { x: sx2,                      y: sy2                      },
        { x: sx2 + nx * thicknessPx,   y: sy2 + ny * thicknessPx  },
        { x: sx1 + nx * thicknessPx,   y: sy1 + ny * thicknessPx  },
    ];

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', polyPts.map(function(p) { return p.x + ',' + p.y; }).join(' '));
    poly.setAttribute('fill', 'rgba(125,211,252,0.35)');
    poly.setAttribute('stroke', '#38bdf8');
    poly.setAttribute('stroke-width', '1');
    poly.setAttribute('vector-effect', 'non-scaling-stroke');
    poly.setAttribute('data-construct', '1');
    poly.style.cursor = 'pointer';
    poly.title = 'Подвійний клік — видалити';

    poly.addEventListener('dblclick', function(e) {
        e.stopPropagation();
        if (poly.parentNode) poly.parentNode.removeChild(poly);
    });

    _cActiveSvg.appendChild(poly);

    /* ── Реєструємо в ієрархії ── */
    const stripCount = G.hierarchyData.filter(function(i) { return i.type === 'construct'; }).length + 1;
    const hierarchyItem = {
        id:                 G.hierarchyIdCounter++,
        type:               'construct',
        name:               'Полоска ' + stripCount,
        constructThickness: thicknessM,
        constructFromEnd:   false,
        constructLength:    0,
        visible:            true,
        children:           [],
        expanded:           false,
        parentId:           null,
        // Геометрія для перемалювання
        _lineX1: x1, _lineY1: y1, _lineX2: x2, _lineY2: y2,
        _tStart: tStart, _tEnd: tEnd,
        _svgPoly: poly,
    };
    G.hierarchyData.push(hierarchyItem);
    if (typeof _syncHierarchyToCanvas === 'function') _syncHierarchyToCanvas();
    if (typeof renderHierarchy === 'function') renderHierarchy();
    _selectDroppedConstructItem(hierarchyItem);

    // Клік → виділення у панелі Елементи
    poly.addEventListener('click', function(e) {
        e.stopPropagation();
        if (typeof selectHierarchyItem === 'function') selectHierarchyItem(hierarchyItem);
    });
}

/**
 * Проектує точку (px,py) на відрізок (ax,ay)-(bx,by), повертає t ∈ [0,1].
 */
function _projectToLine(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return 0;
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    return Math.max(0, Math.min(1, t));
}

/**
 * Знаходить параметр t уздовж відрізка A=(ax1,ay1)-(ax2,ay2),
 * де він перетинає відрізок B=(bx1,by1)-(bx2,by2).
 * Повертає t ∈ [0,1] або null якщо перетину немає.
 */
function _segmentIntersectT(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    const dx1 = ax2 - ax1, dy1 = ay2 - ay1;
    const dx2 = bx2 - bx1, dy2 = by2 - by1;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-10) return null; // паралельні

    const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom;
    const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom;

    if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
        return Math.max(0, Math.min(1, t));
    }
    return null;
}

/**
 * Парсить атрибут points полігону у масив {x,y}
 */
function _parsePolygonPoints(poly) {
    const raw = poly.getAttribute('points') || '';
    return raw.trim().split(/\s+/).map(function(pair) {
        const p = pair.split(',');
        return { x: parseFloat(p[0]), y: parseFloat(p[1]) };
    }).filter(function(p) { return !isNaN(p.x) && !isNaN(p.y); });
}

/* ── Допоміжні функції ── */

function _flattenHierarchy(items, result) {
    result = result || [];
    (items || []).forEach(function(item) {
        result.push(item);
        _flattenHierarchy(item.children, result);
    });
    return result;
}

function _applyMatrix(m, x, y) {
    return {
        x: m.a * x + m.c * y + m.e,
        y: m.b * x + m.d * y + m.f,
    };
}

/** Відстань від точки (px,py) до відрізка (ax,ay)-(bx,by) */
function _distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

/**
 * Перемальовує полоску на основі властивостей ієрархічного елемента.
 * Враховує constructFromEnd і constructLength для обрізки довжини.
 */
window._redrawConstructItem = function (item) {
    if (!item || !item._svgPoly) return;

    const { _lineX1: x1, _lineY1: y1, _lineX2: x2, _lineY2: y2 } = item;
    const thicknessPx = (item.constructThickness || CONSTRUCT_THICKNESS_M) * SCALE;

    if (item._curveHeight != null) {
        const curve = _getSvgCurveGeometry(x1, y1, x2, y2, item._curveHeight, item._curveShapePoints);
        if (!curve) return;
        let tA = item._tStart;
        let tB = item._tEnd;
        const lengthM = item.constructLength || 0;
        if (lengthM > 0) {
            const span = lengthM * SCALE / curve.arcLength;
            if (item.constructFromEnd) tA = Math.max(item._tStart, tB - span);
            else tB = Math.min(item._tEnd, tA + span);
        }
        item._svgPoly.setAttribute('points', _curvedConstructPoints(curve, tA, tB, thicknessPx));
        item._svgPoly.style.display = item.visible === false ? 'none' : '';
        return;
    }

    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;

    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;

    // Межі вільного проміжку (обчислені при розміщенні)
    let tA = item._tStart;
    let tB = item._tEnd;

    // Застосовуємо constructLength (в метрах)
    const lenM = item.constructLength || 0;
    if (lenM > 0) {
        const lenPx  = lenM * SCALE;
        const tSpan  = lenPx / len;
        if (item.constructFromEnd) {
            // Відлік від кінця (tB)
            tA = Math.max(item._tStart, tB - tSpan);
        } else {
            // Відлік від початку (tA)
            tB = Math.min(item._tEnd, tA + tSpan);
        }
    }

    const sx1 = x1 + ux * tA * len, sy1 = y1 + uy * tA * len;
    const sx2 = x1 + ux * tB * len, sy2 = y1 + uy * tB * len;

    const pts = [
        sx1 + ',' + sy1,
        sx2 + ',' + sy2,
        (sx2 + nx * thicknessPx) + ',' + (sy2 + ny * thicknessPx),
        (sx1 + nx * thicknessPx) + ',' + (sy1 + ny * thicknessPx),
    ];
    item._svgPoly.setAttribute('points', pts.join(' '));

    // Видимість
    item._svgPoly.style.display = item.visible === false ? 'none' : '';
};
