/**
 * shape-editor.js — Редактор фігур: малювання, перемалювання, площа, free-лінії.
 * Залежності: core-state.js, svg-primitives.js
 */

/* ── Перемикачі ── */
window.toggleDimensionSide = function () {
    G.dimensionsOutside = document.getElementById('dimensionSideCheckbox').checked;
    if (G.figureLines.length > 0) redrawEntireFigure();
};

window.toggleBuildingType = function () {
    G.isBuilding = document.getElementById('buildingTypeCheckbox').checked;
    if (G.figureLines.length > 0) redrawEntireFigure();
};

/* ── Скидання даних фігури ── */
window.resetShapeData = function () {
    G.figureLines     = [];
    G.pendingFreeLines = [];
    G.lineIdCounter   = 1;
    G.pointCounter    = 1;
    appState.calculatedArea         = null;
    appState.customArea             = null;
    appState.editingHierarchyItemId = null;
    G.roomNumber          = '';
    G.roomNumberInputValue = '';
    G.diagonals           = [];

    const svg = document.getElementById('shapeCanvas');
    resetSvgCanvas(svg);
    updateLinesList();
};

/* ── Площа (формула Гаусса) ── */
window.calculateAndDisplayArea = function () {
    if (G.shapePoints.length < 3) return;
    appState.calculatedArea = calculateFigureArea(G.figureLines, G.shapePoints).toFixed(1);
    updateLinesList();
};

window.calculateFigureArea = function (figureLines, shapePoints) {
    let area = 0;
    for (let i = 0; i < shapePoints.length; i++) {
        const j = (i + 1) % shapePoints.length;
        area += shapePoints[i].x * shapePoints[j].y;
        area -= shapePoints[j].x * shapePoints[i].y;
    }
    area = Math.abs(area) / 2 / (SCALE * SCALE);

    for (const line of figureLines) {
        if (line.isDiagonal || !Array.isArray(line.elements)) continue;
        if (line.lineType === 'curve') {
            const height = _getLineCurveHeight(line);
            const chord = Number(line.length);
            if (height !== null && Number.isFinite(chord) && chord > 0 && height !== 0) {
                const radius = (chord * chord + 4 * height * height) / (8 * Math.abs(height));
                const centralAngle = 4 * Math.atan2(2 * Math.abs(height), chord);
                area += Math.sign(height) * radius * radius / 2 *
                    (centralAngle - Math.sin(centralAngle));
            }
        }
        for (let i = 0; i < line.elements.length - 2; i++) {
            const start = line.elements[i];
            const end = line.elements[i + 1];
            const element = line.elements[i + 2];
            if (start.type !== 'number' || end.type !== 'number' ||
                element.type !== 'element' || typeof element.value !== 'string') continue;

            const code = element.value.replace(/^-/, '');
            if (code === 'OT1') {
                const length = Math.abs(Number(end.value) - Number(start.value));
                if (Number.isFinite(length)) area += length * ELEMENT_THICKNESS;
            } else if (code === 'KO1') {
                const length = Math.abs(Number(end.value) - Number(start.value));
                const thickness = Number(element.thickness);
                if (Number.isFinite(length) && Number.isFinite(thickness) && element.ignoreArea !== true) {
                    const isOutside = element.value.startsWith('-');
                    area += length * thickness * (isOutside ? 1 : -1);
                }
            }
            i += 2;
        }
    }

    return Math.max(0, area);
};

window._getLineCurveHeight = function (lineData) {
    const values = (lineData.elements || [])
        .filter(function(element) { return element.type === 'number'; })
        .map(function(element) { return Number(element.value); });
    return values.length > 1 && Number.isFinite(values[1]) ? values[1] : null;
};

/* ── Автомасштабування shapeCanvas ── */
window.autoScaleAndCenterFigure = function () {
    if (G.shapePoints.length < 2) return;
    const svg = document.getElementById('shapeCanvas');
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    G.shapePoints.filter(p => !p.isTemp).forEach(p => {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    });
    if (!isFinite(minX)) return;
    const fw = maxX - minX, fh = maxY - minY;
    const padX = Math.max(fw * 0.25, 80);
    const padY = Math.max(fh * 0.25, 80);
    // Забезпечуємо квадратний мінімум: щоб xMidYMid meet центрував фігуру по обох осях
    const vbW = Math.max(fw + padX * 2, fh + padY * 2);
    const vbH = vbW;
    const cx  = (minX + maxX) / 2;
    const cy  = (minY + maxY) / 2;
    svg.setAttribute('viewBox', `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`);
};

/* ── Номер приміщення в центрі ── */
window.drawRoomNumber = function () {
    if (!G.roomNumber || G.shapePoints.length < 3) return;
    const svg = document.getElementById('shapeCanvas');
    const validPoints = G.shapePoints.filter(p => !p.isTemp);
    let cx = 0, cy = 0;
    validPoints.forEach(p => { cx += p.x; cy += p.y; });
    cx /= validPoints.length; cy /= validPoints.length;
    svg.appendChild(buildRoomNumberText(cx, cy, G.roomNumber));
};

/* ── Розміри на shapeCanvas ── */
window.drawLineDimension = function (x1, y1, x2, y2, lengthInMeters, lineData) {
    if (lineData && lineData.dimensionVisible === false) return;

    const svg = document.getElementById('shapeCanvas');
    const dx  = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const ux = dx / len, uy = dy / len;
    const px = uy, py = -ux;
    const offset = 10;
    const dir    = G.dimensionsOutside ? 1 : -1;
    const textX  = (x1 + x2) / 2 + px * offset * dir;
    const textY  = (y1 + y2) / 2 + py * offset * dir;

    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle > 90)  angle -= 180;
    if (angle < -90) angle += 180;
    if (lineData && lineData.dimensionRotated) angle += 180;

    const numLen  = typeof lengthInMeters === 'number' ? lengthInMeters : parseFloat(lengthInMeters);
    const rounded = Math.round(numLen * 100) / 100;
    svg.appendChild(_makeSvgText(textX, textY, rounded.toFixed(2), angle));
};

/* ── Відносні напрямки ── */
/**
 * Повертає вектор попередньої лінії (від її початку до кінця).
 * Якщо попередньої лінії немає — дефолтний напрямок вправо.
 */
window._getPrevLineVector = function () {
    // Беремо останню не-діагональну, не-pending лінію
    let prevLine = null;
    for (let i = G.figureLines.length - 1; i >= 0; i--) {
        if (!G.figureLines[i].isDiagonal && !G.figureLines[i].isPending) {
            prevLine = G.figureLines[i];
            break;
        }
    }
    if (!prevLine) return { ux: 1, uy: 0 }; // дефолт: вправо

    const fromPt = G.shapePoints.find(function(p) { return p.num === prevLine.from; });
    const toPt   = prevLine.isClosing
        ? G.shapePoints[0]
        : G.shapePoints.find(function(p) { return p.num === prevLine.to; });

    if (!fromPt || !toPt) return { ux: 1, uy: 0 };

    const dx = toPt.x - fromPt.x;
    const dy = toPt.y - fromPt.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { ux: 1, uy: 0 };
    return { ux: dx / len, uy: dy / len };
};

/**
 * Обчислює кінцеву точку лінії відносно попередньої.
 * Напрямки відносні до вектора попередньої лінії:
 *   top    — продовження вперед (0°)
 *   right  — поворот праворуч (90° за годинниковою)
 *   bottom — розворот (180°)
 *   left   — поворот ліворуч (90° проти годинникової)
 */
window._calcRelativeEnd = function (fromX, fromY, direction, scaledLen) {
    // Перевіряємо чи є вже створені лінії (крім діагоналей)
    const hasLines = G.figureLines.some(function(l) { return !l.isDiagonal; });

    let vx, vy;
    if (!hasLines) {
        // Перша лінія: right = горизонталь вправо, left = горизонталь вліво
        vx = direction === 'left' ? -1 : 1;
        vy = 0;
    } else {
        // Наступні лінії: поворот відносно попередньої
        const { ux, uy } = _getPrevLineVector();
        switch (direction) {
            case 'right':  vx = -uy; vy =  ux; break; // праворуч від напрямку (+90° за год. в SVG)
            case 'left':   vx =  uy; vy = -ux; break; // ліворуч від напрямку (-90° проти год. в SVG)
            default:       vx =  ux; vy =  uy; break;
        }
    }

    return {
        x: fromX + vx * scaledLen,
        y: fromY + vy * scaledLen
    };
};

/* ── Малювання лінії на shapeCanvas ── */
window.drawLineOnCanvas = function (parsedData) {
    const svg       = document.getElementById('shapeCanvas');
    const lastPoint = G.shapePoints[G.shapePoints.length - 1];
    const isClosing = appState.isClosingLine || false;
    if (parsedData.lineType === 'curve') {
        const numericElements = parsedData.elements.filter(function(element) { return element.type === 'number'; });
        if (numericElements.length < 2 || !Number.isFinite(Number(numericElements[1].value))) {
            showToast('Для дуги вкажіть основу та висоту окремими числами', 'warning');
            return;
        }
    }

    if (parsedData.direction === 'free') {
        const lineLength = parsedData.lineLength ?? parsedData.elements.find(el => el.type === 'number')?.value ?? 0;

        if (!isClosing) {
            const lineData = _makeLineData(G.lineIdCounter, lastPoint.num, null, parsedData, lineLength, false, true);
            G.pendingFreeLines.push(lineData);
            G.figureLines.push(lineData);
            G.lineIdCounter++;

            G.pointCounter++;
            G.shapePoints.push({ x: lastPoint.x, y: lastPoint.y, num: G.pointCounter, isTemp: true });

            updateLinesList();
            showToast('Лінію з невідомим кутом збережено. Додайте замикаючу для розрахунку.', 'info');
            return;
        }

        if (G.pendingFreeLines.length === 0) {
            parsedData.direction = 'direct-closing';
        } else {
            const lineData = _makeLineData(G.lineIdCounter, lastPoint.num, 1, parsedData, lineLength, true, true);
            G.pendingFreeLines.push(lineData);
            G.figureLines.push(lineData);
            G.lineIdCounter++;
            appState.isClosingLine = false;
            calculateFreeAngleFigure();
            return;
        }
    }

    let endX = lastPoint.x, endY = lastPoint.y;
    let lineLength = 0;

    const lengthElements = parsedData.lineType === 'curve'
        ? parsedData.elements
        : parsedData.elements.slice().reverse();
    if (Number.isFinite(parsedData.lineLength)) {
        lineLength = parsedData.lineLength;
    } else {
        for (let i = 0; i < lengthElements.length; i++) {
            if (lengthElements[i].type === 'number') {
                lineLength = parseFloat(lengthElements[i].value);
                break;
            }
        }
    }

    if (isClosing) {
        endX = G.shapePoints[0].x;
        endY = G.shapePoints[0].y;
    } else {
        const scaledLen = lineLength * SCALE;
        const rel = _calcRelativeEnd(lastPoint.x, lastPoint.y, parsedData.direction, scaledLen);
        endX = rel.x; endY = rel.y;
    }

    if (parsedData.lineType === 'curve') {
        const numericElements = parsedData.elements.filter(function(element) { return element.type === 'number'; });
        const height = Number(numericElements[1]?.value);
        _renderSvgCurve(svg, lastPoint.x, lastPoint.y, endX, endY, height * SCALE,
            G.lineIdCounter, G.shapePoints.concat({ x: endX, y: endY }));
    } else {
        _renderSvgLine(svg, lastPoint.x, lastPoint.y, endX, endY, G.lineIdCounter);
    }
    if (isClosing && typeof _renderClosingDirectionArrow === 'function') {
        _renderClosingDirectionArrow(svg, lastPoint.x, lastPoint.y, endX, endY,
            parsedData.lineType === 'curve'
                ? { lineType: 'curve', elements: parsedData.elements }
                : { lineType: 'line' },
            G.shapePoints.concat({ x: endX, y: endY }));
    }
    drawLineDimension(lastPoint.x, lastPoint.y, endX, endY, lineLength, null);
    drawElementsOnLine(parsedData, lastPoint.x, lastPoint.y, endX, endY, SCALE, null, undefined,
        G.shapePoints.concat({ x: endX, y: endY }));

    let targetPointNum;
    if (isClosing) {
        targetPointNum = 1;
        appState.isClosingLine = false;
    } else {
        G.pointCounter++;
        G.shapePoints.push({ x: endX, y: endY, num: G.pointCounter });
        targetPointNum = G.pointCounter;
        _renderSvgPoint(svg, endX, endY, G.pointCounter);
    }

    const lineData = _makeLineData(G.lineIdCounter, lastPoint.num, targetPointNum, parsedData, lineLength, isClosing, false);
    G.figureLines.push(lineData);
    updateLinesList();
    if (isClosing) calculateAndDisplayArea();
    G.lineIdCounter++;
    autoScaleAndCenterFigure();
};

window._makeLineData = function (id, from, to, parsedData, length, isClosing, isPending) {
    return {
        id, from, to,
        direction:        parsedData.direction,
        lineType:         parsedData.lineType,
        elements:         parsedData.elements,
        code:             document.getElementById('coordInput').value,
        length:           parseFloat(length),
        isClosing,
        isPending,
        quadrant:         parsedData.quadrant || null,
        dimensionVisible: true,
        dimensionRotated: false
    };
};

/* ── Видалення лінії та всіх наступних ── */
/**
 * Видаляє лінію з даним id і всі лінії, що були створені після неї
 * (включно з діагоналями, що посилаються на точки видалених ліній).
 */
window.deleteLineAndFollowing = function (lineId) {
    const idx = G.figureLines.findIndex(function(l) { return l.id === lineId; });
    if (idx === -1) { showToast('Лінію не знайдено', 'error'); return; }

    const deletedLine = G.figureLines[idx];

    // Звичайна лінія видаляє також усі наступні лінії; діагональ і замикання — лише себе.
    const toDelete = new Set(
        deletedLine.isDiagonal || deletedLine.isClosing
            ? [lineId]
            : G.figureLines.slice(idx).map(function(line) { return line.id; })
    );

    G.figureLines = G.figureLines.filter(function(l) { return !toDelete.has(l.id); });

    // Скидаємо pointCounter
    let maxPt = 1;
    G.figureLines.forEach(function(l) {
        if (!l.isDiagonal && !l.isClosing && l.to) maxPt = Math.max(maxPt, l.to);
    });
    G.pointCounter = maxPt;

    appState.calculatedArea = null;
    appState.customArea     = null;

    if (G.figureLines.length === 0) {
        const svg = document.getElementById('shapeCanvas');
        resetSvgCanvas(svg);
        updateLinesList();
        return;
    }

    redrawEntireFigure();
    showToast('Лінію видалено', 'info');
};

/* ── Редагування лінії ── */
window.editLine = function (line) {
    // Діагональ — відкриваємо модалку діагоналі з поточною довжиною
    if (line.isDiagonal) {
        document.getElementById('diagonalModal').style.display = 'block';
        document.getElementById('diagonalInput').value = line.from + ' ' + line.to + ' ' + line.length;
        const pts = G.shapePoints.map(function(p) { return p.num; }).join(', ');
        document.getElementById('diagonalPointsHint').textContent = 'Наявні точки: ' + pts;
        setTimeout(function() { document.getElementById('diagonalInput').focus(); }, 100);
        return;
    }

    document.getElementById('coordModal').style.display = 'block';
    document.getElementById('coordInput').value = line.code;
    appState.editingLineId = line.id;
    setTimeout(() => document.getElementById('coordInput').focus(), 100);
};

window.updateExistingLine = function (lineId, parsedData) {
    const idx = G.figureLines.findIndex(function(l) { return l.id === lineId; });
    if (idx === -1) { showToast('Лінію не знайдено', 'error'); return; }
    if (_trySplitFreeLine(idx)) return;

    const lengthElements = parsedData.lineType === 'curve'
        ? parsedData.elements
        : parsedData.elements.slice().reverse();
    let newLength = 0;
    if (Number.isFinite(parsedData.lineLength)) {
        newLength = parsedData.lineLength;
    } else {
        for (let i = 0; i < lengthElements.length; i++) {
            if (lengthElements[i].type === 'number') { newLength = lengthElements[i].value; break; }
        }
    }
    if (parsedData.lineType === 'curve') {
        const numericElements = parsedData.elements.filter(function(element) { return element.type === 'number'; });
        const height = Number(numericElements[1]?.value);
        if (numericElements.length < 2 || !Number.isFinite(height)) {
            showToast('Для дуги вкажіть основу та висоту окремими числами', 'warning');
            return;
        }
    }

    if (!G.figureLines[idx].isDiagonal && newLength <= 0) {
        showToast('Довжина лінії не може бути нульовою або від\'ємною', 'warning');
        return;
    }

    // Якщо лінія має _cachedEnd (зафіксована діагоналлю) — завжди зберігаємо direction='free'
    // і перемасштабовуємо _cachedEnd незалежно від того що ввів користувач у direction.
    // Це запобігає «прокручуванню» лінії при додаванні WI1 або зміні довжини.
    const lineToEdit = G.figureLines[idx];
    const previousChimney = (lineToEdit.elements || []).find(function(element) {
        return element.type === 'element' && String(element.value).replace(/^-/, '') === 'KO1';
    });
    const editedChimney = (parsedData.elements || []).find(function(element) {
        return element.type === 'element' && String(element.value).replace(/^-/, '') === 'KO1';
    });
    if (previousChimney && editedChimney) {
        editedChimney.fill = previousChimney.fill || '#ff0000';
        editedChimney.ignoreArea = previousChimney.ignoreArea === true;
        editedChimney.reverseReference = previousChimney.reverseReference === true;
    }
    if (parsedData.direction === 'free' && !lineToEdit._cachedEnd && !lineToEdit.isClosing) {
        const fromPt = G.shapePoints.find(function(point) { return point.num === lineToEdit.from; });
        const toPt = G.shapePoints.find(function(point) { return point.num === lineToEdit.to; });
        if (fromPt && toPt && !fromPt.isTemp && !toPt.isTemp) {
            lineToEdit._cachedEnd = { x: toPt.x, y: toPt.y };
            lineToEdit.direction = 'free';
        }
    }
    const hasCachedEnd = !!lineToEdit._cachedEnd;
    if (hasCachedEnd) {
        // Зберігаємо direction=free, оновлюємо лише elements/code/length
        G.figureLines[idx].lineType  = parsedData.lineType;
        G.figureLines[idx].elements  = parsedData.elements;
        G.figureLines[idx].code      = document.getElementById('coordInput').value;
        G.figureLines[idx].length    = newLength;
        // Перемасштабовуємо _cachedEnd на нову довжину зі збереженням напрямку
        _rebuildChainPoints();
        const fromPt = G.shapePoints.find(function(p) { return p.num === G.figureLines[idx].from; });
        if (fromPt) {
            const oldEnd = G.figureLines[idx]._cachedEnd;
            const dx = oldEnd.x - fromPt.x;
            const dy = oldEnd.y - fromPt.y;
            const oldLen = Math.sqrt(dx * dx + dy * dy);
            if (oldLen > 0) {
                G.figureLines[idx]._cachedEnd = {
                    x: fromPt.x + dx / oldLen * newLength * SCALE,
                    y: fromPt.y + dy / oldLen * newLength * SCALE
                };
            }
        }
    } else {
        G.figureLines[idx].direction = parsedData.direction;
        G.figureLines[idx].lineType  = parsedData.lineType;
        G.figureLines[idx].elements  = parsedData.elements;
        G.figureLines[idx].code      = document.getElementById('coordInput').value;
        G.figureLines[idx].length    = newLength;
    }

    // Якщо це діагональ — оновлюємо позицію кінцевої точки
    if (G.figureLines[idx].isDiagonal && newLength > 0) {
        _applyDiagonalConstraint(G.figureLines[idx].from, G.figureLines[idx].to, newLength);
        return;
    }

    redrawEntireFigure();
};

function _trySplitFreeLine(lineIndex) {
    const text = document.getElementById('coordInput').value.replace(/\r/g, '');
    const rows = text.split('\n');
    while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
    if (rows.length < 3 || rows[0].trim().toLowerCase() !== 'free' ||
        rows[1].trim().toLowerCase() !== 'line') return false;

    const entries = rows.slice(2).map(function(value) { return value.trim(); });
    const blankCount = entries.filter(function(value) { return value === ''; }).length;
    const isLength = function(value) { return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value); };
    if (blankCount === 0 && (entries.length < 2 || entries.some(function(value) { return !isLength(value); }))) {
        return false;
    }

    const lineData = G.figureLines[lineIndex];
    if (lineData.direction !== 'free') {
        showToast('Розділяти можна лише лінію з напрямком free', 'warning');
        return true;
    }
    if (lineData.lineType !== 'line') {
        showToast('Спочатку змініть дугу на лінію, потім поділіть її', 'warning');
        return true;
    }
    if (blankCount > 1) {
        showToast('Для залишку можна використати лише один порожній рядок', 'warning');
        return true;
    }
    if (blankCount === 1 && (entries[0] === '' || entries[entries.length - 1] === '')) {
        showToast('Порожній рядок для залишку має бути між довжинами відрізків', 'warning');
        return true;
    }
    if (lineData.isClosing || lineData.isPending ||
        G.pendingFreeLines.some(function(line) { return line.id === lineData.id; })) {
        showToast('Спочатку зафіксуйте напрямок лінії, замкнувши фігуру', 'warning');
        return true;
    }

    const specifiedLengths = entries.filter(function(value) { return value !== ''; })
        .map(function(value) { return window.normalizeMeasurement(value); });
    if (specifiedLengths.length === 0 || specifiedLengths.some(function(value) {
        return !Number.isFinite(value) || value <= 0;
    })) {
        showToast('Довжини відрізків мають бути додатними числами', 'warning');
        return true;
    }

    const totalLength = Number(lineData.length);
    const specifiedTotal = specifiedLengths.reduce(function(sum, value) { return sum + value; }, 0);
    if (!Number.isFinite(totalLength) || totalLength <= 0 || specifiedTotal > totalLength + 0.005) {
        showToast('Сума довжин перевищує довжину старої лінії', 'warning');
        return true;
    }

    const remainder = window.normalizeMeasurement(totalLength - specifiedTotal);
    const segmentLengths = entries.includes('')
        ? entries.map(function(value) {
            return value === '' ? remainder : window.normalizeMeasurement(value);
        })
        : specifiedLengths.slice();
    if (!entries.includes('') && remainder >= 0.01) segmentLengths.push(remainder);
    if (entries.includes('') && remainder <= 0) {
        showToast('Для порожнього рядка має залишатися додатна довжина', 'warning');
        return true;
    }
    if (segmentLengths.length < 2 || segmentLengths.some(function(value) { return value <= 0; })) {
        showToast('Потрібно вказати щонайменше два відрізки', 'warning');
        return true;
    }

    const fromPoint = G.shapePoints.find(function(point) { return point.num === lineData.from; });
    const toPoint = G.shapePoints.find(function(point) { return point.num === lineData.to; });
    if (!fromPoint || !toPoint || fromPoint.isTemp || toPoint.isTemp) {
        showToast('Не вдалося визначити напрямок старої лінії', 'warning');
        return true;
    }
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;
    const geometricLength = Math.hypot(dx, dy) / SCALE;
    if (geometricLength <= 0 || Math.abs(geometricLength - totalLength) > 0.02) {
        showToast('Напрямок або довжина старої лінії ще не зафіксовані', 'warning');
        return true;
    }

    const hasLineElements = (lineData.elements || []).some(function(element, index, elements) {
        return element.type === 'number' && elements[index + 1]?.type === 'number' &&
            elements[index + 2]?.type === 'element';
    });
    if (hasLineElements) {
        showToast('Спочатку видаліть елементи, прикріплені до старої лінії', 'warning');
        return true;
    }

    const parentItem = appState.editingHierarchyItemId != null
        ? findHierarchyItemById(appState.editingHierarchyItemId)
        : null;
    function hasAnchoredChild(item) {
        return (item.children || []).some(function(child) {
            return child._anchorDef?.hostLineId === lineData.id || hasAnchoredChild(child);
        });
    }
    if (parentItem && hasAnchoredChild(parentItem)) {
        showToast('До старої лінії прив’язані інші фігури — спочатку відв’яжіть їх', 'warning');
        return true;
    }

    const oldEndPointNum = lineData.to;
    const extraPoints = segmentLengths.length - 1;
    const ux = dx / (geometricLength * SCALE);
    const uy = dy / (geometricLength * SCALE);
    let distance = 0;
    const newSegments = segmentLengths.map(function(length, index) {
        distance += length * SCALE;
        const endX = index === segmentLengths.length - 1
            ? toPoint.x : fromPoint.x + ux * distance;
        const endY = index === segmentLengths.length - 1
            ? toPoint.y : fromPoint.y + uy * distance;
        const normalizedLength = window.normalizeMeasurement(length);
        const elements = [{ type: 'number', value: normalizedLength }];
        const segment = {
            ...lineData,
            id: index === 0 ? lineData.id : G.lineIdCounter++,
            from: null,
            to: null,
            direction: 'free',
            lineType: 'line',
            elements,
            code: `free\nline\n${normalizedLength.toFixed(2)}`,
            length: normalizedLength,
            isClosing: false,
            isPending: false,
            _cachedEnd: { x: endX, y: endY }
        };
        return segment;
    });

    G.figureLines.splice(lineIndex, 1, ...newSegments);
    G.figureLines.forEach(function(line) {
        if (!line.isDiagonal) return;
        if (line.from >= oldEndPointNum) line.from += extraPoints;
        if (line.to >= oldEndPointNum) line.to += extraPoints;
    });
    (G.diagonals || []).forEach(function(diagonal) {
        if (diagonal.pt1 >= oldEndPointNum) diagonal.pt1 += extraPoints;
        if (diagonal.pt2 >= oldEndPointNum) diagonal.pt2 += extraPoints;
    });

    _rebuildChainPoints();
    redrawEntireFigure();
    showToast('Лінію поділено на відрізки', 'success');
    return true;
}


/* ── Перемалювання всієї фігури ── */
window.redrawEntireFigure = function () {
    const svg = document.getElementById('shapeCanvas');
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    _rebuildChainPoints();
    renderStartPoint(svg);

    G.figureLines.forEach(function(lineData) {
        const fromPt = G.shapePoints.find(function(p) { return p.num === lineData.from; });
        const toPt   = lineData.isClosing
            ? G.shapePoints[0]
            : G.shapePoints.find(function(p) { return p.num === lineData.to; });
        if (!fromPt || !toPt) return;

        if (lineData.isDiagonal) {
            if (typeof _renderSvgDashedLine === 'function') {
                _renderSvgDashedLine(svg, fromPt.x, fromPt.y, toPt.x, toPt.y, lineData.id);
            } else {
                if (lineData.lineType === 'curve' && typeof _getLineCurveHeight(lineData) === 'number') {
                    _renderSvgCurve(svg, fromPt.x, fromPt.y, toPt.x, toPt.y,
                        _getLineCurveHeight(lineData) * SCALE, lineData.id, G.shapePoints);
                } else {
                    _renderSvgLine(svg, fromPt.x, fromPt.y, toPt.x, toPt.y, lineData.id);
                }
            }
            drawLineDimension(fromPt.x, fromPt.y, toPt.x, toPt.y, lineData.length, lineData);
        } else {
            if (lineData.lineType === 'curve' && typeof _getLineCurveHeight(lineData) === 'number') {
                _renderSvgCurve(svg, fromPt.x, fromPt.y, toPt.x, toPt.y,
                    _getLineCurveHeight(lineData) * SCALE, lineData.id, G.shapePoints);
            } else {
                _renderSvgLine(svg, fromPt.x, fromPt.y, toPt.x, toPt.y, lineData.id);
            }
            if (lineData.isClosing && typeof _renderClosingDirectionArrow === 'function') {
                _renderClosingDirectionArrow(svg, fromPt.x, fromPt.y, toPt.x, toPt.y,
                    lineData, G.shapePoints);
            }
            drawLineDimension(fromPt.x, fromPt.y, toPt.x, toPt.y, lineData.length, lineData);
            drawElementsOnLine(lineData, fromPt.x, fromPt.y, toPt.x, toPt.y, SCALE, null, undefined, G.shapePoints);
            if (!lineData.isClosing) {
                _renderSvgPoint(svg, toPt.x, toPt.y, toPt.num);
            }
        }
    });

    G.pointCounter = G.shapePoints.length;
    if (G.figureLines.some(function(l) { return l.isClosing && !l.isDiagonal; })) {
        calculateAndDisplayArea();
    }
    updateLinesList();
    autoScaleAndCenterFigure();
    drawRoomNumber();
};

/**
 * Перебудовує G.shapePoints ланцюговим методом.
 * Точка 1 = START_X/START_Y. Кожна наступна = кінець попередньої не-діагональної лінії.
 * Замикаюча лінія завжди йде до точки 1.
 * Діагоналі пов'язують наявні точки — нових не додають.
 */
window._rebuildChainPoints = function () {
    G.shapePoints = [{ x: START_X, y: START_Y, num: 1 }];
    let currentPointNum = 1;
    let prevUx = 1, prevUy = 0; // дефолтний вектор
    let isFirstLine = true;     // прапорець першої лінії

    G.figureLines.forEach(function(lineData, index) {
        if (lineData.isDiagonal) return;
        if (lineData.isClosing)  return;

        const lastPt    = G.shapePoints[G.shapePoints.length - 1];
        let endX = lastPt.x, endY = lastPt.y;
        const scaledLen = lineData.length * SCALE;

        if (lineData.isPending) {
            currentPointNum++;
            G.shapePoints.push({ x: lastPt.x, y: lastPt.y, num: currentPointNum, isTemp: true });
            G.figureLines[index].from = lastPt.num;
            G.figureLines[index].to   = currentPointNum;
            return;
        }

        if (lineData.direction === 'free' && lineData._cachedEnd) {
            endX = lineData._cachedEnd.x;
            endY = lineData._cachedEnd.y;
        } else if (lineData.direction === 'free') {
            endX = lastPt.x; endY = lastPt.y;
        } else {
            let vx, vy;
            if (isFirstLine) {
                // Перша лінія: right = вправо, left = вліво (абсолютно горизонтально)
                vx = lineData.direction === 'left' ? -1 : 1;
                vy = 0;
            } else {
                // Наступні: поворот відносно попередньої
                switch (lineData.direction) {
                    case 'right':  vx = -prevUy; vy =  prevUx; break; // праворуч від напрямку
                    case 'left':   vx =  prevUy; vy = -prevUx; break; // ліворуч від напрямку
                    default:       vx =  prevUx; vy =  prevUy; break;
                }
            }
            endX = lastPt.x + vx * scaledLen;
            endY = lastPt.y + vy * scaledLen;
        }

        currentPointNum++;
        G.shapePoints.push({ x: endX, y: endY, num: currentPointNum });
        G.figureLines[index].from = lastPt.num;
        G.figureLines[index].to   = currentPointNum;

        // Оновлюємо вектор і скидаємо прапорець першої лінії
        const dx = endX - lastPt.x, dy = endY - lastPt.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) { prevUx = dx / len; prevUy = dy / len; }
        isFirstLine = false;
    });

    G.pointCounter = currentPointNum;

    G.figureLines.forEach(function(lineData, index) {
        if (!lineData.isClosing || lineData.isDiagonal) return;
        const lastNonDiag = G.shapePoints[G.shapePoints.length - 1];
        G.figureLines[index].from = lastNonDiag.num;
        G.figureLines[index].to   = 1;
        _updateClosingLineLength(index);
    });
};

/** Оновлює довжину замикаючої лінії за реальними координатами */
window._updateClosingLineLength = function (closingIdx) {
    const cl     = G.figureLines[closingIdx];
    const fromPt = G.shapePoints.find(function(p) { return p.num === cl.from; });
    if (!fromPt) return;
    const toPt   = G.shapePoints[0];
    const realLen = window.normalizeMeasurement(
        Math.sqrt(Math.pow(toPt.x - fromPt.x, 2) + Math.pow(toPt.y - fromPt.y, 2)) / SCALE
    );
    G.figureLines[closingIdx].length = realLen;
    for (let i = G.figureLines[closingIdx].elements.length - 1; i >= 0; i--) {
        if (G.figureLines[closingIdx].elements[i].type === 'number') {
            G.figureLines[closingIdx].elements[i].value = realLen;
            break;
        }
    }
};
/* ── Розрахунок free-ліній (теорема косинусів) ── */
window._calcFreeLineEnd = function (currentPoint, firstPoint, lineData, closingLine) {
    const a = lineData.length    * SCALE;
    const c = closingLine.length * SCALE;
    const dx = currentPoint.x - firstPoint.x;
    const dy = currentPoint.y - firstPoint.y;
    const b  = Math.sqrt(dx * dx + dy * dy);

    const cosAngle  = (a * a + b * b - c * c) / (2 * a * b);
    const angle     = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const baseAngle = Math.atan2(firstPoint.y - currentPoint.y, firstPoint.x - currentPoint.x);

    let finalAngle;
    switch (lineData.quadrant) {
        case 'bottom': finalAngle = baseAngle - angle; break;
        case 'right':  finalAngle = baseAngle - angle; break;
        default:       finalAngle = baseAngle + angle; break;
    }

    return {
        x: currentPoint.x + Math.cos(finalAngle) * a,
        y: currentPoint.y + Math.sin(finalAngle) * a
    };
};

window.calculateFreeAngleFigure = function () {
    if (G.pendingFreeLines.length === 0) {
        showToast('Немає ліній з невідомим кутом', 'warning'); return;
    }

    const closingLineData = G.pendingFreeLines.find(l => l.isClosing);
    if (!closingLineData) { showToast('Не знайдено замикаючу лінію', 'error'); return; }

    const closingLength = closingLineData.elements.find(e => e.type === 'number')?.value || 0;

    let currentPoint = null;
    for (let i = G.shapePoints.length - 1; i >= 0; i--) {
        if (!G.shapePoints[i].isTemp) { currentPoint = G.shapePoints[i]; break; }
    }
    if (!currentPoint) { showToast('Не знайдено початкову точку', 'error'); return; }

    const firstPoint = G.shapePoints[0];

    const processPendingLine = (pendingLine) => {
        const lineData   = { ...pendingLine, length: pendingLine.length };
        const closingRef = { length: closingLength };
        const { x: endX, y: endY } = _calcFreeLineEnd(currentPoint, firstPoint, lineData, closingRef);

        const tempIdx = G.shapePoints.findIndex(p => p.isTemp);
        if (tempIdx !== -1) {
            G.shapePoints[tempIdx].x      = endX;
            G.shapePoints[tempIdx].y      = endY;
            G.shapePoints[tempIdx].isTemp = false;
        }

        pendingLine._cachedEnd = { x: endX, y: endY };
        pendingLine.isPending = false;
        pendingLine.to        = G.shapePoints[tempIdx]?.num || 2;
        return { endX, endY, tempIdx };
    };

    if (G.pendingFreeLines.length === 1) {
        const pendingLine = G.pendingFreeLines[0];
        processPendingLine(pendingLine);

        G.pendingFreeLines = [];

        const lineData = _makeLineData(
            G.lineIdCounter++,
            pendingLine.to, 1,
            { direction: closingLineData.direction, lineType: closingLineData.lineType, elements: closingLineData.elements, quadrant: null },
            closingLength, true, false
        );
        G.figureLines.push(lineData);

        appState.isClosingLine = false;
        redrawEntireFigure();
        showToast('Фігуру розраховано успішно!', 'success');

    } else if (G.pendingFreeLines.length === 2) {
        const regularLine = G.pendingFreeLines.find(l => !l.isClosing);
        const closingFree = G.pendingFreeLines.find(l =>  l.isClosing);
        if (!regularLine || !closingFree) {
            showToast('Помилка: не знайдено потрібні лінії', 'error'); return;
        }

        const { tempIdx } = processPendingLine(regularLine);

        closingFree.isPending = false;
        closingFree.from      = G.shapePoints[tempIdx]?.num || 2;
        closingFree.to        = 1;

        G.pendingFreeLines = [];
        appState.isClosingLine = false;
        redrawEntireFigure();
        showToast('Трикутник розраховано успішно!', 'success');

    } else {
        showToast('Розрахунок для більше ніж двох free-ліній поки не підтримується', 'warning');
    }
};


/* ── Застосування діагонального обмеження ── */
/**
 * Встановлює відстань між точками pt1Num і pt2Num = diagDist.
 * Точка pt1Num і всі лінії до неї — фіксовані.
 * Рухається точка pt2Num: знаходимо лінію що закінчується в pt2Num (лінія X→pt2),
 * і змінюємо її direction='free' + _cachedEnd так, щоб pt2 виявилась на відстані diagDist від pt1.
 * Довжина лінії X→pt2 зберігається (не змінюється).
 * Між pt1Num і pt2Num додається штрихова діагональна лінія.
 */
window._applyDiagonalConstraint = function (pt1Num, pt2Num, diagDist) {
    // Спочатку синхронізуємо G.shapePoints з поточним станом G.figureLines
    _rebuildChainPoints();

    // Якщо перше число більше другого — міняємо місцями (діагональ симетрична)
    if (pt1Num > pt2Num) { const tmp = pt1Num; pt1Num = pt2Num; pt2Num = tmp; }

    let lineIdx = G.figureLines.findIndex(function(l) {
        return !l.isDiagonal && !l.isClosing && l.to === pt2Num;
    });
    if (lineIdx === -1) {
        showToast('Лінія що веде до точки ' + pt2Num + ' не знайдена', 'error');
        return;
    }

    // Координата pt1 (фіксована — звідси вимірюємо діагональ)
    const p1 = G.shapePoints.find(function(p) { return p.num === pt1Num; });
    if (!p1) { showToast('Точку ' + pt1Num + ' не знайдено', 'error'); return; }

    // Початок лінії X→pt2 (фіксований, бо лежить до pt2 у ланцюгу)
    const lineFromNum = G.figureLines[lineIdx].from;
    const pFrom = G.shapePoints.find(function(p) { return p.num === lineFromNum; });
    if (!pFrom) { showToast('Початкову точку лінії не знайдено', 'error'); return; }

    // Довжина лінії X→pt2 (зберігаємо)
    const lineLen = G.figureLines[lineIdx].length * SCALE;  // px
    const diagPx  = diagDist * SCALE;                        // px

    // Відстань від p1 до pFrom (відома, фіксована)
    const dx_pf = pFrom.x - p1.x;
    const dy_pf = pFrom.y - p1.y;
    const distP1toFrom = Math.sqrt(dx_pf * dx_pf + dy_pf * dy_pf);

    // Нам треба знайти точку pt2_new таку що:
    //   |pFrom → pt2_new| = lineLen
    //   |p1    → pt2_new| = diagPx
    //
    // Це перетин двох кіл: коло C1(pFrom, lineLen) і коло C2(p1, diagPx).
    // Розв'язуємо систему.

    const d = Math.sqrt(Math.pow(pFrom.x - p1.x, 2) + Math.pow(pFrom.y - p1.y, 2));

    if (d === 0) {
        showToast('Точки pt1 і початок лінії збігаються', 'error');
        return;
    }
    if (d > lineLen + diagPx) {
        showToast('Відстань між точками завелика — кола не перетинаються', 'error');
        return;
    }
    if (d < Math.abs(lineLen - diagPx)) {
        showToast('Одне коло всередині іншого — перетин неможливий', 'error');
        return;
    }

    // Знаходимо точку перетину двох кіл
    // a = (lineLen² - diagPx² + d²) / (2d)
    const a = (lineLen * lineLen - diagPx * diagPx + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, lineLen * lineLen - a * a));

    // Одиничний вектор pFrom → p1
    const ux = (p1.x - pFrom.x) / d;
    const uy = (p1.y - pFrom.y) / d;

    // Перпендикуляр
    const px = -uy, py = ux;

    // Два варіанти перетину
    const midX = pFrom.x + a * ux;
    const midY = pFrom.y + a * uy;
    const pt2a = { x: midX + h * px, y: midY + h * py };
    const pt2b = { x: midX - h * px, y: midY - h * py };

    // Вибираємо варіант ближчий до поточної позиції pt2
    const currentPt2 = G.shapePoints.find(function(p) { return p.num === pt2Num; });
    let newPt2;
    if (currentPt2) {
        const da = Math.hypot(pt2a.x - currentPt2.x, pt2a.y - currentPt2.y);
        const db = Math.hypot(pt2b.x - currentPt2.x, pt2b.y - currentPt2.y);
        newPt2 = da <= db ? pt2a : pt2b;
    } else {
        newPt2 = pt2a;
    }

    // Зберігаємо стару позицію pt2 до оновлення (потрібна для rigid-body rotation)
    const pt2Idx = G.shapePoints.findIndex(function(p) { return p.num === pt2Num; });
    const _savedOldPt2X = pt2Idx !== -1 ? G.shapePoints[pt2Idx].x : newPt2.x;
    const _savedOldPt2Y = pt2Idx !== -1 ? G.shapePoints[pt2Idx].y : newPt2.y;

    // Оновлюємо лінію X→pt2: direction=free, _cachedEnd = нова позиція pt2
    G.figureLines[lineIdx].direction  = 'free';
    G.figureLines[lineIdx]._cachedEnd = { x: newPt2.x, y: newPt2.y };

    // Оновлюємо G.shapePoints[pt2] на нову позицію
    if (pt2Idx !== -1) {
        G.shapePoints[pt2Idx].x = newPt2.x;
        G.shapePoints[pt2Idx].y = newPt2.y;
    }

    // Знаходимо індекс pt1 у G.shapePoints
    const pt1Idx = G.shapePoints.findIndex(function(p) { return p.num === pt1Num; });
    const pt2ShapeIdx = pt2Idx;
    const pt1ShapeIdx = pt1Idx;

    if (pt2ShapeIdx !== -1 && pt1ShapeIdx !== -1 && pt2ShapeIdx < pt1ShapeIdx) {
        // Між pt2 і pt1 є проміжні точки — повертаємо підланцюг як жорстке тіло.
        // Кут повороту = різниця кутів вектора (oldPt2→pt1) і (newPt2→pt1).
        const oldPt1 = G.shapePoints[pt1ShapeIdx]; // pt1 не змінюється
        const rotAngleOld = Math.atan2(oldPt1.y - _savedOldPt2Y, oldPt1.x - _savedOldPt2X);
        const rotAngleNew = Math.atan2(oldPt1.y - newPt2.y,      oldPt1.x - newPt2.x);
        const rotDelta = rotAngleNew - rotAngleOld;
        const cosA = Math.cos(rotDelta), sinA = Math.sin(rotDelta);

        // Повертаємо всі точки між pt2 (не вкл) і pt1 (не вкл)
        for (let i = lineIdx + 1; i < G.figureLines.length; i++) {
            const l = G.figureLines[i];
            if (l.isDiagonal || l.isClosing || l.isPending) continue;
            if (l.from === pt1Num || l.to === pt1Num) break;

            const toPt = G.shapePoints.find(function(p) { return p.num === l.to; });
            if (!toPt) continue;
            // Повертаємо toPt навколо _savedOldPt2 на rotDelta, потім зміщуємо на (newPt2 - _savedOldPt2)
            const relX = toPt.x - _savedOldPt2X;
            const relY = toPt.y - _savedOldPt2Y;
            const newX = newPt2.x + relX * cosA - relY * sinA;
            const newY = newPt2.y + relX * sinA + relY * cosA;
            toPt.x = newX; toPt.y = newY;
            l.direction  = 'free';
            l._cachedEnd = { x: newX, y: newY };
        }
        // Лінія що веде ДО pt1 — фіксуємо _cachedEnd = стара позиція pt1 (незмінна)
        for (let i = lineIdx + 1; i < G.figureLines.length; i++) {
            const l = G.figureLines[i];
            if (l.isDiagonal || l.isPending) continue;
            if (l.to === pt1Num) {
                l.direction  = 'free';
                l._cachedEnd = { x: oldPt1.x, y: oldPt1.y };
                break;
            }
        }
        // Лінії після pt1 — фіксуємо у поточних позиціях G.shapePoints
        let pastPt1 = false;
        for (let i = 0; i < G.figureLines.length; i++) {
            const l = G.figureLines[i];
            if (l.isDiagonal || l.isClosing || l.isPending) continue;
            if (l.from === pt1Num) pastPt1 = true;
            if (!pastPt1) continue;
            const toPt = G.shapePoints.find(function(p) { return p.num === l.to; });
            if (!toPt) continue;
            l.direction  = 'free';
            l._cachedEnd = { x: toPt.x, y: toPt.y };
        }
    } else {
        // pt2 пізніша за pt1 або немає проміжних точок:
        // тягнемо всі лінії після pt2 паралельно (зі збереженням напрямку)
        let prevX = newPt2.x, prevY = newPt2.y;
        for (let i = lineIdx + 1; i < G.figureLines.length; i++) {
            const l = G.figureLines[i];
            if (l.isDiagonal || l.isClosing || l.isPending) continue;

            const toPt   = G.shapePoints.find(function(p) { return p.num === l.to; });
            if (!toPt) continue;
            const fromPt = G.shapePoints.find(function(p) { return p.num === l.from; });
            if (!fromPt) continue;

            const oldDx = toPt.x - fromPt.x;
            const oldDy = toPt.y - fromPt.y;
            const oldLen = Math.sqrt(oldDx * oldDx + oldDy * oldDy);

            let newEndX, newEndY;
            if (oldLen > 0) {
                newEndX = prevX + (oldDx / oldLen) * l.length * SCALE;
                newEndY = prevY + (oldDy / oldLen) * l.length * SCALE;
            } else {
                newEndX = prevX + l.length * SCALE;
                newEndY = prevY;
            }

            l.direction  = 'free';
            l._cachedEnd = { x: newEndX, y: newEndY };

            const endPtIdx = G.shapePoints.findIndex(function(p) { return p.num === l.to; });
            if (endPtIdx !== -1) {
                G.shapePoints[endPtIdx].x = newEndX;
                G.shapePoints[endPtIdx].y = newEndY;
            }
            prevX = newEndX; prevY = newEndY;
        }
    }
    // Зберігаємо/оновлюємо діагональну (штрихову) лінію pt1↔pt2 в G.figureLines
    const existDiagIdx = G.figureLines.findIndex(function(l) {
        return l.isDiagonal &&
               ((l.from === pt1Num && l.to === pt2Num) ||
                (l.from === pt2Num && l.to === pt1Num));
    });
    const diagLineData = {
        id:               existDiagIdx !== -1 ? G.figureLines[existDiagIdx].id : G.lineIdCounter++,
        from:             pt1Num,
        to:               pt2Num,
        isDiagonal:       true,
        isClosing:        false,
        isPending:        false,
        direction:        'free',
        lineType:         'line',
        length:           diagDist,
        elements:         [{ type: 'number', value: diagDist }],
        code:             'diagonal\nline\n' + diagDist,
        dimensionVisible: true,
        dimensionRotated: false,
        _cachedEnd:       null
    };
    if (existDiagIdx !== -1) {
        G.figureLines[existDiagIdx] = diagLineData;
    } else {
        G.figureLines.push(diagLineData);
    }

    redrawEntireFigure();
    showToast('Діагональ ' + pt1Num + '-' + pt2Num + ' = ' + diagDist + ' м застосовано', 'success');
};

/* ── Відкриття елемента (WI1 тощо) у редакторі фігур — ВИМКНЕНО ── */
window.openElementInShapeEditor = function (item, hostLine, el) {
    showToast('Редагування елементів вікна вимкнено у цій версії', 'info');
};

window._openElementInShapeEditorLegacy = function (item, hostLine, el) {
    appState.editingHierarchyItemId = null;
    appState.viewingElementMode = true;            // прапорець «режим елемента» (не звичайний редактор)
    appState.viewingElementSource = { item, hostLine, el };
    appState.editingElementThickness = typeof hostLine._elementThickness === 'number'
        ? hostLine._elementThickness
        : (typeof el.thickness === 'number' ? el.thickness : ELEMENT_THICKNESS);
    appState.editingElementBinding   = hostLine._elementBinding || el.binding || null;

    // Скидаємо окремий масив ліній для цього режиму
    G.elementEditorLines   = [];   // лінії що малюються кнопкою «Додати»
    G.elementEditorPoints  = [];   // їх точки (починаючи з точки 1 = START_X, START_Y)
    G.elementEditorCounter = 1;

    // Завантажуємо фігуру для перерахунку координат хоста
    const figureLines = JSON.parse(JSON.stringify(item.figureLines));
    const shapePoints = JSON.parse(JSON.stringify(item.shapePoints));

    // Перебудовуємо координати
    const savedLines  = G.figureLines;
    const savedPoints = G.shapePoints;
    G.figureLines = figureLines;
    G.shapePoints = shapePoints;
    _rebuildChainPoints();
    const rebuildPoints = G.shapePoints;
    G.figureLines = savedLines;
    G.shapePoints = savedPoints;

    // Знаходимо точки лінії-хоста
    const fromPt = rebuildPoints.find(p => p.num === hostLine.from);
    const toPt   = hostLine.isClosing ? rebuildPoints[0] : rebuildPoints.find(p => p.num === hostLine.to);

    if (!fromPt || !toPt) {
        showToast('Не вдалося знайти координати лінії елемента', 'error');
        appState.viewingElementMode = false;
        return;
    }

    // Зберігаємо координати хоста для подальшого малювання
    appState.viewingElementTransform = { x1: fromPt.x, y1: fromPt.y, x2: toPt.x, y2: toPt.y };

    // Відкриваємо модалку
    document.getElementById('shapeModal').style.display = 'block';

    // Оновлюємо тулбар (показуємо інфо + кнопку товщини, ховаємо зайві кнопки)
    if (typeof _updateShapeModalToolbar === 'function') _updateShapeModalToolbar();

    _redrawElementEditorCanvas();
    updateLinesList();
};

window._redrawElementEditorCanvas = function () {
    if (!appState.viewingElementMode || !appState.viewingElementTransform) return;

    const svg = document.getElementById('shapeCanvas');
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const { x1, y1, x2, y2 } = appState.viewingElementTransform;
    const { hostLine, el } = appState.viewingElementSource;
    const thickness = appState.editingElementThickness;

    // Вектор вздовж лінії-хоста
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    const ux = dx / len, uy = dy / len;
    const px = uy, py = -ux;   // перпендикуляр

    const elStartPx = el.start * SCALE;
    const elEndPx   = el.end   * SCALE;
    const side      = el.side || 1;

    // Кути вікна на протилежному боці (A = початок, B = кінець)
    const wA_x = x1 + ux * elStartPx + px * thickness * SCALE * side;
    const wA_y = y1 + uy * elStartPx + py * thickness * SCALE * side;
    const wB_x = x1 + ux * elEndPx   + px * thickness * SCALE * side;
    const wB_y = y1 + uy * elEndPx   + py * thickness * SCALE * side;

    // Зберігаємо координати кутів для A/B прив'язки
    appState.viewingElementTransform.wA = { x: wA_x, y: wA_y };
    appState.viewingElementTransform.wB = { x: wB_x, y: wB_y };

    // Малюємо лінію-хост
    _renderSvgLine(svg, x1, y1, x2, y2);
    drawLineDimension(x1, y1, x2, y2, hostLine.length, hostLine);

    // Малюємо вікно (елемент на лінії)
    drawElementsOnLine(hostLine, x1, y1, x2, y2, SCALE, svg, thickness);

    // Малюємо протилежну сторону вікна (штрихова)
    _renderSvgDashedLine(svg, wA_x, wA_y, wB_x, wB_y);

    // Мітки кутів 1 і 2
    _renderWindowCornerLabel(svg, wA_x, wA_y, '1');
    _renderWindowCornerLabel(svg, wB_x, wB_y, '2');

    // Розмір вікна над штриховою лінією
    const winLen = (el.end - el.start).toFixed(2);
    const midWx  = (wA_x + wB_x) / 2;
    const midWy  = (wA_y + wB_y) / 2;
    const wAngle = Math.atan2(dy, dx) * 180 / Math.PI;
    svg.appendChild(_makeSvgText(midWx + px * 14 * side, midWy + py * 14 * side, winLen + 'м', wAngle));

    // Реальні номери точок хост-лінії
    const fromNum = hostLine.from;
    const toNum   = hostLine.isClosing
        ? (appState.viewingElementSource.item.shapePoints[0]?.num ?? 1)
        : hostLine.to;

    // Ініціалізуємо elementEditorPoints двома реальними точками хост-лінії
    if (!G.elementEditorPoints || G.elementEditorPoints.length === 0) {
        G.elementEditorPoints  = [
            { x: x1, y: y1, num: fromNum },
            { x: x2, y: y2, num: toNum }
        ];
        G.elementEditorCounter = toNum;
    } else {
        // Оновлюємо координати (якщо товщина змінилась — кути зрушились)
        G.elementEditorPoints[0] = { x: x1, y: y1, num: fromNum };
        if (G.elementEditorPoints.length < 2) {
            G.elementEditorPoints.push({ x: x2, y: y2, num: toNum });
        } else {
            G.elementEditorPoints[1] = { x: x2, y: y2, num: toNum };
        }
    }

    // Малюємо точки хост-лінії з їхніми реальними номерами
    _renderSvgPoint(svg, x1, y1, fromNum);
    _renderSvgPoint(svg, x2, y2, toNum);

    // Малюємо лінію прив'язки (якщо задана)
    const bp = appState.editingElementBinding;
    if (bp && (bp.corner === 1 || bp.corner === 2) && bp.dist > 0) {
        // Опорна точка вікна: corner=1 => wA, corner=2 => wB
        const anchorX = bp.corner === 1 ? wA_x : wB_x;
        const anchorY = bp.corner === 1 ? wA_y : wB_y;
        // Напрямок уздовж лінії вікна (wA → wB)
        const wdx = wB_x - wA_x, wdy = wB_y - wA_y;
        const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
        let bx, by;
        if (wlen > 0) {
            // corner=1 (anchor=wA): нова точка протилежна до 2 → напрямок геть від wB = wA-wB = (-wdx,-wdy)
            // corner=2 (anchor=wB): нова точка протилежна до 1 → напрямок геть від wA = wB-wA = (wdx,wdy)
            const sign = bp.corner === 1 ? -1 : 1;
            const wux = sign * wdx / wlen;
            const wuy = sign * wdy / wlen;
            bx = anchorX + wux * bp.dist * SCALE;
            by = anchorY + wuy * bp.dist * SCALE;
        } else {
            bx = anchorX;
            by = anchorY;
        }
        // Малюємо лінію від anchor до нової точки
        _renderSvgLine(svg, anchorX, anchorY, bx, by);
        // Розмір лінії прив'язки
        drawLineDimension(anchorX, anchorY, bx, by, bp.dist, { dimensionVisible: true, dimensionRotated: false });
        // Крапка нової точки (без номера — просто маркер)
        const bCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bCircle.setAttribute('cx', bx); bCircle.setAttribute('cy', by);
        bCircle.setAttribute('r', '5'); bCircle.setAttribute('fill', '#FF9800');
        svg.appendChild(bCircle);
        // Додаємо координати нової точки до allX/allY через збереження в тимчасову змінну
        appState._bindingPoint = { x: bx, y: by };
    } else {
        appState._bindingPoint = null;
    }

    // Малюємо додані лінії
    if (G.elementEditorLines && G.elementEditorLines.length > 0) {
        const pts = G.elementEditorPoints;
        G.elementEditorLines.forEach(function (eLine) {
            const fPt = pts.find(p => p.num === eLine.from);
            const tPt = pts.find(p => p.num === eLine.to);
            if (!fPt || !tPt) return;
            _renderSvgLine(svg, fPt.x, fPt.y, tPt.x, tPt.y);
            drawLineDimension(fPt.x, fPt.y, tPt.x, tPt.y, eLine.length, eLine);
            _renderSvgPoint(svg, tPt.x, tPt.y, tPt.num);
        });
    }

    // viewBox — тільки навколо хост-лінії, вікна і доданих точок
    const allX = [x1, x2, wA_x, wB_x];
    const allY = [y1, y2, wA_y, wB_y];
    if (appState._bindingPoint) {
        allX.push(appState._bindingPoint.x);
        allY.push(appState._bindingPoint.y);
    }
    if (G.elementEditorLines && G.elementEditorLines.length > 0) {
        G.elementEditorPoints.forEach(p => { allX.push(p.x); allY.push(p.y); });
    }
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const fw = maxX - minX, fh = maxY - minY;
    const pad = Math.max(fw * 0.25, fh * 0.25, 60);
    const vbSz = Math.max(fw, fh) + pad * 2;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    svg.setAttribute('viewBox', `${cx - vbSz / 2} ${cy - vbSz / 2} ${vbSz} ${vbSz}`);
};

/** Малює мітку кута вікна (A або B) */
window._renderWindowCornerLabel = function (svg, x, y, label) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y);
    circle.setAttribute('r', '5'); circle.setAttribute('fill', '#9C27B0');
    svg.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x + 10); text.setAttribute('y', y - 5);
    text.setAttribute('font-size', '14'); text.setAttribute('fill', '#9C27B0');
    text.setAttribute('font-weight', 'bold');
    text.textContent = label;
    svg.appendChild(text);
};

/**
 * Додає нову лінію до G.elementEditorLines на основі parsedData.
 * Перша лінія виходить із точки START_X, START_Y.
 * Напрямок обчислюється за тим самим алгоритмом що і у звичайному редакторі,
 * але відносно попередньої лінії в elementEditorLines.
 */
window._addLineToElementEditor = function (parsedData) {
    if (!G.elementEditorPoints || G.elementEditorPoints.length === 0) {
        const tr = appState.viewingElementTransform;
        const hl = appState.viewingElementSource?.hostLine;
        const fromNum = hl ? hl.from : 1;
        const toNum   = hl ? (hl.isClosing
            ? (appState.viewingElementSource?.item?.shapePoints[0]?.num ?? 1)
            : hl.to) : 2;
        const x1 = tr ? tr.x1 : START_X;
        const y1 = tr ? tr.y1 : START_Y;
        const x2 = tr ? tr.x2 : START_X + SCALE;
        const y2 = tr ? tr.y2 : START_Y;
        G.elementEditorPoints  = [
            { x: x1, y: y1, num: fromNum },
            { x: x2, y: y2, num: toNum }
        ];
        G.elementEditorLines   = [];
        G.elementEditorCounter = toNum;
    }

    let lineLength = 0;
    for (let i = parsedData.elements.length - 1; i >= 0; i--) {
        if (parsedData.elements[i].type === 'number') {
            lineLength = parsedData.elements[i].value;
            break;
        }
    }

    if (lineLength <= 0) {
        showToast('Довжина лінії має бути більше нуля', 'warning');
        return;
    }

    const lastPt    = G.elementEditorPoints[G.elementEditorPoints.length - 1];
    const scaledLen = lineLength * SCALE;

    // Обчислення напрямку відносно попередньої лінії елемента
    let vx, vy;
    const hasLines = G.elementEditorLines.length > 0;

    if (!hasLines) {
        vx = parsedData.direction === 'left' ? -1 : 1;
        vy = 0;
    } else {
        const prevEl = G.elementEditorLines[G.elementEditorLines.length - 1];
        const prevFrom = G.elementEditorPoints.find(p => p.num === prevEl.from);
        const prevTo   = G.elementEditorPoints.find(p => p.num === prevEl.to);
        let prevUx = 1, prevUy = 0;
        if (prevFrom && prevTo) {
            const pdx = prevTo.x - prevFrom.x, pdy = prevTo.y - prevFrom.y;
            const plen = Math.sqrt(pdx * pdx + pdy * pdy);
            if (plen > 0) { prevUx = pdx / plen; prevUy = pdy / plen; }
        }
        switch (parsedData.direction) {
            case 'right':  vx = -prevUy; vy =  prevUx; break;
            case 'left':   vx =  prevUy; vy = -prevUx; break;
            default:       vx =  prevUx; vy =  prevUy; break;
        }
    }

    const endX = lastPt.x + vx * scaledLen;
    const endY = lastPt.y + vy * scaledLen;

    G.elementEditorCounter++;
    const newPtNum = G.elementEditorCounter;
    G.elementEditorPoints.push({ x: endX, y: endY, num: newPtNum });

    G.elementEditorLines.push({
        id:               G.elementEditorLines.length + 1,
        from:             lastPt.num,
        to:               newPtNum,
        direction:        parsedData.direction,
        lineType:         parsedData.lineType,
        elements:         parsedData.elements,
        length:           lineLength,
        dimensionVisible: true,
        dimensionRotated: false
    });

    _redrawElementEditorCanvas();
    updateLinesList();
    showToast('Лінію додано', 'success');
};

window._drawShapeLine = function (x1, y1, x2, y2, length, isClosing, lineData) {
    const svg = document.getElementById('shapeCanvas');
    _renderSvgLine(svg, x1, y1, x2, y2);
    if (isClosing && typeof _renderClosingDirectionArrow === 'function') {
        _renderClosingDirectionArrow(svg, x1, y1, x2, y2, lineData, G.shapePoints);
    }
    const numLen = typeof length === 'number' ? length : parseFloat(length);
    drawLineDimension(x1, y1, x2, y2, numLen, lineData);
    if (!isClosing) _renderSvgPoint(svg, x2, y2, G.pointCounter + 1);
};

/* ── Швидкі фігури (об'єднано з quick-shape.js) ── */
window.openQuickShapeModal = function () {
    document.getElementById('quickShapeModal').style.display = 'block';

    document.querySelectorAll('input[name="shapeType"]').forEach(radio => {
        radio.addEventListener('change', function () {
            const label = document.getElementById('quickDimensionsLabel');
            if (this.value === 'rectangle') {
                label.textContent = 'Розміри (ширина висота через пробіл):';
                document.getElementById('quickDimensionsInput').placeholder = '3.5 4.2';
            } else {
                label.textContent = 'Розміри (сторона1 сторона2 сторона3 через пробіл):';
                document.getElementById('quickDimensionsInput').placeholder = '3.5 4.2 5.0';
            }
        });
    });

    setTimeout(() => document.getElementById('quickDimensionsInput').focus(), 100);
};

window.closeQuickShapeModal = function () {
    document.getElementById('quickShapeModal').style.display = 'none';
    document.getElementById('quickDimensionsInput').value = '';
};

window.createQuickShape = function () {
    const shapeType = document.querySelector('input[name="shapeType"]:checked').value;
    const rawInput  = document.getElementById('quickDimensionsInput').value.trim();

    if (!rawInput) { showToast('Введіть розміри фігури', 'warning'); return; }

    const dims = rawInput.split(/\s+/).map(d => {
        const n = window.normalizeMeasurement(d);
        return Number.isFinite(n) ? n : null;
    }).filter(d => d !== null);

    if (shapeType === 'rectangle') {
        if (dims.length < 2) { showToast('Для прямокутника потрібно 2 розміри', 'warning'); return; }
        createRectangle(dims[0], dims[1]);
    } else if (shapeType === 'triangle') {
        if (dims.length < 3) { showToast('Для трикутника потрібно 3 розміри', 'warning'); return; }
        createTriangle(dims[0], dims[1], dims[2]);
    }

    closeQuickShapeModal();
};

function _resetShapeState() {
    G.figureLines = [];
    G.pendingFreeLines = [];
    G.lineIdCounter = 1;
    G.pointCounter = 1;
    appState.calculatedArea = null;
    appState.customArea = null;

    resetSvgCanvas(document.getElementById('shapeCanvas'));
}

window.createRectangle = function (width, height) {
    _resetShapeState();

    const points = [
        { x: START_X, y: START_Y, dir: 'right', len: width, closing: false },
        { x: START_X + width * SCALE, y: START_Y, dir: 'bottom', len: height, closing: false },
        { x: START_X + width * SCALE, y: START_Y + height * SCALE, dir: 'left', len: width, closing: false },
        { x: START_X, y: START_Y + height * SCALE, dir: 'top', len: height, closing: true }
    ];

    const lineDataMeta = { dimensionVisible: true, dimensionRotated: false };

    points.forEach((pt, idx) => {
        const from = G.shapePoints[G.shapePoints.length - 1];
        const toX = idx < 3 ? points[idx + 1]?.x ?? START_X : START_X;
        const toY = idx < 3 ? points[idx + 1]?.y ?? START_Y : START_Y;

        _drawShapeLine(from.x, from.y, toX, toY, pt.len, pt.closing, lineDataMeta);

        if (!pt.closing) {
            G.pointCounter++;
            G.shapePoints.push({ x: toX, y: toY, num: G.pointCounter });
        }

        G.figureLines.push({
            id: G.lineIdCounter++, from: from.num, to: pt.closing ? 1 : G.pointCounter,
            direction: 'free', lineType: 'line',
            elements: [{ type: 'number', value: parseFloat(pt.len) }],
            code: 'free\nline\n' + parseFloat(pt.len).toFixed(2),
            length: parseFloat(pt.len), isClosing: pt.closing, isPending: false,
            dimensionVisible: true, dimensionRotated: false,
            _cachedEnd: pt.closing ? null : { x: toX, y: toY }
        });
    });

    calculateAndDisplayArea();
    updateLinesList();
    autoScaleAndCenterFigure();
};

window.createTriangle = function (side1, side2, side3) {
    if (side1 + side2 <= side3 || side1 + side3 <= side2 || side2 + side3 <= side1) {
        showToast('Неможливо створити трикутник (порушена нерівність трикутника)', 'error'); return;
    }

    _resetShapeState();

    const from1 = G.shapePoints[0];
    const endX2 = START_X + side1 * SCALE;
    const endY2 = START_Y;
    const lineDataMeta = { dimensionVisible: true, dimensionRotated: false };

    _drawShapeLine(from1.x, from1.y, endX2, endY2, side1, false, lineDataMeta);
    G.pointCounter++;
    G.shapePoints.push({ x: endX2, y: endY2, num: G.pointCounter });
    G.figureLines.push({
        id: G.lineIdCounter++, from: 1, to: 2, direction: 'free', lineType: 'line',
        elements: [{ type: 'number', value: parseFloat(side1) }],
        code: 'free\nline\n' + parseFloat(side1).toFixed(2),
        length: parseFloat(side1), isClosing: false, isPending: false,
        dimensionVisible: true, dimensionRotated: false,
        _cachedEnd: { x: endX2, y: endY2 }
    });

    const cosAngle = (side1 ** 2 + side2 ** 2 - side3 ** 2) / (2 * side1 * side2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
    const endX3 = endX2 + Math.cos(angle) * side2 * SCALE;
    const endY3 = endY2 + Math.sin(angle) * side2 * SCALE;

    const from2 = G.shapePoints[1];
    _drawShapeLine(from2.x, from2.y, endX3, endY3, side2, false, lineDataMeta);
    G.pointCounter++;
    G.shapePoints.push({ x: endX3, y: endY3, num: G.pointCounter });
    G.figureLines.push({
        id: G.lineIdCounter++, from: 2, to: 3, direction: 'free', lineType: 'line',
        elements: [{ type: 'number', value: parseFloat(side2) }],
        code: 'free\nline\n' + parseFloat(side2).toFixed(2),
        length: parseFloat(side2), isClosing: false, isPending: false, quadrant: 'bottom',
        dimensionVisible: true, dimensionRotated: false,
        _cachedEnd: { x: endX3, y: endY3 }
    });

    _drawShapeLine(endX3, endY3, START_X, START_Y, side3, true, lineDataMeta);
    G.figureLines.push({
        id: G.lineIdCounter++, from: 3, to: 1, direction: 'free', lineType: 'line',
        elements: [{ type: 'number', value: parseFloat(side3) }],
        code: 'free\nline\n' + parseFloat(side3).toFixed(2),
        length: parseFloat(side3), isClosing: true, isPending: false,
        dimensionVisible: true, dimensionRotated: false,
        _cachedEnd: null
    });

    calculateAndDisplayArea();
    updateLinesList();
    autoScaleAndCenterFigure();
};

/* ── Модалки координат (об'єднано з coord-modal.js) ── */
window.addPoint = function () {
    document.getElementById('coordInput').value = '';
    document.getElementById('coordModal').style.display = 'block';
    appState.editingLineId = null;
    setTimeout(() => document.getElementById('coordInput').focus(), 100);
};

window.closeShape = function () {
    if (G.shapePoints.length < 2) {
        showToast('Недостатньо точок для замикання фігури', 'warning'); return;
    }
    const lastPoint = G.shapePoints[G.shapePoints.length - 1];
    const firstPoint = G.shapePoints[0];
    const dx = firstPoint.x - lastPoint.x;
    const dy = firstPoint.y - lastPoint.y;
    const distMeters = (Math.sqrt(dx * dx + dy * dy) / SCALE).toFixed(2);

    document.getElementById('coordInput').value = `free\nline\n${distMeters}`;
    document.getElementById('coordModal').style.display = 'block';
    appState.isClosingLine = true;
    appState.editingLineId = null;

    setTimeout(() => {
        const inp = document.getElementById('coordInput');
        inp.focus();
        inp.setSelectionRange(0, 0);
    }, 100);
};

window.addDiagonal = function () {
    if (G.shapePoints.length < 2) {
        showToast('Для діагоналі потрібно мінімум 2 точки', 'warning');
        return;
    }
    document.getElementById('diagonalModal').style.display = 'block';
    document.getElementById('diagonalInput').value = '';
    const pts = G.shapePoints.map(p => p.num).join(', ');
    document.getElementById('diagonalPointsHint').textContent = 'Наявні точки: ' + pts;
    setTimeout(() => document.getElementById('diagonalInput').focus(), 100);
};

window.closeDiagonalModal = function () {
    document.getElementById('diagonalModal').style.display = 'none';
    document.getElementById('diagonalInput').value = '';
};

window.applyDiagonal = function () {
    const parts = document.getElementById('diagonalInput').value.trim().split(/[\s;]+/);
    if (parts.length < 3) {
        showToast('Формат: <точка1> <точка2> <відстань>  наприклад: 1 3 4,52', 'warning');
        return;
    }
    const pt1Num = parseInt(parts[0]);
    const pt2Num = parseInt(parts[1]);
    const dist = window.normalizeMeasurement(parts[2]);

    if (isNaN(pt1Num) || isNaN(pt2Num) || isNaN(dist) || dist <= 0) {
        showToast('Невірний формат. Приклад: 1 3 4,52', 'error');
        return;
    }
    if (pt1Num === pt2Num) {
        showToast('Точки мають бути різними', 'warning');
        return;
    }

    const p1 = G.shapePoints.find(p => p.num === pt1Num);
    const p2 = G.shapePoints.find(p => p.num === pt2Num);
    if (!p1 || !p2) {
        showToast('Точки ' + pt1Num + ' або ' + pt2Num + ' не знайдено', 'error');
        return;
    }

    if (!G.diagonals) G.diagonals = [];
    const existIdx = G.diagonals.findIndex(d =>
        (d.pt1 === pt1Num && d.pt2 === pt2Num) ||
        (d.pt1 === pt2Num && d.pt2 === pt1Num)
    );
    const diagEntry = { pt1: pt1Num, pt2: pt2Num, dist };
    if (existIdx !== -1) G.diagonals[existIdx] = diagEntry;
    else G.diagonals.push(diagEntry);

    try {
        _applyDiagonalConstraint(pt1Num, pt2Num, dist);
    } finally {
        closeDiagonalModal();
    }
};

window.closeCoordModal = function () {
    const modal = document.getElementById('coordModal');
    const inputEl = document.getElementById('coordInput');
    const inputText = inputEl ? inputEl.value.trim() : '';

    try {
        if (inputText) {
            const parsedData = parseCoordinateInput(inputText);
            if (parsedData) {
                if (appState.editingLineId) {
                    updateExistingLine(appState.editingLineId, parsedData);
                    appState.editingLineId = null;
                } else {
                    drawLineOnCanvas(parsedData);
                }
            }
        } else if (appState.editingLineId) {
            deleteLineAndFollowing(appState.editingLineId);
            appState.editingLineId = null;
            appState.isClosingLine = false;
        } else {
            appState.isClosingLine = false;
        }
    } catch (err) {
        console.error('closeCoordModal error:', err);
        showToast('Помилка: ' + err.message, 'error');
        appState.editingLineId = null;
        appState.isClosingLine = false;
    } finally {
        if (modal) modal.style.display = 'none';
        if (inputEl) inputEl.value = '';
    }
};

window.cancelCoordModal = function () {
    appState.editingLineId = null;
    appState.isClosingLine = false;
    document.getElementById('coordModal').style.display = 'none';
    document.getElementById('coordInput').value = '';
};

window.submitCoords = function () { closeCoordModal(); };

window.setAngle = function (direction) {
    G.currentAngle = direction;
    _insertIntoCoordInput(direction);
};

window.setLineType = function (type) {
    G.currentLineType = type;
    const codeMap = { line: 'line', arc: 'curve' };
    _insertIntoCoordInput(codeMap[type]);
};

window.selectElement = function (code) {
    G.selectedElement = code;
    const coordInput = document.getElementById('coordInput');
    const cursorPos = coordInput.selectionStart;
    const textBefore = coordInput.value.substring(0, cursorPos);
    const textAfter = coordInput.value.substring(cursorPos);
    const lastChar = textBefore.slice(-1);
    const prefix = (textBefore && !textBefore.endsWith('\n') && lastChar !== '-' && isNaN(lastChar)) ? '\n' : '';
    const newText = textBefore + prefix + code + '\n';
    coordInput.value = newText + textAfter;
    coordInput.setSelectionRange(newText.length, newText.length);
    coordInput.focus();
};

function _insertIntoCoordInput(code) {
    const coordInput = document.getElementById('coordInput');
    const cursorPos = coordInput.selectionStart;
    const textBefore = coordInput.value.substring(0, cursorPos);
    const textAfter = coordInput.value.substring(cursorPos);
    const newText = textBefore + (textBefore && !textBefore.endsWith('\n') ? '\n' : '') + code + '\n';
    coordInput.value = newText + textAfter;
    coordInput.setSelectionRange(newText.length, newText.length);
    coordInput.focus();
}

window.parseCoordinateInput = function (inputText) {
    const lines = inputText.trim().split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
        showToast('Введіть принаймні напрямок та тип лінії', 'warning');
        return null;
    }

    const direction = lines[0].toLowerCase();
    if (!['left', 'right', 'free', 'diagonal'].includes(direction)) {
        showToast('Невірний напрямок. Використовуйте: right, left', 'error');
        return null;
    }

    const startIndex = 1;
    if (lines.length < startIndex + 1) {
        showToast('Введіть тип лінії', 'warning');
        return null;
    }

    const lineType = lines[startIndex].toLowerCase();
    if (!['line', 'curve'].includes(lineType)) {
        showToast('Невірний тип лінії. Використовуйте: line, curve', 'error');
        return null;
    }

    const elements = [];
    const chimneyIndex = lines.findIndex((line, index) =>
        index > startIndex && line.replace(/^-/, '') === 'KO1'
    );
    if (chimneyIndex !== -1) {
        const parseNumber = value => {
            const number = window.normalizeMeasurement(value);
            return Number.isFinite(number) ? number : null;
        };
        const numbersBefore = lines.slice(startIndex + 1, chimneyIndex).map(parseNumber);
        const numbersAfter = lines.slice(chimneyIndex + 1).map(parseNumber);
        const isOutside = lines[chimneyIndex].startsWith('-');
        let lineLength, start, end, thickness, offset, trailingStart;

        if (lineType === 'line' && numbersBefore.length === 0) {
            if (numbersAfter.length < 5 || numbersAfter.slice(0, 5).some(value => value === null)) {
                showToast('Формат KO1: початок, кінець, товщина, відступ, довжина лінії', 'warning');
                return null;
            }
            [start, end, thickness, offset, lineLength] = numbersAfter;
            if (start < 0 || end < start || end > lineLength ||
                thickness <= 0 || offset < 0 || lineLength <= 0) {
                showToast('KO1: початок і кінець мають бути в межах лінії; товщина має бути більшою за 0', 'warning');
                return null;
            }
            trailingStart = chimneyIndex + 6;
            elements.push(
                { type: 'number', value: lineLength },
                { type: 'number', value: start },
                { type: 'number', value: end },
                { type: 'element', value: isOutside ? '-KO1' : 'KO1', thickness, offset, placement: isOutside ? 'outside' : 'inside', lineLength }
            );
        } else {
            const requiredBefore = lineType === 'curve' ? 2 : 1;
            const requiredAfter = 4;
            if (numbersBefore.length < requiredBefore ||
                numbersBefore.slice(0, requiredBefore).some(value => value === null) ||
                numbersAfter.length < requiredAfter ||
                numbersAfter.slice(0, requiredAfter).some(value => value === null)) {
                showToast('Невірні параметри KO1', 'warning');
                return null;
            }
            elements.push(...numbersBefore.slice(0, requiredBefore).map(value => ({ type: 'number', value })));
            lineLength = numbersBefore[0];
            [start, end, thickness, offset] = numbersAfter;
            trailingStart = chimneyIndex + 5;
            elements.push(
                { type: 'number', value: start },
                { type: 'number', value: end },
                { type: 'element', value: isOutside ? '-KO1' : 'KO1', thickness, offset,
                    placement: isOutside ? 'outside' : 'inside', lineLength: numbersBefore[0] }
            );
        }
        for (let i = trailingStart; i < lines.length; i++) {
            const number = parseNumber(lines[i]);
            elements.push(number === null
                ? { type: 'element', value: lines[i] }
                : { type: 'number', value: number });
        }
        return { direction, lineType, elements, lineLength };
    }

    for (let i = startIndex + 1; i < lines.length; i++) {
        const numValue = window.normalizeMeasurement(lines[i]);
        elements.push(!isNaN(numValue)
            ? { type: 'number', value: numValue }
            : { type: 'element', value: lines[i] });
    }

    return { direction, lineType, elements };
};
