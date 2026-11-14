/**
 * shape-transfer.js — Перенос фігури на головне полотно.
 * Залежності: constants.js, state.js, g.js, svg-primitives.js, elements-on-line.js, hierarchy.js
 */

/** Заповнює SVG-групу лініями, розмірами та елементами поточної фігури */
window._fillSvgGroup = function (group, offsetX, offsetY, parentHierarchyItem) {
    // Прозорий полігон для зручного кліку по всій площі фігури
    const nonDiagLines = G.figureLines.filter(l => !l.isDiagonal);
    if (nonDiagLines.length >= 2) {
        const hitPoints = G.shapePoints.map(p => (p.x + offsetX) + ',' + (p.y + offsetY)).join(' ');
        const hitPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hitPoly.setAttribute('points', hitPoints);
        hitPoly.setAttribute('fill', 'transparent');
        hitPoly.setAttribute('stroke', 'none');
        hitPoly.setAttribute('data-hit-area', '1');
        group.appendChild(hitPoly);
    }

    G.figureLines.forEach(lineData => {
        const fromPoint = G.shapePoints.find(p => p.num === lineData.from);
        const toPoint   = lineData.isClosing ? G.shapePoints[0] : G.shapePoints.find(p => p.num === lineData.to);
        if (!fromPoint || !toPoint) return;

        const x1 = fromPoint.x + offsetX, y1 = fromPoint.y + offsetY;
        const x2 = toPoint.x   + offsetX, y2 = toPoint.y   + offsetY;

        // Діагоналі на головному полотні невидимі
        if (lineData.isDiagonal) return;

        if (lineData.lineType === 'curve' && typeof _getLineCurveHeight(lineData) === 'number') {
            _renderSvgCurve(group, x1, y1, x2, y2,
                _getLineCurveHeight(lineData) * SCALE, lineData.id, G.shapePoints);
        } else {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1); line.setAttribute('y1', y1);
            line.setAttribute('x2', x2); line.setAttribute('y2', y2);
            line.setAttribute('stroke', 'black');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('vector-effect', 'non-scaling-stroke');
            group.appendChild(line);
        }

        const dimFsMm = parentHierarchyItem && parentHierarchyItem.dimensionFontSize != null
            ? parentHierarchyItem.dimensionFontSize : DEFAULT_FONT_SIZE_MM;
        drawMainCanvasDimension(group, x1, y1, x2, y2, lineData.length, lineData,
            dimFsMm * FONT_MM_TO_PX);

        if (lineData.elements && lineData.elements.length > 0) {
            const elThickness = typeof lineData._elementThickness === 'number'
                ? lineData._elementThickness
                : undefined;
            _drawElementsIntoGroups(lineData, x1, y1, x2, y2, SCALE, group, elThickness, parentHierarchyItem);
        }
    });

    if (G.roomNumber && G.shapePoints.length >= 2) {
        const validPoints = G.shapePoints.filter(p => !p.isTemp);
        let cx = 0, cy = 0;
        validPoints.forEach(p => { cx += p.x + offsetX; cy += p.y + offsetY; });
        cx /= validPoints.length; cy /= validPoints.length;

        // Визначаємо налаштування підпису з parentHierarchyItem
        const phi = parentHierarchyItem;
        const showLabel  = !phi || phi.showRoomLabel !== false;
        const labelStyle = (phi && phi.roomLabelStyle === 'leader') ? 'leader' : 'inline';
        const displayArea = phi && phi.useCustomArea && phi.customArea
            ? phi.customArea
            : (phi ? phi.area : null);

        if (showLabel) {
            const lfsMm = phi && phi.labelFontSize != null ? phi.labelFontSize : DEFAULT_FONT_SIZE_MM;
            const lfsPx = lfsMm * FONT_MM_TO_PX;
            if (displayArea) {
                const ldx = phi && phi.leaderDx != null ? phi.leaderDx : 40;
                const ldy = phi && phi.leaderDy != null ? phi.leaderDy : -30;
                const onMove = phi ? function(ndx, ndy) {
                    phi.leaderDx = ndx;
                    phi.leaderDy = ndy;
                } : null;
                group.appendChild(buildRoomLabel(cx, cy, G.roomNumber, displayArea, labelStyle,
                    ldx, ldy, onMove, lfsPx));
            } else {
                group.appendChild(buildRoomNumberText(cx, cy, G.roomNumber, lfsPx));
            }
        }
    }
};

/**
 * Малює елементи лінії (WI1 тощо) кожен у власну <g data-hierarchy-id>,
 * реєструє їх як дочірні елементи ієрархії батьківської фігури.
 */
window._drawElementsIntoGroups = function (lineData, x1, y1, x2, y2, scale, parentGroup, overrideThickness, parentHierarchyItem) {
    const lineThickness = (overrideThickness !== undefined ? overrideThickness : ELEMENT_THICKNESS);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    const px = uy, py = -ux;
    const elements = lineData.elements || [];
    const height = typeof _getLineCurveHeight === 'function' ? _getLineCurveHeight(lineData) : null;
    const curve = lineData.lineType === 'curve' && height !== null
        ? _getSvgCurveGeometry(x1, y1, x2, y2, height * scale, G.shapePoints)
        : null;

    for (let i = 0; i < elements.length; i++) {
        if (elements[i]?.type     === 'number' &&
            elements[i+1]?.type   === 'number' &&
            elements[i+2]?.type   === 'element') {

            const start = elements[i].value   * scale;
            const end   = elements[i+1].value * scale;
            let code    = elements[i+2].value;
            let side    = 1;
            if (code.startsWith('-')) { side = -1; code = code.substring(1); }

            // Шукаємо існуючий дочірній елемент ієрархії для цього елемента
            const elKey = `wi_${lineData.from}_${lineData.to ?? 'c'}_${code}_${elements[i].value}`;
            let elItem = null;
            if (parentHierarchyItem) {
                const children = parentHierarchyItem.children || [];
                elItem = children.find(c => c._elKey === elKey && c.type === 'element');
                if (!elItem) {
                    const previousLine = (parentHierarchyItem.figureLines || []).find(l => l.id === lineData.id);
                    if (previousLine) {
                        elItem = children.find(c =>
                            c.type === 'element' &&
                            c.lineFrom === previousLine.from &&
                            c.lineTo === previousLine.to &&
                            c.elCode === code &&
                            c.elStart === elements[i].value
                        );
                    }
                }
            }

            // SVG-група для елемента
            const elGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            if (elItem) {
                // Оновлюємо існуючий: перереєструємо групу
                elGroup.setAttribute('data-hierarchy-id', elItem.id);
                elItem.svgGroup = elGroup;
                elItem._hostLineId = lineData.id;
                elItem._elKey = elKey;
                elItem.lineFrom = lineData.from;
                elItem.lineTo = lineData.to;
                elItem.elStart = elements[i].value;
                elItem.elEnd = elements[i + 1].value;
                if (code === 'KO1') {
                    if (typeof elements[i + 2].ignoreArea === 'boolean') {
                        elItem.ignoreArea = elements[i + 2].ignoreArea;
                    }
                    if (typeof elements[i + 2].reverseReference === 'boolean') {
                        elItem.reverseReference = elements[i + 2].reverseReference;
                    }
                }
            } else {
                // Новий елемент ієрархії
                const newId = G.hierarchyIdCounter++;
                elGroup.setAttribute('data-hierarchy-id', newId);
                if (parentHierarchyItem) {
                    const newEl = {
                        id:       newId,
                        type:     'element',
                        name:     ((typeof ELEMENT_NAMES !== 'undefined' ? ELEMENT_NAMES[code] : null) || code) + ' ' + lineData.from + '-' + (lineData.to ?? 'c'),
                        _elKey:   elKey,
                        _hostLineId: lineData.id,
                        elCode:   code,
                        elStart:  elements[i].value,
                        elEnd:    elements[i+1].value,
                        elSide:   side,
                        elThickness: Number.isFinite(Number(elements[i+2].thickness))
                            ? Number(elements[i+2].thickness) : (code === 'KO1' ? 0.4 : lineThickness),
                        elOffset: Number.isFinite(Number(elements[i+2].offset))
                            ? Number(elements[i+2].offset) : 0,
                        elPlacement: code === 'KO1'
                            ? (elements[i+2].placement || (elements[i+2].value.startsWith('-') ? 'outside' : 'inside'))
                            : 'inside',
                        elFill: elements[i+2].fill || '#ff0000',
                        ignoreArea: elements[i+2].ignoreArea === true,
                        reverseReference: elements[i+2].reverseReference === true,
                        lineFrom: lineData.from,
                        lineTo:   lineData.to,
                        svgGroup: elGroup,
                        children: [],
                        expanded: false,
                        parentId: parentHierarchyItem.id
                    };
                    parentHierarchyItem.children.push(newEl);
                    elItem = newEl;
                }
            }
            if (elItem && code === 'KO1') {
                elItem.elThickness = Number.isFinite(Number(elements[i + 2].thickness))
                    ? Number(elements[i + 2].thickness) : (elItem.elThickness ?? 0.4);
                elItem.elOffset = Number.isFinite(Number(elements[i + 2].offset))
                    ? Number(elements[i + 2].offset) : (elItem.elOffset ?? 0);
                elItem.elPlacement = elements[i + 2].placement ||
                    (elements[i + 2].value.startsWith('-') ? 'outside' : (elItem.elPlacement || 'inside'));
                elItem.elFill = elements[i + 2].fill || elItem.elFill || '#ff0000';
                if (typeof elements[i + 2].ignoreArea === 'boolean') {
                    elItem.ignoreArea = elements[i + 2].ignoreArea;
                }
                if (typeof elements[i + 2].reverseReference === 'boolean') {
                    elItem.reverseReference = elements[i + 2].reverseReference;
                }
            }

            parentGroup.appendChild(elGroup);

            if (code === 'WI1' || code === 'DV1' || code === 'OT1' || code === 'KO1') {
                // Товщина: індивідуальна для елемента > загальна для лінії > константа
                const elThickness = (elItem && elItem.elThickness != null)
                    ? elItem.elThickness
                    : (code === 'KO1' ? 0.4 : lineThickness);
                const elementSide = code === 'KO1'
                    ? _chimneyInteriorSide(G.shapePoints, G.figureLines, lineData, x1, y1, x2, y2) *
                        (elItem && elItem.elPlacement === 'outside' ? -1 : 1)
                    : side;
                const options = code === 'KO1'
                    ? {
                        fill: elItem && elItem.elFill || '#ff0000',
                        offset: (elItem && elItem.elOffset || 0) * scale
                    }
                    : undefined;
                const elementLineLength = curve
                    ? curve.arcLength / scale
                    : Number(elements[i + 2].lineLength || lineData.length || len / scale);
                const elementStart = code === 'KO1' && elItem && elItem.reverseReference
                    ? elementLineLength - elements[i + 1].value
                    : elements[i].value;
                const elementEnd = code === 'KO1' && elItem && elItem.reverseReference
                    ? elementLineLength - elements[i].value
                    : elements[i + 1].value;
                if (curve) {
                    drawCurvedArchitecturalElement(elGroup, code, curve,
                        code === 'KO1' ? elementStart * scale : start,
                        code === 'KO1' ? elementEnd * scale : end,
                        elThickness * scale, elementSide, true, options);
                } else {
                    const elementStartPx = code === 'KO1' ? elementStart * scale : start;
                    const elementEndPx = code === 'KO1' ? elementEnd * scale : end;
                    const sx = x1 + ux * elementStartPx;
                    const sy = y1 + uy * elementStartPx;
                    drawArchitecturalElement(elGroup, code, sx, sy, ux, uy, px, py,
                        elementEndPx - elementStartPx, elThickness * scale, elementSide, true, options);
                }
            }

            i += 2;
        }
    }
};

/** Очищає групу і перебудовує її вміст (для режиму редагування) */
window._rebuildSvgGroup = function (group, offsetX, offsetY, parentHierarchyItem) {
    while (group.firstChild) group.removeChild(group.firstChild);
    _fillSvgGroup(group, offsetX, offsetY, parentHierarchyItem);
};

/** Розміри на головному полотні */
window.drawMainCanvasDimension = function (group, x1, y1, x2, y2, lengthInMeters, lineData, fontSize) {
    if (lineData && lineData.dimensionVisible === false) return;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len, uy = dy / len;
    const px = uy, py = -ux;
    const fs     = fontSize != null ? fontSize : DEFAULT_FONT_SIZE_MM * FONT_MM_TO_PX;
    const offset = fs / 2 + 2;
    const dir    = G.dimensionsOutside ? 1 : -1;
    const cx     = (x1 + x2) / 2;
    const cy     = (y1 + y2) / 2;
    const textX  = cx + px * offset * dir;
    const textY  = cy + py * offset * dir;

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90)  angle -= 180;
    if (angle < -90) angle += 180;
    if (lineData && lineData.dimensionRotated) angle += 180;

    const numLen = typeof lengthInMeters === 'number' ? lengthInMeters : parseFloat(lengthInMeters);
    group.appendChild(_makeSvgText(textX, textY, numLen.toFixed(2), angle, fontSize));
};

/** Перенос / оновлення фігури на головному полотні */
window.transferFigureToMainCanvas = function () {
    const canvas = window.canvasManager?.canvases.find(
        c => c.id === window.canvasManager?.activeCanvasId
    );
    if (!canvas) { showToast('Немає активного полотна', 'error'); return; }
    const mainSvg = document.querySelector(`[data-canvas-id="${canvas.id}"] svg`);
    if (!mainSvg) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    G.shapePoints.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    });

    const frameCenterX  = A4_OFFSET + A4_WIDTH  / 2;
    const frameCenterY  = A4_OFFSET + A4_HEIGHT / 2;
    const figureCenterX = minX + (maxX - minX) / 2;
    const figureCenterY = minY + (maxY - minY) / 2;
    const offsetX = frameCenterX - figureCenterX;
    const offsetY = frameCenterY - figureCenterY;

    const editId = appState.editingHierarchyItemId;
    if (editId !== null) {
        const existingItem = findHierarchyItemById(editId);
        if (existingItem && existingItem.svgGroup) {

            // Визначаємо offset: якір → прив'язана фігура; збережений → звичайна фігура
            let useOffsetX, useOffsetY;
            if (existingItem._anchorOnCanvas) {
                useOffsetX = existingItem._anchorOnCanvas.x - START_X;
                useOffsetY = existingItem._anchorOnCanvas.y - START_Y;
            } else if (existingItem._offsetX !== undefined) {
                useOffsetX = existingItem._offsetX;
                useOffsetY = existingItem._offsetY;
            } else {
                useOffsetX = offsetX;
                useOffsetY = offsetY;
            }

            if (existingItem.constructFigure) {
                G.figureLines.forEach(function(lineData, index) {
                    const previousLine = existingItem.figureLines.find(function(previous) {
                        return previous.id === lineData.id;
                    }) || existingItem.figureLines[index];
                    if (!previousLine) return;
                    if (typeof previousLine.dimensionVisible === 'boolean') {
                        lineData.dimensionVisible = previousLine.dimensionVisible;
                    }
                    if (typeof previousLine.dimensionRotated === 'boolean') {
                        lineData.dimensionRotated = previousLine.dimensionRotated;
                    }
                });
            }
            _rebuildSvgGroup(existingItem.svgGroup, useOffsetX, useOffsetY, existingItem);

            existingItem.figureLines = JSON.parse(JSON.stringify(G.figureLines));
            existingItem.shapePoints = JSON.parse(JSON.stringify(G.shapePoints));
            existingItem.roomNumber  = G.roomNumber;
            existingItem.type        = G.isBuilding ? 'building' : 'room';
            existingItem.area        = appState.customArea || appState.calculatedArea;
            if (existingItem.constructFigure) {
                const points = existingItem.shapePoints.filter(function(point) { return !point.isTemp; });
                if (points.length === 4) {
                    const vectors = points.map(function(point, index) {
                        const next = points[(index + 1) % points.length];
                        return { x: next.x - point.x, y: next.y - point.y };
                    });
                    const lengths = vectors.map(function(vector) {
                        return Math.hypot(vector.x, vector.y);
                    });
                    const cornersAreRight = vectors.every(function(vector, index) {
                        const next = vectors[(index + 1) % vectors.length];
                        return Math.abs(vector.x * next.x + vector.y * next.y) <=
                            lengths[index] * lengths[(index + 1) % lengths.length] * 0.001;
                    });
                    const oppositeSidesMatch =
                        Math.abs(lengths[0] - lengths[2]) <= 0.01 * SCALE &&
                        Math.abs(lengths[1] - lengths[3]) <= 0.01 * SCALE;
                    if (cornersAreRight && oppositeSidesMatch) {
                        existingItem.constructWidth = lengths[0] / SCALE;
                        existingItem.constructHeight = lengths[1] / SCALE;
                    } else {
                        existingItem.constructFigure = false;
                    }
                } else {
                    existingItem.constructFigure = false;
                }
            }
            // Оновлюємо збережений offset (міг бути null для старих елементів)
            if (!existingItem._anchorOnCanvas) {
                existingItem._offsetX = useOffsetX;
                existingItem._offsetY = useOffsetY;
            }

            _refreshChildAnchors(existingItem, useOffsetX, useOffsetY);

            appState.editingHierarchyItemId = null;
            renderHierarchy();
            showToast('Фігуру оновлено', 'success');
            return;
        }
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-hierarchy-id', G.hierarchyIdCounter);
    mainSvg.appendChild(group);

    const newItem = addToHierarchy({
        isBuilding:  G.isBuilding,
        name:        G.isBuilding ? 'Будівля' : 'Кімната',
        roomNumber:  G.roomNumber,
        area:        appState.customArea || appState.calculatedArea,
        figureLines: G.figureLines,
        shapePoints: G.shapePoints,
        svgGroup:    group,
        parentId:    G.selectedHierarchyItem
    });
    _fillSvgGroup(group, offsetX, offsetY, newItem);
    // Зберігаємо offset щоб при повторному редагуванні фігура не зміщувалась
    newItem._offsetX = offsetX;
    newItem._offsetY = offsetY;

    showToast('Фігуру перенесено на головне полотно', 'success');
};

/**
 * Перераховує абсолютну координату точки прив'язки на SVG
 * з параметричного опису (_anchorDef) і поточного offsetX/Y батьківської фігури.
 *
 * anchorDef: { hostLineId, elStart, elEnd, elSide, thickness, corner, dist }
 * parentItem: елемент ієрархії батьківської фігури (має figureLines, shapePoints)
 * offsetX/Y:  зміщення батьківської фігури на полотні
 *
 * Повертає { x, y } або null якщо неможливо обчислити.
 */
window._computeAnchorOnCanvas = function (anchorDef, parentItem, offsetX, offsetY) {
    const { hostLineId, elStart, elEnd, elSide, thickness, corner, dist } = anchorDef;

    // Перебудовуємо координати батьківської фігури
    const savedLines  = G.figureLines;
    const savedPoints = G.shapePoints;
    G.figureLines = JSON.parse(JSON.stringify(parentItem.figureLines));
    G.shapePoints = JSON.parse(JSON.stringify(parentItem.shapePoints));
    _rebuildChainPoints();
    const rebuildPoints = G.shapePoints;
    const rebuildLines  = G.figureLines;
    G.figureLines = savedLines;
    G.shapePoints = savedPoints;

    const hostLine = rebuildLines.find(l => l.id === hostLineId);
    if (!hostLine) return null;

    const fromPt = rebuildPoints.find(p => p.num === hostLine.from);
    const toPt   = hostLine.isClosing ? rebuildPoints[0] : rebuildPoints.find(p => p.num === hostLine.to);
    if (!fromPt || !toPt) return null;

    const x1 = fromPt.x + offsetX, y1 = fromPt.y + offsetY;
    const x2 = toPt.x   + offsetX, y2 = toPt.y   + offsetY;

    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    const ux = dx / len, uy = dy / len;
    const px = uy, py = -ux;
    const side = elSide || 1;

    const wA_x = x1 + ux * elStart * SCALE + px * thickness * SCALE * side;
    const wA_y = y1 + uy * elStart * SCALE + py * thickness * SCALE * side;
    const wB_x = x1 + ux * elEnd   * SCALE + px * thickness * SCALE * side;
    const wB_y = y1 + uy * elEnd   * SCALE + py * thickness * SCALE * side;

    const anchorX = corner === 1 ? wA_x : wB_x;
    const anchorY = corner === 1 ? wA_y : wB_y;

    const wdx = wB_x - wA_x, wdy = wB_y - wA_y;
    const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
    if (wlen === 0) return { x: anchorX, y: anchorY };

    const sign = corner === 1 ? -1 : 1;
    return {
        x: anchorX + sign * wdx / wlen * dist * SCALE,
        y: anchorY + sign * wdy / wlen * dist * SCALE
    };
};

function _getLineBoundFigureContext(parentItem, hostLineId) {
    const hostLine = (parentItem.figureLines || []).find(function(line) {
        return line.id === hostLineId;
    });
    if (!hostLine) return null;

    const points = (parentItem.shapePoints || []).filter(function(point) { return !point.isTemp; });
    const fromPoint = points.find(function(point) { return point.num === hostLine.from; });
    const toPoint = hostLine.isClosing
        ? points[0]
        : points.find(function(point) { return point.num === hostLine.to; });
    if (!fromPoint || !toPoint) return null;

    const offsetX = parentItem._anchorOnCanvas
        ? parentItem._anchorOnCanvas.x - START_X
        : (parentItem._offsetX || 0);
    const offsetY = parentItem._anchorOnCanvas
        ? parentItem._anchorOnCanvas.y - START_Y
        : (parentItem._offsetY || 0);
    const x1 = fromPoint.x + offsetX;
    const y1 = fromPoint.y + offsetY;
    const x2 = toPoint.x + offsetX;
    const y2 = toPoint.y + offsetY;
    const curveShapePoints = points.map(function(point) {
        return { x: point.x + offsetX, y: point.y + offsetY };
    });
    const curveHeight = hostLine.lineType === 'curve'
        ? _getLineCurveHeight(hostLine)
        : null;
    const curve = curveHeight !== null
        ? _getSvgCurveGeometry(x1, y1, x2, y2, curveHeight * SCALE, curveShapePoints)
        : null;
    const chordLength = Math.hypot(x2 - x1, y2 - y1);
    const length = curve ? curve.arcLength : chordLength;

    return {
        hostLine,
        fromPoint,
        toPoint,
        x1,
        y1,
        x2,
        y2,
        curve,
        length,
        transform: parentItem.svgGroup?.getAttribute('transform') || ''
    };
}

window._getLineBoundFigureLength = function (parentItem, hostLineId) {
    const context = _getLineBoundFigureContext(parentItem, hostLineId);
    return context ? context.length / SCALE : 0;
};

function _makeBoundFigureLine(id, from, to, length, curveHeight, chordLength, closing) {
    const isCurve = curveHeight !== null;
    const elements = isCurve
        ? [{ type: 'number', value: chordLength }, { type: 'number', value: curveHeight }]
        : [{ type: 'number', value: length }];
    return {
        id,
        from,
        to,
        direction: isCurve ? 'free' : 'right',
        lineType: isCurve ? 'curve' : 'line',
        elements,
        code: isCurve
            ? 'free\ncurve\n' + chordLength.toFixed(3) + '\n' + curveHeight.toFixed(3)
            : 'right\nline\n' + length.toFixed(3),
        length: isCurve ? chordLength : length,
        isClosing: closing,
        isDiagonal: false,
        dimensionVisible: true,
        dimensionRotated: false
    };
}

function _getBoundFigureLineLength(lineData) {
    if (lineData.lineType !== 'curve') return Math.max(0, Number(lineData.length) || 0);
    const values = (lineData.elements || [])
        .filter(function(element) { return element.type === 'number'; })
        .map(function(element) { return Number(element.value); });
    const chord = values[0];
    const height = values[1];
    if (!Number.isFinite(chord) || !Number.isFinite(height) || chord <= 0 || height === 0) {
        return Math.max(0, Number(lineData.length) || 0);
    }
    const radius = (chord * chord + 4 * height * height) / (8 * Math.abs(height));
    const angle = 4 * Math.atan2(2 * Math.abs(height), chord);
    return radius * angle;
}

window._buildLineBoundFigureGeometry = function (parentItem, binding, height) {
    const context = _getLineBoundFigureContext(parentItem, binding.hostLineId);
    if (!context || context.length <= 0) return null;

    const totalLength = context.length / SCALE;
    const width = Math.max(0, Math.min(totalLength, Number(binding.end) - Number(binding.start)));
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;

    const start = Math.max(0, Math.min(Number(binding.start) || 0, totalLength - width));
    const end = start + width;
    binding.start = start;
    binding.end = end;
    binding.offset = Math.max(0, Number(binding.offset) || 0);
    binding.side = binding.side === -1 ? -1 : 1;

    const side = binding.side;
    const offsetPx = binding.offset * SCALE;
    const heightPx = height * SCALE;
    let baseStart, baseEnd, outerEnd, outerStart, baseMid, outerMid;

    if (context.curve) {
        const startDistance = start * SCALE;
        const endDistance = end * SCALE;
        const middle = context.curve.pointAtDistance((startDistance + endDistance) / 2);
        function offsetPoint(distance, amount) {
            const point = context.curve.pointAtDistance(distance);
            return {
                x: point.x + point.px * amount * side,
                y: point.y + point.py * amount * side
            };
        };
        baseStart = offsetPoint(startDistance, offsetPx);
        baseEnd = offsetPoint(endDistance, offsetPx);
        outerEnd = offsetPoint(endDistance, offsetPx + heightPx);
        outerStart = offsetPoint(startDistance, offsetPx + heightPx);
        baseMid = {
            x: middle.x + middle.px * offsetPx * side,
            y: middle.y + middle.py * offsetPx * side
        };
        outerMid = {
            x: middle.x + middle.px * (offsetPx + heightPx) * side,
            y: middle.y + middle.py * (offsetPx + heightPx) * side
        };
    } else {
        const dx = context.x2 - context.x1;
        const dy = context.y2 - context.y1;
        const lineLength = Math.hypot(dx, dy);
        if (lineLength <= 0) return null;
        const ux = dx / lineLength;
        const uy = dy / lineLength;
        const px = uy;
        const py = -ux;
        function pointAt(distance, amount) {
            return {
                x: context.x1 + ux * distance * SCALE + px * amount * side,
                y: context.y1 + uy * distance * SCALE + py * amount * side
            };
        }
        baseStart = pointAt(start, offsetPx);
        baseEnd = pointAt(end, offsetPx);
        outerEnd = pointAt(end, offsetPx + heightPx);
        outerStart = pointAt(start, offsetPx + heightPx);
    }

    const points = [baseStart, baseEnd, outerEnd, outerStart].map(function(point, index) {
        return { x: point.x, y: point.y, num: index + 1 };
    });
    const areaTwice = points.reduce(function(area, point, index) {
        const next = points[(index + 1) % points.length];
        return area + point.x * next.y - next.x * point.y;
    }, 0);
    const outsideSign = areaTwice >= 0 ? -1 : 1;

    function curveHeightFor(startPoint, endPoint, middlePoint) {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        const chord = Math.hypot(dx, dy);
        if (chord <= 0) return 0;
        const sagitta = ((middlePoint.x - (startPoint.x + endPoint.x) / 2) * -dy +
            (middlePoint.y - (startPoint.y + endPoint.y) / 2) * dx) / chord;
        return sagitta / outsideSign / SCALE;
    }

    let baseCurveHeight = null;
    let outerCurveHeight = null;
    let baseChordLength = 0;
    let outerChordLength = 0;
    if (context.curve) {
        baseCurveHeight = curveHeightFor(baseStart, baseEnd, baseMid);
        outerCurveHeight = curveHeightFor(outerEnd, outerStart, outerMid);
        baseChordLength = Math.hypot(baseEnd.x - baseStart.x, baseEnd.y - baseStart.y) / SCALE;
        outerChordLength = Math.hypot(outerStart.x - outerEnd.x, outerStart.y - outerEnd.y) / SCALE;
    }

    const lines = [
        _makeBoundFigureLine(1, 1, 2, width, baseCurveHeight, baseChordLength, false),
        _makeBoundFigureLine(2, 2, 3, height, null, 0, false),
        _makeBoundFigureLine(3, 3, 4, width, outerCurveHeight, outerChordLength, false),
        _makeBoundFigureLine(4, 4, 1, height, null, 0, true)
    ];

    return { points, lines, width, height, transform: context.transform };
}

window._refreshLineBoundFigure = function (childItem, parentItem) {
    const geometry = window._buildLineBoundFigureGeometry(
        parentItem,
        childItem._figureBinding,
        Number(childItem.constructHeight)
    );
    if (!geometry) return false;

    geometry.lines.forEach(function(lineData) {
        const previousLine = (childItem.figureLines || []).find(function(previous) {
            return previous.id === lineData.id;
        });
        if (!previousLine) return;

        if (typeof previousLine.dimensionVisible === 'boolean') {
            lineData.dimensionVisible = previousLine.dimensionVisible;
        }
        if (typeof previousLine.dimensionRotated === 'boolean') {
            lineData.dimensionRotated = previousLine.dimensionRotated;
        }

        const attachedElements = [];
        const elements = previousLine.elements || [];
        for (let index = 0; index < elements.length - 2; index++) {
            if (elements[index]?.type === 'number' &&
                elements[index + 1]?.type === 'number' &&
                elements[index + 2]?.type === 'element') {
                attachedElements.push(
                    JSON.parse(JSON.stringify(elements[index])),
                    JSON.parse(JSON.stringify(elements[index + 1])),
                    JSON.parse(JSON.stringify(elements[index + 2]))
                );
                index += 2;
            }
        }
        lineData.elements.push.apply(lineData.elements, attachedElements);
        const availableLength = _getBoundFigureLineLength(lineData);
        for (let index = 0; index < lineData.elements.length - 2; index++) {
            const start = lineData.elements[index];
            const end = lineData.elements[index + 1];
            const element = lineData.elements[index + 2];
            if (start.type !== 'number' || end.type !== 'number' || element.type !== 'element') continue;
            start.value = Math.max(0, Math.min(availableLength, Number(start.value) || 0));
            end.value = Math.max(start.value, Math.min(availableLength, Number(end.value) || 0));
            if (typeof element.lineLength === 'number') element.lineLength = availableLength;
            index += 2;
        }
        if (typeof _rebuildLineCode === 'function') {
            lineData.code = _rebuildLineCode(lineData.elements, lineData.direction, lineData.lineType);
        }
    });

    childItem.shapePoints = geometry.points;
    childItem.figureLines = geometry.lines;
    childItem.constructWidth = geometry.width;
    childItem.constructHeight = geometry.height;
    childItem._offsetX = 0;
    childItem._offsetY = 0;
    childItem.area = typeof calculateFigureArea === 'function'
        ? calculateFigureArea(geometry.lines, geometry.points).toFixed(1)
        : (geometry.width * geometry.height).toFixed(1);

    if (childItem.svgGroup) {
        if (geometry.transform) childItem.svgGroup.setAttribute('transform', geometry.transform);
        else childItem.svgGroup.removeAttribute('transform');
        const savedLines = G.figureLines;
        const savedPoints = G.shapePoints;
        const savedRoom = G.roomNumber;
        const savedBuilding = G.isBuilding;
        const savedDimensionsOutside = G.dimensionsOutside;
        G.figureLines = JSON.parse(JSON.stringify(geometry.lines));
        G.shapePoints = JSON.parse(JSON.stringify(geometry.points));
        G.roomNumber = childItem.roomNumber || '';
        G.isBuilding = childItem.type === 'building';
        G.dimensionsOutside = childItem.dimensionsOutside === true;
        _rebuildSvgGroup(childItem.svgGroup, 0, 0, childItem);
        G.figureLines = savedLines;
        G.shapePoints = savedPoints;
        G.roomNumber = savedRoom;
        G.isBuilding = savedBuilding;
        G.dimensionsOutside = savedDimensionsOutside;
    }
    return true;
};

/**
 * Рекурсивно перераховує _anchorOnCanvas для всіх дочірніх кімнат
 * після того як батьківська фігура була переміщена/перемальована.
 */
window._refreshChildAnchors = function (parentItem, parentOffsetX, parentOffsetY) {
    // Отримуємо головний SVG полотна для re-append відірваних груп
    const canvas  = window.canvasManager?.canvases.find(c => c.id === window.canvasManager?.activeCanvasId);
    const mainSvg = canvas ? document.querySelector(`[data-canvas-id="${canvas.id}"] svg`) : null;

    (parentItem.children || []).forEach(child => {
        if (child._figureBinding) {
            if (window._refreshLineBoundFigure(child, parentItem)) {
                _refreshChildAnchors(child, child._offsetX || 0, child._offsetY || 0);
            }
            return;
        }

        if (!child._anchorDef) {
            // Немає anchorDef — але є свої діти, рекурсуємо з поточним offsetX/Y дитини
            if (child.children && child.children.length > 0 && child.svgGroup) {
                const co = child._anchorOnCanvas
                    ? { x: child._anchorOnCanvas.x - START_X, y: child._anchorOnCanvas.y - START_Y }
                    : { x: child._offsetX || 0, y: child._offsetY || 0 };
                _refreshChildAnchors(child, co.x, co.y);
            }
            return;
        }

        // Синхронізуємо товщину: якщо батько змінив товщину вікна (_elementThickness),
        // оновлюємо її в anchorDef щоб якір рахувався від нової позиції вікна
        const anchorDef = child._anchorDef;
        const hostLineData = (parentItem.figureLines || []).find(l => l.id === anchorDef.hostLineId);
        if (hostLineData && typeof hostLineData._elementThickness === 'number') {
            anchorDef.thickness = hostLineData._elementThickness;
        }

        const newAnchor = _computeAnchorOnCanvas(
            anchorDef, parentItem, parentOffsetX, parentOffsetY
        );
        if (!newAnchor) return;
        child._anchorOnCanvas = newAnchor;

        if (child.svgGroup) {
            const childOffsetX = newAnchor.x - START_X;
            const childOffsetY = newAnchor.y - START_Y;

            // Якщо SVG-група відірвана від DOM — повертаємо її назад
            if (mainSvg && !mainSvg.contains(child.svgGroup)) {
                mainSvg.appendChild(child.svgGroup);
            }

            const savedLines  = G.figureLines;
            const savedPoints = G.shapePoints;
            G.figureLines = JSON.parse(JSON.stringify(child.figureLines));
            G.shapePoints = JSON.parse(JSON.stringify(child.shapePoints));
            _rebuildSvgGroup(child.svgGroup, childOffsetX, childOffsetY);
            G.figureLines = savedLines;
            G.shapePoints = savedPoints;

            // Рекурсивно оновлюємо глибші рівні
            _refreshChildAnchors(child, childOffsetX, childOffsetY);
        }
    });
};

/**
 * Знаходить батьківський елемент ієрархії для заданого id.
 */
window._findParentInHierarchy = function (childId, items, parent) {
    items = items || G.hierarchyData;
    for (const item of items) {
        if (item.id === childId) return parent || null;
        const found = _findParentInHierarchy(childId, item.children, item);
        if (found !== undefined) return found;
    }
    return undefined;
};

/**
 * Зберігає результат редагування елемента (вікна) на головному полотні:
 * 1. Перемальовує SVG-групу батьківської фігури з оновленою товщиною вікна.
 * 2. Малює лінію прив'язки (якщо задана) у тій самій групі.
 * 3. Якщо є лінія прив'язки — додає «Кімнату» дочірньою до елемента вікна в ієрархії.
 */
window.transferElementResultToMainCanvas = function (src) {
    const { item, hostLine, el } = src;

    // Зберігаємо товщину і прив'язку в lineData батьківської фігури (для _fillSvgGroup і повторного відкриття)
    const hostLineData = item.figureLines.find(l => l.id === hostLine.id);
    if (hostLineData) {
        hostLineData._elementThickness = appState.editingElementThickness;
        hostLineData._elementBinding   = appState.editingElementBinding || null;
    }

    // ── 1. Перемальовуємо групу батьківської фігури ──
    if (item.svgGroup) {
        // Використовуємо збережений offset щоб фігура не зміщувалась
        let offsetX, offsetY;
        if (item._anchorOnCanvas) {
            offsetX = item._anchorOnCanvas.x - START_X;
            offsetY = item._anchorOnCanvas.y - START_Y;
        } else if (item._offsetX !== undefined) {
            offsetX = item._offsetX;
            offsetY = item._offsetY;
        } else {
            // Fallback: обчислюємо від центру A4 (тільки для дуже старих елементів без збереженого offset)
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            item.shapePoints.forEach(p => {
                if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
            });
            const frameCenterX  = A4_OFFSET + A4_WIDTH  / 2;
            const frameCenterY  = A4_OFFSET + A4_HEIGHT / 2;
            const figureCenterX = minX + (maxX - minX) / 2;
            const figureCenterY = minY + (maxY - minY) / 2;
            offsetX = frameCenterX - figureCenterX;
            offsetY = frameCenterY - figureCenterY;
        }

        // Тимчасово підставляємо дані батьківської фігури
        const savedLines  = G.figureLines;
        const savedPoints = G.shapePoints;
        const savedRoom   = G.roomNumber;
        const savedBuild  = G.isBuilding;
        G.figureLines = JSON.parse(JSON.stringify(item.figureLines));
        G.shapePoints = JSON.parse(JSON.stringify(item.shapePoints));
        G.roomNumber  = item.roomNumber || '';
        G.isBuilding  = item.type === 'building';

        _rebuildSvgGroup(item.svgGroup, offsetX, offsetY);

        // Рекурсивно перераховуємо якорі дочірніх кімнат після перемальовування
        _refreshChildAnchors(item, offsetX, offsetY);

        // Якщо item сам є дочірньою — оновлюємо його братів і далі вгору по дереву.
        // Це потрібно щоб при зміні товщини вікна зміщувались і фігури що прив'язані
        // до вікон на глибших рівнях ієрархії.
        (function propagateUp(current) {
            const parentItem = _findParentInHierarchy(current.id);
            if (!parentItem) return; // корінь — нічого більше
            const pOffsetX = parentItem._anchorOnCanvas
                ? parentItem._anchorOnCanvas.x - START_X
                : (parentItem._offsetX || 0);
            const pOffsetY = parentItem._anchorOnCanvas
                ? parentItem._anchorOnCanvas.y - START_Y
                : (parentItem._offsetY || 0);
            _refreshChildAnchors(parentItem, pOffsetX, pOffsetY);
            propagateUp(parentItem);
        })(item);

        // ── 2. Лінія прив'язки на головному полотні ──
        const bp = appState.editingElementBinding;
        if (bp && (bp.corner === 1 || bp.corner === 2) && bp.dist > 0) {
            // Перебудовуємо координати хост-лінії
            _rebuildChainPoints();
            const rebuildPoints = G.shapePoints;
            const fromPt = rebuildPoints.find(p => p.num === hostLine.from);
            const toPt   = hostLine.isClosing ? rebuildPoints[0] : rebuildPoints.find(p => p.num === hostLine.to);

            if (fromPt && toPt) {
                const x1 = fromPt.x + offsetX, y1 = fromPt.y + offsetY;
                const x2 = toPt.x   + offsetX, y2 = toPt.y   + offsetY;

                const dx = x2 - x1, dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                if (len > 0) {
                    const ux = dx / len, uy = dy / len;
                    const px = uy, py = -ux;
                    const side      = el.side || 1;
                    const thickness = appState.editingElementThickness;

                    const wA_x = x1 + ux * el.start * SCALE + px * thickness * SCALE * side;
                    const wA_y = y1 + uy * el.start * SCALE + py * thickness * SCALE * side;
                    const wB_x = x1 + ux * el.end   * SCALE + px * thickness * SCALE * side;
                    const wB_y = y1 + uy * el.end   * SCALE + py * thickness * SCALE * side;

                    const anchorX = bp.corner === 1 ? wA_x : wB_x;
                    const anchorY = bp.corner === 1 ? wA_y : wB_y;
                    const wdx = wB_x - wA_x, wdy = wB_y - wA_y;
                    const wlen = Math.sqrt(wdx * wdx + wdy * wdy);

                    if (wlen > 0) {
                        const sign = bp.corner === 1 ? -1 : 1;
                        const bx = anchorX + sign * wdx / wlen * bp.dist * SCALE;
                        const by = anchorY + sign * wdy / wlen * bp.dist * SCALE;

                        // ── 3. Лінія кімнати в координатах редактора ──
                        const childLen = bp.dist;
                        const vecX = anchorX - bx;
                        const vecY = anchorY - by;
                        const vecLen = Math.sqrt(vecX * vecX + vecY * vecY);
                        let childEndX = START_X, childEndY = START_Y;
                        if (vecLen > 0) {
                            childEndX = START_X + vecX / vecLen * childLen * SCALE;
                            childEndY = START_Y + vecY / vecLen * childLen * SCALE;
                        }

                        const childShapePoints = [
                            { x: START_X,   y: START_Y,   num: 1 },
                            { x: childEndX, y: childEndY, num: 2 }
                        ];
                        const childFigureLines = [{
                            id: 1, from: 1, to: 2,
                            direction: 'free', lineType: 'line',
                            elements: [{ type: 'number', value: childLen }],
                            code: `free\nline\n${childLen.toFixed(2)}`,
                            length: childLen,
                            isClosing: false, isPending: false,
                            dimensionVisible: true, dimensionRotated: false,
                            _cachedEnd: { x: childEndX, y: childEndY }
                        }];

                        const anchorDef = {
                            hostLineId: hostLine.id,
                            elStart:    el.start,
                            elEnd:      el.end,
                            elSide:     el.side || 1,
                            thickness:  appState.editingElementThickness,
                            corner:     bp.corner,
                            dist:       bp.dist
                        };

                        // ── 4. SVG-група дочірньої кімнати ──
                        const canvasEl = window.canvasManager?.canvases.find(
                            c => c.id === window.canvasManager?.activeCanvasId
                        );
                        const mainSvg = canvasEl
                            ? document.querySelector(`[data-canvas-id="${canvasEl.id}"] svg`)
                            : null;

                        const elKey = `el_${hostLine.from}_${hostLine.to ?? 'c'}_${el.code}_${el.start}`;
                        if (!item._elChildren) item._elChildren = {};
                        const existingChildId = item._elChildren[elKey];

                        // childOffsetX/Y: точка 1 редактора → точка bx,by на полотні
                        const childOffsetX = bx - START_X;
                        const childOffsetY = by - START_Y;

                        if (existingChildId) {
                            const existingChild = findHierarchyItemById(existingChildId);
                            if (existingChild) {
                                existingChild.figureLines     = JSON.parse(JSON.stringify(childFigureLines));
                                existingChild.shapePoints     = JSON.parse(JSON.stringify(childShapePoints));
                                existingChild._anchorOnCanvas = { x: bx, y: by };
                                existingChild._anchorDef      = anchorDef;
                                // Перемальовуємо svgGroup дочірньої з новими координатами
                                if (existingChild.svgGroup) {
                                    const savedL = G.figureLines, savedP = G.shapePoints;
                                    G.figureLines = JSON.parse(JSON.stringify(childFigureLines));
                                    G.shapePoints = JSON.parse(JSON.stringify(childShapePoints));
                                    _rebuildSvgGroup(existingChild.svgGroup, childOffsetX, childOffsetY);
                                    // Рекурсивно оновлюємо вкладені якорі з новою товщиною
                                    _refreshChildAnchors(existingChild, childOffsetX, childOffsetY);
                                    G.figureLines = savedL;
                                    G.shapePoints = savedP;
                                }
                                renderHierarchy();
                                // Відновлюємо G до стану батьківської фігури перед виходом
                                G.figureLines = savedLines;
                                G.shapePoints = savedPoints;
                                G.roomNumber  = savedRoom;
                                G.isBuilding  = savedBuild;
                                showToast('Елемент оновлено', 'success');
                                return;
                            }
                        }

                        // Створюємо SVG-групу для дочірньої кімнати
                        let childGroup = null;
                        if (mainSvg) {
                            childGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            childGroup.setAttribute('data-hierarchy-id', G.hierarchyIdCounter);
                            // Малюємо через _fillSvgGroup щоб лінія і розмір були консистентні
                            const savedL = G.figureLines, savedP = G.shapePoints;
                            G.figureLines = JSON.parse(JSON.stringify(childFigureLines));
                            G.shapePoints = JSON.parse(JSON.stringify(childShapePoints));
                            _fillSvgGroup(childGroup, childOffsetX, childOffsetY);
                            G.figureLines = savedL;
                            G.shapePoints = savedP;
                            mainSvg.appendChild(childGroup);
                        }

                        // Додаємо нову дочірню «Кімнату» в ієрархію
                        const childItem = addToHierarchy({
                            isBuilding:  false,
                            name:        'Кімната (прив\'язка)',
                            roomNumber:  '',
                            area:        '',
                            figureLines: childFigureLines,
                            shapePoints: childShapePoints,
                            svgGroup:    childGroup,
                            parentId:    item.id
                        });
                        childItem._anchorOnCanvas = { x: bx, y: by };
                        childItem._anchorDef      = anchorDef;
                        item._elChildren[elKey]   = childItem.id;
                    }
                }
            }
        }

        G.figureLines = savedLines;
        G.shapePoints = savedPoints;
        G.roomNumber  = savedRoom;
        G.isBuilding  = savedBuild;
    }

    showToast('Елемент збережено', 'success');
};
