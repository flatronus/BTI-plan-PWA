/**
 * hierarchy.js — Ієрархія елементів (дерево, відображення, вибір).
 * Залежності: g.js, canvas-manager.js
 */

/** Зручна назва для коду елемента */
const ELEMENT_NAMES = {
    WI1: 'Вікно',  DV1: 'Двері',   OT1: 'Отвір',
    KO1: 'Комин 1', KO2: 'Комин 2',
    PI1: 'Піч 1',   PI2: 'Піч 2',
    KU1: 'Кухня 1', KU2: 'Кухня 2', KU3: 'Кухня 3',
    KL1: 'Колона 1', KL2: 'Колона 2',
    NI1: 'Ніша'
};

const METER_PROPERTY_KEYS = new Set([
    'elStart', 'elEnd', 'elLength', '_thickness', 'elOffset',
    'constructThickness', 'constructLength',
    'figureBindingStart', 'figureBindingEnd', 'figureBindingOffset',
    'constructWidth', 'constructHeight'
]);

/**
 * Витягує з масиву elements лінії всі присутні елементи у форматі:
 * [ { start, end, code } ]
 */
window.extractLineElements = function (elements) {
    const result = [];
    for (let i = 0; i < elements.length; i++) {
        if (elements[i]?.type     === 'number' &&
            elements[i + 1]?.type === 'number' &&
            elements[i + 2]?.type === 'element') {
            let code = elements[i + 2].value;
            let side = 1;
            if (code.startsWith('-')) { side = -1; code = code.substring(1); }
            result.push({
                start: elements[i].value,
                end: elements[i + 1].value,
                code,
                side,
                thickness: elements[i + 2].thickness,
                offset: elements[i + 2].offset,
                fill: elements[i + 2].fill
            });
            i += 2;
        }
    }
    return result;
};

/** Зберігає поточні G.hierarchyData/G.hierarchyIdCounter в активний canvas-об'єкт */
window._syncHierarchyToCanvas = function () {
    const canvas = window.canvasManager?.canvases.find(
        c => c.id === window.canvasManager?.activeCanvasId
    );
    if (canvas) {
        canvas.hierarchyData      = G.hierarchyData;
        canvas.hierarchyIdCounter = G.hierarchyIdCounter;
    }
};

window._getBoundChildFigureArea = function (item) {
    return (item.children || []).reduce(function(total, child) {
        if (!child._figureBinding || Number(child._figureBinding.offset || 0) !== 0) return total;
        return total + window._getFigureAreaIncludingBoundFigures(child);
    }, 0);
};

window._getFigureAreaIncludingBoundFigures = function (item) {
    const ownArea = Number(item.area);
    return (Number.isFinite(ownArea) ? ownArea : 0) + window._getBoundChildFigureArea(item);
};

window.addToHierarchy = function (shapeData) {
    const item = {
        id:         G.hierarchyIdCounter++,
        type:       shapeData.isBuilding ? 'building' : 'room',
        name:       shapeData.name || (shapeData.isBuilding ? `Будівля ${G.hierarchyIdCounter}` : `Кімната ${G.hierarchyIdCounter}`),
        roomNumber: shapeData.roomNumber || '',
        area:       shapeData.area || '',
        figureLines: JSON.parse(JSON.stringify(shapeData.figureLines)),
        shapePoints: JSON.parse(JSON.stringify(shapeData.shapePoints)),
        svgGroup:   shapeData.svgGroup,
        constructFigure: shapeData.constructFigure === true,
        constructWidth: shapeData.constructWidth,
        constructHeight: shapeData.constructHeight,
        children:   [],
        expanded:   true,
        parentId:   shapeData.parentId || null
    };

    if (shapeData.parentId) {
        const parent = findHierarchyItemById(shapeData.parentId);
        if (parent) parent.children.push(item);
    } else {
        G.hierarchyData.push(item);
    }

    _syncHierarchyToCanvas();
    renderHierarchy();
    return item;
};

window.findHierarchyItemById = function (id, items = G.hierarchyData) {
    for (const item of items) {
        if (item.id === id) return item;
        const found = findHierarchyItemById(id, item.children);
        if (found) return found;
    }
    return null;
};

window.renderHierarchy = function () {
    const tree = document.getElementById('hierarchy-tree');
    tree.innerHTML = '';
    if (G.hierarchyData.length === 0) {
        
        renderProperties(null);
        return;
    }
    G.hierarchyData.forEach(item => tree.appendChild(createHierarchyItemElement(item)));
};

window.selectHierarchyItem = function (item) {
    G.selectedHierarchyItem = item.id;
    _highlightSvgItem(item);
    renderHierarchy();
    renderProperties(item);
};

/** Виділяє SVG-групу елемента: лінії стають червоними; попереднє виділення знімається */
window._highlightSvgItem = function (item) {
    const canvas = window.canvasManager?.canvases.find(c => c.id === window.canvasManager?.activeCanvasId);
    const mainSvg = canvas ? document.querySelector(`[data-canvas-id="${canvas.id}"] svg`) : null;
    if (mainSvg) {
        mainSvg.querySelectorAll('line[data-selected], polyline[data-selected], polygon[data-selected], path[data-selected]').forEach(el => {
            el.setAttribute('stroke', el.getAttribute('data-orig-stroke') || 'black');
            el.removeAttribute('data-selected');
            el.removeAttribute('data-orig-stroke');
        });
        // Видаляємо мітки точок попереднього виділення
        mainSvg.querySelectorAll('[data-point-label]').forEach(el => el.remove());
    }
    if (!item || !item.svgGroup) return;

    // Виділяємо тільки елементи цієї групи, не заходячи в дочірні <g data-hierarchy-id>
    function collectLines(node) {
        node.childNodes.forEach(function(child) {
            if (child.nodeType !== 1) return;
            if (child.tagName === 'g' && child.hasAttribute('data-hierarchy-id')) return;
            var tag = child.tagName;
            if (tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'path') {
                var orig = child.getAttribute('stroke') || 'black';
                child.setAttribute('data-orig-stroke', orig);
                child.setAttribute('data-selected', '1');
                child.setAttribute('stroke', '#ef4444');
            }
            if (tag === 'g') collectLines(child);
        });
    }
    collectLines(item.svgGroup);

    // Малюємо номери точок по кутах фігури
    if (item.shapePoints && item.shapePoints.length > 0 && mainSvg) {
        // Зміщення точок у локальній системі групи (початковий offset при малюванні)
        var offsetX = item._offsetX || 0;
        var offsetY = item._offsetY || 0;
        if (item._anchorOnCanvas) {
            offsetX = item._anchorOnCanvas.x - (typeof START_X !== 'undefined' ? START_X : 400);
            offsetY = item._anchorOnCanvas.y - (typeof START_Y !== 'undefined' ? START_Y : 300);
        }

        // CTM групи: перетворює локальні координати групи → SVG-координати.
        // Автоматично враховує translate + rotate на групі (і при drag, і після).
        var groupCTM = null;
        try {
            var svgScreenCTM = mainSvg.getScreenCTM();
            var grpScreenCTM = item.svgGroup.getScreenCTM();
            if (svgScreenCTM && grpScreenCTM) {
                groupCTM = svgScreenCTM.inverse().multiply(grpScreenCTM);
            }
        } catch(e) {}

        item.shapePoints.forEach(function(pt) {
            var cx, cy;
            if (groupCTM) {
                // Локальна координата точки в системі групи = pt + offset
                // (саме так намальовані лінії всередині групи)
                var p = mainSvg.createSVGPoint();
                p.x = pt.x + offsetX;
                p.y = pt.y + offsetY;
                var r = p.matrixTransform(groupCTM);
                cx = r.x;
                cy = r.y;
            } else {
                // Fallback: тільки translate (без rotate)
                var tx = 0, ty = 0;
                var tmr = (item.svgGroup.getAttribute('transform') || '')
                              .match(/translate\(([^,)]+),([^)]+)\)/);
                if (tmr) { tx = parseFloat(tmr[1]) || 0; ty = parseFloat(tmr[2]) || 0; }
                cx = pt.x + offsetX + tx;
                cy = pt.y + offsetY + ty;
            }

            var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', '#e53935');
            circle.setAttribute('data-point-label', '1');
            circle.style.pointerEvents = 'none';
            mainSvg.appendChild(circle);

            var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx + 8);
            text.setAttribute('y', cy - 6);
            text.setAttribute('font-size', '13');
            text.setAttribute('fill', '#e53935');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('data-point-label', '1');
            text.style.pointerEvents = 'none';
            text.textContent = pt.num;
            mainSvg.appendChild(text);
        });
    }
};

/**
 * Визначення схем властивостей для кожного типу елемента.
 * Кожна властивість: { key, label, type, readOnly, options, group, hint }
 * type: 'string' | 'number' | 'select' | 'bool' | 'info'
 */
const PROP_SCHEMA = {
    building: [
        { group: 'Ідентифікація' },
        { key: 'type',       label: 'Тип',          type: 'select', readOnly: false,
          options: [{ v: 'room', l: 'Кімната' }, { v: 'building', l: 'Будинок' }, { v: 'contour', l: 'Контур' }] },
        { key: 'name',       label: 'Назва',         type: 'string', readOnly: false },
        { key: 'roomNumber', label: '№ приміщення',  type: 'string', readOnly: false, hint: 'Формат: 1-1' },
        { group: 'Площа' },
        { key: 'area',         label: 'Площа реальна (м²)',   type: 'number', readOnly: false, hint: 'Автоматично або вручну' },
        { key: 'customArea',   label: "Площа редагована (м²)", type: 'number', readOnly: false, hint: 'Налаштована вручну площа' },
        { key: 'useCustomArea',label: 'Використовувати редаговану', type: 'bool', readOnly: false },
        { group: 'Геометрія' },
        { key: '_lineCount', label: 'Ліній',         type: 'info',   readOnly: true  },
        { key: '_ptCount',   label: 'Точок',         type: 'info',   readOnly: true  },
        { group: 'Відображення' },
        { key: 'showRoomLabel',  label: 'Показати підпис',    type: 'bool',   readOnly: false },
        { key: 'roomLabelStyle', label: 'Вид підпису',        type: 'select', readOnly: false,
          options: [{ v: 'inline', l: 'Традиційний (всередині)' }, { v: 'leader', l: 'Виносний' }] },
        { key: 'labelFontSize',     label: 'Шрифт підпису (мм)',   type: 'number', readOnly: false, hint: 'За замовчуванням 3.5 мм (ЕСКД)' },
        { key: 'dimensionFontSize', label: 'Шрифт розмірів (мм)',  type: 'number', readOnly: false, hint: 'За замовчуванням 3.5 мм (ЕСКД)' },
        { key: 'dimensionsOutside', label: 'Розміри ззовні', type: 'bool', readOnly: false },
        { key: 'visible',    label: 'Видимий',       type: 'bool',   readOnly: false },
    ],
    room: [
        { group: 'Ідентифікація' },
        { key: 'type',       label: 'Тип',           type: 'select', readOnly: false,
          options: [{ v: 'room', l: 'Кімната' }, { v: 'building', l: 'Будинок' }, { v: 'contour', l: 'Контур' }] },
        { key: 'name',       label: 'Назва',         type: 'string', readOnly: false },
        { key: 'roomNumber', label: '№ приміщення',  type: 'string', readOnly: false, hint: 'Формат: 1-1' },
        { group: 'Площа' },
        { key: 'area',         label: 'Площа реальна (м²)',    type: 'number', readOnly: false, hint: 'Автоматично або вручну' },
        { key: 'customArea',   label: "Площа редагована (м²)", type: 'number', readOnly: false, hint: 'Налаштована вручну площа' },
        { key: 'useCustomArea',label: 'Використовувати редаговану', type: 'bool', readOnly: false },
        { group: 'Геометрія' },
        { key: '_lineCount', label: 'Ліній',         type: 'info',   readOnly: true  },
        { key: '_ptCount',   label: 'Точок',         type: 'info',   readOnly: true  },
        { group: 'Позиція' },
        { key: '_offsetX',   label: 'Зміщення X',    type: 'info',   readOnly: true  },
        { key: '_offsetY',   label: 'Зміщення Y',    type: 'info',   readOnly: true  },
        { group: 'Відображення' },
        { key: 'showRoomLabel',  label: 'Показати підпис',    type: 'bool',   readOnly: false },
        { key: 'roomLabelStyle', label: 'Вид підпису',        type: 'select', readOnly: false,
          options: [{ v: 'inline', l: 'Традиційний (всередині)' }, { v: 'leader', l: 'Виносний' }] },
        { key: 'labelFontSize',     label: 'Шрифт підпису (мм)',   type: 'number', readOnly: false, hint: 'За замовчуванням 3.5 мм (ЕСКД)' },
        { key: 'dimensionFontSize', label: 'Шрифт розмірів (мм)',  type: 'number', readOnly: false, hint: 'За замовчуванням 3.5 мм (ЕСКД)' },
        { key: 'dimensionsOutside', label: 'Розміри ззовні', type: 'bool', readOnly: false },
        { key: 'visible',    label: 'Видимий',       type: 'bool',   readOnly: false },
    ],
    element: [
        { group: 'Ідентифікація' },
        { key: 'type',        label: 'Тип',          type: 'info',   readOnly: true  },
        { key: 'elCode',      label: 'Код',          type: 'info',   readOnly: true  },
        { key: 'name',        label: 'Назва',        type: 'string', readOnly: false },
        { group: 'Розміщення' },
        { key: '_lineDef',    label: 'Лінія',        type: 'info',   readOnly: true  },
        { key: 'elStart',     label: 'Від (м)',      type: 'number', readOnly: false },
        { key: 'elEnd',       label: 'До (м)',       type: 'number', readOnly: false },
        { key: 'elLength',    label: 'Довжина (м)',  type: 'number', readOnly: false },
        { key: '_thickness',  label: 'Товщина (м)',  type: 'number', readOnly: false, hint: 'За замовчуванням 0.20' },
        { key: 'elOffset',    label: 'Відступ основи (м)', type: 'number', readOnly: false, hint: '0 — по лінії фігури' },
        { key: 'elPlacement', label: 'Сторона фігури', type: 'select', readOnly: false,
          options: [{ v: 'inside', l: 'Всередині' }, { v: 'outside', l: 'Ззовні' }] },
        { key: 'elArea',      label: 'Площа елемента (м²)', type: 'info', readOnly: true },
        { key: 'ignoreArea',  label: 'Не враховувати площу', type: 'bool', readOnly: false },
        { key: 'reverseReference', label: 'Відлік від кінця лінії', type: 'bool', readOnly: false },
        { key: 'elFill',      label: 'Колір заливки', type: 'color', readOnly: false },
        { key: 'elSide',      label: 'Сторона',      type: 'select', readOnly: false, options: [{ v: 1, l: 'Права (1)' }, { v: -1, l: 'Ліва (-1)' }] },
        { group: 'Відображення' },
        { key: 'visible',     label: 'Видимий',      type: 'bool',   readOnly: false },
    ],
    construct: [
        { group: 'Конструктив' },
        { key: 'name',             label: 'Назва',                  type: 'string', readOnly: false },
        { key: 'constructThickness', label: 'Товщина (м)',          type: 'number', readOnly: false, hint: '0.20' },
        { key: 'constructFromEnd',   label: 'Початок від кінця B',  type: 'bool',   readOnly: false },
        { key: 'constructLength',    label: 'Довжина від початку (м)', type: 'number', readOnly: false, hint: 'Вся довжина якщо 0' },
        { group: 'Відображення' },
        { key: 'visible',          label: 'Видимий',                type: 'bool',   readOnly: false },
    ],
};

/** Зчитує значення властивості з item (зі спеціальними ключами) */
function _propGet(item, key) {
    if (key === 'type') return item.type || 'room';
    if (key === 'area') return window._getFigureAreaIncludingBoundFigures(item);
    if (key === 'customArea')    return item.customArea   ?? '';
    if (key === 'useCustomArea') return item.useCustomArea === true;
    if (key === 'showRoomLabel')  return item.showRoomLabel !== false;
    if (key === 'roomLabelStyle') return item.roomLabelStyle || 'inline';
    if (key === '_lineCount') return (item.figureLines || []).length;
    if (key === '_ptCount')   return (item.shapePoints || []).length;
    if (key === '_lineDef')   return (item.lineFrom ?? '?') + ' → ' + (item.lineTo ?? '?');
    if (key === 'elLength') return Math.max(0, Number(item.elEnd || 0) - Number(item.elStart || 0));
    if (key === 'ignoreArea') return item.ignoreArea === true;
    if (key === 'reverseReference') return item.reverseReference === true;
    if (key === 'elOffset') return item.elOffset ?? 0;
    if (key === 'elPlacement') return item.elPlacement || 'inside';
    if (key === 'elFill') return item.elFill || '#ff0000';
    if (key === 'figureBindingLine') {
        const parent = _findParentItemById(item.id);
        const line = parent && (parent.figureLines || []).find(function(lineData) {
            return lineData.id === item._figureBinding?.hostLineId;
        });
        if (!line) return '—';
        const to = line.to ?? (line.isClosing ? parent.shapePoints?.[0]?.num : '?');
        return line.from + '-' + to;
    }
    if (key === 'figureBindingStart') return item._figureBinding?.start ?? 0;
    if (key === 'figureBindingEnd') return item._figureBinding?.end ?? 0;
    if (key === 'figureBindingOffset') return item._figureBinding?.offset ?? 0;
    if (key === 'figureBindingReverse') return item._figureBinding?.reverseReference === true;
    if (key === 'constructWidth' && item._figureBinding) {
        return Number(item._figureBinding.end) - Number(item._figureBinding.start);
    }
    if (key === 'constructWidth') return item.constructWidth ?? 3;
    if (key === 'constructHeight') return item.constructHeight ?? 3;
    const sideDimension = key.match(/^constructLine(\d+)(Visible|Rotated)$/);
    if (sideDimension) {
        const line = (item.figureLines || []).find(function(lineData) {
            return lineData.id === Number(sideDimension[1]);
        });
        if (sideDimension[2] === 'Visible') return !line || line.dimensionVisible !== false;
        return !!(line && line.dimensionRotated);
    }
    if (key === 'elArea') {
        const area = Math.max(0, Number(item.elEnd || 0) - Number(item.elStart || 0)) *
            Number(item.elThickness ?? 0.4);
        const sign = item.elPlacement === 'outside' ? '+' : '-';
        return sign + area.toFixed(1) + ' м²';
    }
    if (key === '_offsetX')   return item._offsetX != null ? item._offsetX.toFixed(2) : '—';
    if (key === '_offsetY')   return item._offsetY != null ? item._offsetY.toFixed(2) : '—';
    if (key === 'visible')    return item.visible !== false;
    if (key === '_thickness') {
        if (item.elThickness != null) return item.elThickness;
        const parent = _findParentItemById(item.id);
        if (parent) {
            const ld = (parent.figureLines || []).find(l => l.id === item._hostLineId);
            if (ld && ld._elementThickness != null) return ld._elementThickness;
        }
        return ELEMENT_THICKNESS;
    }
    if (key === 'labelFontSize')     return item.labelFontSize     != null ? item.labelFontSize     : DEFAULT_FONT_SIZE_MM;
    if (key === 'dimensionFontSize') return item.dimensionFontSize != null ? item.dimensionFontSize : DEFAULT_FONT_SIZE_MM;
    if (key === 'dimensionsOutside') return item.dimensionsOutside === true;
    if (key === 'constructThickness') return item.constructThickness != null ? item.constructThickness : (typeof CONSTRUCT_THICKNESS_M !== 'undefined' ? CONSTRUCT_THICKNESS_M : 0.2);
    if (key === 'constructFromEnd')   return item.constructFromEnd === true;
    if (key === 'constructLength')    return item.constructLength  != null ? item.constructLength  : 0;
    return item[key] ?? '';
}

function _getItemOutlineOnCanvas(item, svg) {
    const points = (item.shapePoints || []).filter(function(point) { return !point.isTemp; });
    if (points.length < 3 || !item.svgGroup || !svg) return [];

    let groupMatrix;
    try {
        const svgMatrix = svg.getScreenCTM();
        const screenMatrix = item.svgGroup.getScreenCTM();
        if (!svgMatrix || !screenMatrix) return [];
        groupMatrix = svgMatrix.inverse().multiply(screenMatrix);
    } catch (error) {
        return [];
    }

    const offsetX = item._anchorOnCanvas
        ? item._anchorOnCanvas.x - START_X
        : (item._offsetX || 0);
    const offsetY = item._anchorOnCanvas
        ? item._anchorOnCanvas.y - START_Y
        : (item._offsetY || 0);
    const lines = item.figureLines || [];
    const outline = [];

    function toCanvas(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x + offsetX;
        svgPoint.y = point.y + offsetY;
        const transformed = svgPoint.matrixTransform(groupMatrix);
        return { x: transformed.x, y: transformed.y };
    }

    points.forEach(function(fromPoint, index) {
        const toPoint = points[(index + 1) % points.length];
        const line = lines.find(function(lineData) {
            return !lineData.isDiagonal && lineData.from === fromPoint.num &&
                (lineData.to === toPoint.num || lineData.isClosing);
        });
        let curve = null;
        if (line && line.lineType === 'curve' && typeof _getLineCurveHeight === 'function') {
            const height = _getLineCurveHeight(line);
            if (height !== null) {
                curve = _getSvgCurveGeometry(
                    fromPoint.x, fromPoint.y, toPoint.x, toPoint.y,
                    height * SCALE, points
                );
            }
        }

        const steps = curve ? Math.max(12, Math.ceil(Math.abs(curve.deltaAngle) * 24)) : 8;
        for (let step = 0; step < steps; step++) {
            const progress = step / steps;
            const point = curve
                ? curve.pointAtDistance(curve.arcLength * progress)
                : {
                    x: fromPoint.x + (toPoint.x - fromPoint.x) * progress,
                    y: fromPoint.y + (toPoint.y - fromPoint.y) * progress
                };
            outline.push(toCanvas(point));
        }
    });

    return outline;
}

function _isPointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const a = polygon[previous];
        const b = polygon[index];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        const projection = lengthSquared
            ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
            : 0;
        const nearestX = a.x + projection * dx;
        const nearestY = a.y + projection * dy;
        if (Math.hypot(point.x - nearestX, point.y - nearestY) <= 0.5) return true;

        if ((a.y > point.y) !== (b.y > point.y) &&
            point.x < (dx * (point.y - a.y)) / dy + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

function _attachContainedFiguresToBuilding(buildingItem) {
    const canvas = window.canvasManager?.canvases.find(
        function(currentCanvas) { return currentCanvas.id === window.canvasManager?.activeCanvasId; }
    );
    const svg = canvas
        ? document.querySelector(`[data-canvas-id="${canvas.id}"] svg`)
        : null;
    if (!svg) return;

    const buildingOutline = _getItemOutlineOnCanvas(buildingItem, svg);
    if (buildingOutline.length < 3) return;

    const candidates = G.hierarchyData.filter(function(candidate) {
        return candidate !== buildingItem &&
            (candidate.type === 'room' || candidate.type === 'contour') &&
            !candidate.parentId;
    });

    candidates.forEach(function(candidate) {
        const candidateOutline = _getItemOutlineOnCanvas(candidate, svg);
        if (candidateOutline.length < 3 ||
            !candidateOutline.every(function(point) {
                return _isPointInPolygon(point, buildingOutline);
            })) {
            return;
        }

        const rootIndex = G.hierarchyData.indexOf(candidate);
        if (rootIndex !== -1) G.hierarchyData.splice(rootIndex, 1);
        candidate.parentId = buildingItem.id;
        if (!buildingItem.children) buildingItem.children = [];
        buildingItem.children.push(candidate);
    });
}

/** Записує значення властивості в item і застосовує побічні ефекти */
function _propSet(item, key, value) {
    if (key === 'type') {
        item.type = value;
        if (value === 'building') _attachContainedFiguresToBuilding(item);
        _syncHierarchyToCanvas();
        renderHierarchy();
        renderProperties(item);
        return;
    }
    if (item._figureBinding && (
        key === 'figureBindingStart' || key === 'figureBindingEnd' ||
        key === 'figureBindingOffset' || key === 'constructWidth' ||
        key === 'constructHeight' || key === 'figureBindingReverse'
    )) {
        _setLineBoundFigureProperty(item, key, value);
        return;
    }
    if (key === 'visible') {
        item.visible = value;
        if (item.svgGroup) item.svgGroup.style.display = value ? '' : 'none';
        if (item.type === 'construct' && typeof _redrawConstructItem === 'function') _redrawConstructItem(item);
        return;
    }
    if (key === 'name' || key === 'roomNumber') {
        item[key] = value;
        renderHierarchy();
        return;
    }
    if (key === 'area') {
        const area = Number(value);
        item.area = Number.isFinite(area) && String(value).trim()
            ? Math.max(0, area - window._getBoundChildFigureArea(item))
            : value;
        _redrawItemSvgGroup(item);
        renderHierarchy();
        return;
    }
    if (key === 'customArea') {
        item.customArea = value;
        _redrawItemSvgGroup(item);
        renderHierarchy();
        return;
    }
    if (key === 'useCustomArea') {
        item.useCustomArea = value;
        _redrawItemSvgGroup(item);
        renderHierarchy();
        return;
    }
    if (key === 'showRoomLabel' || key === 'roomLabelStyle') {
        item[key] = value;
        _redrawItemSvgGroup(item);
        return;
    }
    if (key === 'labelFontSize' || key === 'dimensionFontSize') {
        const v = window.normalizeMeasurement(value);
        item[key] = isNaN(v) ? null : v;
        _redrawItemSvgGroup(item);
        return;
    }
    if (key === 'dimensionsOutside') {
        item.dimensionsOutside = value;
        _redrawItemSvgGroup(item);
        return;
    }
    if (item.constructFigure && (key === 'constructWidth' || key === 'constructHeight')) {
        const dimension = window.normalizeMeasurement(value);
        if (!Number.isFinite(dimension) || dimension <= 0) {
            showToast('Розмір фігури має бути більшим за 0', 'warning');
            renderProperties(item);
            return;
        }
        item[key] = dimension;
        _resizeConstructFigure(item);
        return;
    }
    const sideDimension = key.match(/^constructLine(\d+)(Visible|Rotated)$/);
    if (item.constructFigure && sideDimension) {
        const line = (item.figureLines || []).find(function(lineData) {
            return lineData.id === Number(sideDimension[1]);
        });
        if (!line) {
            showToast('Не знайдено сторону фігури', 'error');
            return;
        }
        if (sideDimension[2] === 'Visible') line.dimensionVisible = value;
        else line.dimensionRotated = value;
        _redrawItemSvgGroup(item);
        _syncHierarchyToCanvas();
        renderProperties(item);
        return;
    }
    if (key === 'elStart' || key === 'elEnd' || key === 'elLength' ||
        key === 'elSide' || key === '_thickness' || key === 'elOffset' ||
        key === 'elPlacement' || key === 'elFill' || key === 'ignoreArea' ||
        key === 'reverseReference') {
        const number = window.normalizeMeasurement(value);
        if (key === 'elStart') item.elStart = Number.isFinite(number) ? number : 0;
        else if (key === 'elEnd') item.elEnd = Number.isFinite(number) ? number : 0;
        else if (key === 'elLength') item.elEnd = Number(item.elStart || 0) + (Number.isFinite(number) ? Math.max(0, number) : 0);
        else if (key === 'elSide') item.elSide = parseInt(value);
        else if (key === '_thickness') item.elThickness = Number.isFinite(number) && number > 0 ? number : ELEMENT_THICKNESS;
        else if (key === 'elOffset') item.elOffset = Number.isFinite(number) ? Math.max(0, number) : 0;
        else if (key === 'elPlacement') item.elPlacement = value;
        else if (key === 'elFill') item.elFill = value;
        else if (key === 'ignoreArea' || key === 'reverseReference') item[key] = value;
        // Синхронізуємо зміни у lineData батьківської фігури і перемальовуємо
        _syncElementToParentAndRedraw(item);
        return;
    }
    if (key === 'constructThickness' || key === 'constructFromEnd' || key === 'constructLength') {
        if (key === 'constructThickness') item.constructThickness = window.normalizeMeasurement(value) || CONSTRUCT_THICKNESS_M;
        else if (key === 'constructFromEnd') item.constructFromEnd = value;
        else if (key === 'constructLength') item.constructLength = window.normalizeMeasurement(value) || 0;
        if (typeof _redrawConstructItem === 'function') _redrawConstructItem(item);
        return;
    }
    item[key] = value;
}

function _setLineBoundFigureProperty(item, key, value) {
    const parent = _findParentItemById(item.id);
    if (!parent || typeof _getLineBoundFigureLength !== 'function' ||
        typeof _refreshLineBoundFigure !== 'function') {
        showToast('Не знайдено батьківську фігуру для прив’язки', 'error');
        return;
    }

    const binding = Object.assign({}, item._figureBinding);
    const previousBinding = item._figureBinding;
    const previousHeight = item.constructHeight;
    const totalLength = _getLineBoundFigureLength(parent, binding.hostLineId);
    if (key === 'figureBindingReverse') {
        binding.reverseReference = value === true;
    }
    const number = key === 'figureBindingReverse' ? 0 : window.normalizeMeasurement(value);
    if ((key !== 'figureBindingReverse' && !Number.isFinite(number)) ||
        !Number.isFinite(totalLength) || totalLength <= 0) {
        showToast('Некоректне значення прив’язки', 'warning');
        renderProperties(item);
        return;
    }

    if (key === 'figureBindingStart') {
        if (number < 0 || number >= Number(binding.end) || Number(binding.end) > totalLength) {
            showToast('Початок має бути меншим за кінець прив’язки', 'warning');
            renderProperties(item);
            return;
        }
        binding.start = number;
    } else if (key === 'figureBindingEnd') {
        if (number <= Number(binding.start) || number > totalLength) {
            showToast('Кінець має бути більшим за початок і не виходити за межі лінії', 'warning');
            renderProperties(item);
            return;
        }
        binding.end = number;
    } else if (key === 'figureBindingOffset') {
        if (number < 0) {
            showToast('Відступ не може бути від’ємним', 'warning');
            renderProperties(item);
            return;
        }
        binding.offset = number;
    } else if (key === 'constructWidth') {
        if (number <= 0 || Number(binding.start) + number > totalLength) {
            showToast('Ширина має бути більшою за 0 і поміщатися на лінії', 'warning');
            renderProperties(item);
            return;
        }
        binding.end = Number(binding.start) + number;
    } else if (key === 'constructHeight') {
        if (number <= 0) {
            showToast('Висота має бути більшою за 0', 'warning');
            renderProperties(item);
            return;
        }
        item.constructHeight = number;
    }

    item._figureBinding = binding;
    item.constructWidth = Number(binding.end) - Number(binding.start);
    if (!_refreshLineBoundFigure(item, parent)) {
        item._figureBinding = previousBinding;
        item.constructHeight = previousHeight;
        item.constructWidth = Number(previousBinding.end) - Number(previousBinding.start);
        _refreshLineBoundFigure(item, parent);
        showToast('Не вдалося оновити прив’язану фігуру', 'error');
        renderProperties(item);
        return;
    }
    _refreshFigureAreaAncestors(item);
    _syncHierarchyToCanvas();
    renderHierarchy();
    renderProperties(item);
}

function _resizeConstructFigure(item) {
    const points = item.shapePoints || [];
    if (points.length !== 4 || (item.figureLines || []).length !== 4) {
        showToast('Редагування розмірів доступне лише для прямокутної фігури', 'error');
        return;
    }
    const centerX = points.reduce(function(sum, point) { return sum + point.x; }, 0) / points.length;
    const centerY = points.reduce(function(sum, point) { return sum + point.y; }, 0) / points.length;
    const width = Number(item.constructWidth);
    const height = Number(item.constructHeight);
    const halfWidth = width * SCALE / 2;
    const halfHeight = height * SCALE / 2;
    item.shapePoints = [
        { x: centerX - halfWidth, y: centerY - halfHeight, num: 1 },
        { x: centerX + halfWidth, y: centerY - halfHeight, num: 2 },
        { x: centerX + halfWidth, y: centerY + halfHeight, num: 3 },
        { x: centerX - halfWidth, y: centerY + halfHeight, num: 4 }
    ];
    const lengths = [width, height, width, height];
    item.figureLines.forEach(function(lineData, index) {
        const length = lengths[index];
        lineData.length = length;
        const elements = lineData.elements || (lineData.elements = []);
        for (let elementIndex = 0; elementIndex < elements.length - 2; elementIndex++) {
            if (elements[elementIndex]?.type !== 'number' ||
                elements[elementIndex + 1]?.type !== 'number' ||
                elements[elementIndex + 2]?.type !== 'element') continue;
            const elementLength = Math.min(
                length,
                Math.max(0, elements[elementIndex + 1].value - elements[elementIndex].value)
            );
            const elementStart = Math.min(elements[elementIndex].value, length - elementLength);
            elements[elementIndex].value = elementStart;
            elements[elementIndex + 1].value = elementStart + elementLength;
            if (String(elements[elementIndex + 2].value).replace(/^-/, '') === 'KO1') {
                elements[elementIndex + 2].lineLength = length;
            }
            elementIndex += 2;
        }
        let lengthElement = null;
        for (let elementIndex = elements.length - 1; elementIndex >= 0; elementIndex--) {
            if (elements[elementIndex].type === 'number') {
                lengthElement = elements[elementIndex];
                break;
            }
        }
        if (lengthElement) lengthElement.value = length;
        else elements.push({ type: 'number', value: length });
        lineData.code = typeof _rebuildLineCode === 'function'
            ? _rebuildLineCode(elements, lineData.direction, lineData.lineType)
            : lineData.direction + '\n' + lineData.lineType + '\n' + length.toFixed(2);
    });
    item.area = typeof calculateFigureArea === 'function'
        ? calculateFigureArea(item.figureLines, item.shapePoints).toFixed(1)
        : (width * height).toFixed(1);
    const offsetX = item._anchorOnCanvas ? item._anchorOnCanvas.x - START_X : (item._offsetX || 0);
    const offsetY = item._anchorOnCanvas ? item._anchorOnCanvas.y - START_Y : (item._offsetY || 0);
    _redrawItemSvgGroup(item);
    if (typeof _refreshChildAnchors === 'function') _refreshChildAnchors(item, offsetX, offsetY);
    _syncHierarchyToCanvas();
    renderHierarchy();
    renderProperties(item);
}

/** Перемальовує SVG-групу item зі збереженням і відновленням G */
function _redrawItemSvgGroup(item) {
    if (!item || !item.svgGroup) return;
    const offsetX = item._anchorOnCanvas ? item._anchorOnCanvas.x - START_X : (item._offsetX || 0);
    const offsetY = item._anchorOnCanvas ? item._anchorOnCanvas.y - START_Y : (item._offsetY || 0);
    const savedLines = G.figureLines, savedPoints = G.shapePoints;
    const savedDO = G.dimensionsOutside, savedRoom = G.roomNumber, savedBuild = G.isBuilding;
    G.figureLines = JSON.parse(JSON.stringify(item.figureLines));
    G.shapePoints = JSON.parse(JSON.stringify(item.shapePoints));
    G.dimensionsOutside = item.dimensionsOutside === true;
    G.roomNumber  = item.roomNumber || '';
    G.isBuilding  = item.type === 'building';
    _rebuildSvgGroup(item.svgGroup, offsetX, offsetY, item);
    G.figureLines = savedLines;
    G.shapePoints = savedPoints;
    G.dimensionsOutside = savedDO;
    G.roomNumber  = savedRoom;
    G.isBuilding  = savedBuild;
}

window._refreshFigureAreaAncestors = function (item) {
    let parent = _findParentInHierarchy(item.id);
    while (parent) {
        _redrawItemSvgGroup(parent);
        parent = _findParentInHierarchy(parent.id);
    }
};

/** Знаходить батьківський item за id дочірнього (по всьому дереву) */
function _findParentItemById(childId, items, parent) {
    items = items || G.hierarchyData;
    for (var i = 0; i < items.length; i++) {
        if (items[i].id === childId) return parent || null;
        var found = _findParentItemById(childId, items[i].children || [], items[i]);
        if (found !== undefined) return found;
    }
    return undefined;
}

/**
 * Перебудовує рядок lineData.code з масиву elements.
 * Формат: direction\nlineType\nval1\nval2\ncode\n...
 */
function _rebuildLineCode(elements, direction, lineType) {
    var lines = [direction || 'free', lineType || 'line'];
    var chimneyIndex = (elements || []).findIndex(function(element) {
        return element.type === 'element' && String(element.value).replace(/^-/, '') === 'KO1';
    });
    if (chimneyIndex !== -1) {
        var chimney = elements[chimneyIndex];
        var numbers = (elements || []).filter(function(element) { return element.type === 'number'; });
        var length = chimney.lineLength ?? numbers[0]?.value ?? 0;
        if (lineType === 'curve') lines.push(String(length), String(numbers[1]?.value ?? 0));
        lines.push(chimney.value);
        lines.push(
            String(elements[chimneyIndex - 2]?.value ?? 0),
            String(elements[chimneyIndex - 1]?.value ?? 0),
            String(chimney.thickness ?? 0.4),
            String(chimney.offset ?? 0)
        );
        if (lineType === 'line') lines.push(String(length));
        for (var i = 0; i < (elements || []).length - 2; i++) {
            if (i === chimneyIndex - 2) continue;
            if (elements[i]?.type === 'number' && elements[i + 1]?.type === 'number' &&
                elements[i + 2]?.type === 'element' &&
                String(elements[i + 2].value).replace(/^-/, '') !== 'KO1') {
                lines.push(String(elements[i].value), String(elements[i + 1].value), elements[i + 2].value);
                i += 2;
            }
        }
        return lines.join('\n');
    }
    (elements || []).forEach(function(el) {
        lines.push(el.type === 'number' ? String(el.value) : el.value);
    });
    return lines.join('\n');
}

/**
 * Після редагування властивостей елемента (WI1): оновлює lineData батьківської фігури
 * і перемальовує SVG-групу батька з новими значеннями.
 */
function _syncElementToParentAndRedraw(elItem) {
    const parent = _findParentItemById(elItem.id);
    if (!parent || !parent.svgGroup) return;

    // Знаходимо lineData по _hostLineId або по lineFrom/lineTo
    var lineData = null;
    if (elItem._hostLineId != null) {
        lineData = (parent.figureLines || []).find(function(l) { return l.id === elItem._hostLineId; });
    }
    if (!lineData) {
        lineData = (parent.figureLines || []).find(function(l) {
            return l.from === elItem.lineFrom && (l.to === elItem.lineTo || (l.isClosing && elItem.lineTo == null));
        });
    }
    if (!lineData) return;

    // Оновлюємо lineData.elements — замінюємо значення start/end/side і товщину
    var elements = lineData.elements || [];
    for (var i = 0; i < elements.length; i++) {
        if (elements[i]?.type     === 'number' &&
            elements[i+1]?.type   === 'number' &&
            elements[i+2]?.type   === 'element') {
            var rawCode = elements[i+2].value;
            var code    = rawCode.startsWith('-') ? rawCode.substring(1) : rawCode;
            var side    = rawCode.startsWith('-') ? -1 : 1;
            // Перевіряємо чи це той самий елемент (по ключу або просто перший WI1)
            var elKey = 'wi_' + lineData.from + '_' + (lineData.to ?? 'c') + '_' + code + '_' + elements[i].value;
            if (elItem._elKey && elItem._elKey !== elKey) { i += 2; continue; }
            elements[i].value     = elItem.elStart;
            elements[i+1].value   = elItem.elEnd;
            var newSide  = (elItem.elSide != null) ? elItem.elSide : side;
            var newCode  = code === 'KO1'
                ? (elItem.elPlacement === 'outside' ? '-KO1' : 'KO1')
                : (newSide === -1 ? ('-' + code) : code);
            elements[i+2].value   = newCode;
            if (code === 'KO1') {
                elements[i+2].thickness = elItem.elThickness ?? 0.4;
                elements[i+2].offset = elItem.elOffset ?? 0;
                elements[i+2].fill = elItem.elFill || '#ff0000';
                elements[i+2].ignoreArea = elItem.ignoreArea === true;
                elements[i+2].reverseReference = elItem.reverseReference === true;
                elements[i+2].placement = elItem.elPlacement || 'inside';
                elements[i+2].lineLength = elements[i+2].lineLength ?? lineData.length;
            }
            elItem._elKey = 'wi_' + lineData.from + '_' + (lineData.to ?? 'c') + '_' + code + '_' + elItem.elStart;
            // Перебудовуємо lineData.code щоб модалка координат показувала актуальні числа
            lineData.code = _rebuildLineCode(lineData.elements, lineData.direction, lineData.lineType);
            break;
            i += 2;
        }
    }
    if ((elItem.elCode === 'OT1' || elItem.elCode === 'KO1') && typeof calculateFigureArea === 'function') {
        parent.area = calculateFigureArea(parent.figureLines, parent.shapePoints).toFixed(1);
    }
    // Перемальовуємо SVG-групу батька
    var offsetX = parent._anchorOnCanvas ? parent._anchorOnCanvas.x - START_X : (parent._offsetX || 0);
    var offsetY = parent._anchorOnCanvas ? parent._anchorOnCanvas.y - START_Y : (parent._offsetY || 0);
    var savedLines = G.figureLines, savedPoints = G.shapePoints;
    var savedRoom  = G.roomNumber,  savedBuild  = G.isBuilding;
    G.figureLines = JSON.parse(JSON.stringify(parent.figureLines));
    G.shapePoints = JSON.parse(JSON.stringify(parent.shapePoints));
    G.roomNumber  = parent.roomNumber || '';
    G.isBuilding  = parent.type === 'building';
    _rebuildSvgGroup(parent.svgGroup, offsetX, offsetY, parent);
    G.figureLines = savedLines;
    G.shapePoints = savedPoints;
    G.roomNumber  = savedRoom;
    G.isBuilding  = savedBuild;
    _refreshFigureAreaAncestors(parent);
    // Оновлюємо назву елемента в ієрархії
    elItem.name = _buildElementName(elItem);
    renderHierarchy();
    if (G.selectedHierarchyItem === elItem.id) renderProperties(elItem);
}

/** Рендерить панель Властивості для вибраного елемента */
window.renderProperties = function (item) {
    const body = document.getElementById('properties-body');
    if (!body) return;
    body.innerHTML = '';

    if (!item) {
        return;
    }

    const schema = PROP_SCHEMA[item.type] || PROP_SCHEMA.room;
    const visibleSchema = item.type === 'element' && item.elCode !== 'KO1'
        ? schema.filter(function(prop) {
            return !['elLength', 'elOffset', 'elPlacement', 'elArea', 'ignoreArea',
                'reverseReference', 'elFill'].includes(prop.key);
        })
        : item.type === 'element'
            ? schema.filter(function(prop) { return prop.key !== 'elSide'; })
            : schema.slice();
    const bindingSchema = item._figureBinding ? [
        { group: 'Прив’язка до лінії' },
        { key: 'figureBindingLine', label: 'Лінія батьківської фігури', type: 'info', readOnly: true },
        { key: 'figureBindingStart', label: 'Початок прив’язки (м)', type: 'number', readOnly: false },
        { key: 'figureBindingEnd', label: 'Кінець прив’язки (м)', type: 'number', readOnly: false },
        { key: 'figureBindingOffset', label: 'Відступ від лінії (м)', type: 'number', readOnly: false },
        { key: 'figureBindingReverse', label: 'Відлік від кінця лінії', type: 'bool', readOnly: false }
    ] : [];
    const figureSchema = item.constructFigure ? [
        { group: item._figureBinding ? 'Розміри прив’язаної групи' : 'Розміри прямокутника' },
        { key: 'constructWidth', label: 'Ширина (м)', type: 'number', readOnly: false },
        { key: 'constructHeight', label: 'Висота (м)', type: 'number', readOnly: false },
        { type: 'constructDimensionTable' }
    ] : [];
    if (item.constructFigure) {
        const remainingSectionsIndex = visibleSchema.findIndex(function(prop) {
            return ['Геометрія', 'Позиція', 'Відображення'].includes(prop.group);
        });
        const insertIndex = remainingSectionsIndex === -1 ? visibleSchema.length : remainingSectionsIndex;
        visibleSchema.splice(insertIndex, 0, ...bindingSchema, ...figureSchema);
    } else if (item._figureBinding) {
        visibleSchema.push(...bindingSchema);
    }

    /* ── Заголовок панелі з кнопкою + ── */
    const titleBar = document.createElement('div');
    titleBar.style.cssText = [
        'background:#1e40af;color:#fff;font-size:11px;font-weight:700;',
        'padding:4px 8px;display:flex;align-items:center;justify-content:space-between;',
        'border-bottom:2px solid #1e3a8a;',
    ].join('');
    const typeIcon = item.constructFigure ? '▭' : item.type === 'building' ? '🏢' : item.type === 'element' ? '🪟' : item.type === 'contour' ? '⬡' : item.type === 'construct' ? '▬' : '🚪';
    const titleText = document.createElement('span');
    titleText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    titleText.textContent = typeIcon + ' ' + (item.roomNumber || item.name || 'Без назви');
    titleBar.appendChild(titleText);

    const addBtn = document.createElement('button');
    addBtn.title = 'Додати користувацьку властивість';
    addBtn.textContent = '+';
    addBtn.style.cssText = [
        'background:#3b82f6;color:#fff;border:1px solid #93c5fd;border-radius:3px;',
        'font-size:13px;font-weight:700;padding:0 6px;cursor:pointer;',
        'line-height:18px;flex-shrink:0;margin-left:6px;',
    ].join('');
    addBtn.onclick = function() { _showAddCustomPropDialog(item, body); };
    titleBar.appendChild(addBtn);
    body.appendChild(titleBar);

    /* ── Таблиця властивостей ── */
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';

    visibleSchema.forEach(function(prop) {
        if (prop.type === 'constructDimensionTable') {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.style.cssText = 'padding:4px 2px;';
            td.appendChild(_makeConstructDimensionTable(item));
            tr.appendChild(td);
            table.appendChild(tr);
            return;
        }

        /* Заголовок групи */
        if (prop.group) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 2;
            td.style.cssText = [
                'background:#dbeafe;color:#1e40af;font-weight:700;',
                'padding:3px 6px;font-size:10px;letter-spacing:0.5px;',
                'text-transform:uppercase;border-top:1px solid #bfdbfe;',
                'border-bottom:1px solid #bfdbfe;user-select:none;',
            ].join('');
            td.textContent = prop.group;
            tr.appendChild(td);
            table.appendChild(tr);
            return;
        }

        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom:1px solid #f0f0f0;';

        const tdLabel = document.createElement('td');
        tdLabel.style.cssText = [
            'color:#374151;padding:3px 6px;width:46%;',
            'background:#f9fafb;border-right:1px solid #e5e7eb;',
            'vertical-align:middle;white-space:nowrap;overflow:hidden;',
            'text-overflow:ellipsis;',
        ].join('');
        tdLabel.title = prop.hint || prop.label;
        tdLabel.textContent = prop.label;
        tr.appendChild(tdLabel);

        const tdVal = document.createElement('td');
        tdVal.style.cssText = 'padding:1px 2px;vertical-align:middle;';

        const val = _propGet(item, prop.key);
        const ctrl = _makeControl(prop, val, item);
        tdVal.appendChild(ctrl);
        tr.appendChild(tdVal);

        table.appendChild(tr);
    });

    body.appendChild(table);

    /* ── Користувацькі властивості ── */
    if (!item._customProps) item._customProps = [];
    if (item._customProps.length > 0) {
        body.appendChild(_makeGroupHeader('Користувацькі'));
        const tblC = document.createElement('table');
        tblC.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';
        item._customProps.forEach(function(cp, idx) {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #f0f0f0';

            const tdL = document.createElement('td');
            tdL.style.cssText = 'color:#374151;padding:3px 6px;width:46%;background:#f9fafb;border-right:1px solid #e5e7eb;vertical-align:middle;';
            tdL.title = cp.label;
            tdL.textContent = cp.label;

            const tdV = document.createElement('td');
            tdV.style.cssText = 'padding:1px 2px;vertical-align:middle;display:flex;align-items:center;gap:2px;';

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.value = cp.value || '';
            inp.style.cssText = [
                'flex:1;min-width:0;font-size:11px;border:none;background:transparent;',
                'padding:2px 4px;color:#111827;outline:none;',
            ].join('');
            inp.onfocus = function() { inp.style.background = '#eff6ff'; inp.style.outline = '1px solid #2196F3'; };
            inp.onblur  = function() { inp.style.background = 'transparent'; inp.style.outline = 'none'; };
            inp.onchange = function() { cp.value = inp.value; };

            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.title = 'Видалити властивість';
            delBtn.style.cssText = [
                'background:none;border:none;color:#f44336;cursor:pointer;',
                'font-size:10px;padding:1px 3px;flex-shrink:0;',
            ].join('');
            delBtn.onclick = function() {
                item._customProps.splice(idx, 1);
                renderProperties(item);
            };

            tdV.appendChild(inp); tdV.appendChild(delBtn);
            tr.appendChild(tdL); tr.appendChild(tdV);
            tblC.appendChild(tr);
        });
        body.appendChild(tblC);
    }

    /* ── Додаткові секції: елементи на лініях ── */
    if (item.type !== 'element') {
        const elems = (item.figureLines || []).flatMap(function(l) {
            return extractLineElements(l.elements || []);
        });
        if (elems.length > 0) {
            const hdr = _makeGroupHeader('Елементи на лініях (' + elems.length + ')');
            body.appendChild(hdr);
            const tbl2 = document.createElement('table');
            tbl2.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';
            elems.forEach(function(el) {
                const name = ELEMENT_NAMES[el.code] || el.code;
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f0f0f0';
                const td1 = document.createElement('td');
                td1.style.cssText = 'color:#9C27B0;font-weight:700;padding:3px 6px;width:46%;background:#f9fafb;border-right:1px solid #e5e7eb;';
                td1.textContent = el.code;
                const td2 = document.createElement('td');
                td2.style.cssText = 'color:#374151;padding:3px 6px;';
                td2.textContent = name + '  ' + el.start.toFixed(2) + '–' + el.end.toFixed(2) + ' м';
                tr.appendChild(td1); tr.appendChild(td2);
                tbl2.appendChild(tr);
            });
            body.appendChild(tbl2);
        }

        const kids = item.children || [];
        if (kids.length > 0) {
            body.appendChild(_makeGroupHeader('Дочірні (' + kids.length + ')'));
            const tbl3 = document.createElement('table');
            tbl3.style.cssText = 'width:100%;border-collapse:collapse;font-size:11px;';
            kids.forEach(function(ch) {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f0f0f0';
                const td1 = document.createElement('td');
                td1.style.cssText = 'color:#6b7280;padding:3px 6px;width:46%;background:#f9fafb;border-right:1px solid #e5e7eb;';
                td1.textContent = '↳ ' + (ch.roomNumber || ch.name);
                const td2 = document.createElement('td');
                td2.style.cssText = 'color:#374151;padding:3px 6px;';
                const childArea = ch.type === 'element'
                    ? null
                    : window._getFigureAreaIncludingBoundFigures(ch);
                td2.textContent = ch.type === 'element'
                    ? (ELEMENT_NAMES[ch.elCode] || ch.elCode || '—')
                    : (childArea ? childArea.toFixed(1) + ' м²' : '—');
                tr.appendChild(td1); tr.appendChild(td2);
                tbl3.appendChild(tr);
            });
            body.appendChild(tbl3);
        }
    }
};

function _makeConstructDimensionTable(item) {
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:10px;text-align:center;';

    const header = document.createElement('tr');
    ['№-№', 'Розворот', 'Видимість'].forEach(function(label) {
        const th = document.createElement('th');
        th.textContent = label;
        th.style.cssText = 'padding:3px 2px;background:#eff6ff;color:#374151;border:1px solid #dbeafe;font-weight:700;';
        header.appendChild(th);
    });
    table.appendChild(header);

    (item.figureLines || []).forEach(function(lineData) {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f0f0f0';

        const lineCell = document.createElement('td');
        lineCell.textContent = lineData.from + '-' + lineData.to;
        lineCell.style.cssText = 'padding:3px 4px;color:#374151;border-right:1px solid #e5e7eb;';
        tr.appendChild(lineCell);

        [
            { suffix: 'Rotated', value: !!lineData.dimensionRotated },
            { suffix: 'Visible', value: lineData.dimensionVisible !== false }
        ].forEach(function(setting) {
            const cell = document.createElement('td');
            cell.style.cssText = 'padding:1px 2px;';
            const control = _makeControl({
                key: 'constructLine' + lineData.id + setting.suffix,
                type: 'bool',
                readOnly: false
            }, setting.value, item);
            control.style.justifyContent = 'center';
            cell.appendChild(control);
            tr.appendChild(cell);
        });

        table.appendChild(tr);
    });

    return table;
}

/** Показує inline-форму для додавання користувацької властивості */
function _showAddCustomPropDialog(item, body) {
    // Видаляємо попередній діалог якщо є
    const existing = body.querySelector('[data-add-prop-dialog]');
    if (existing) { existing.remove(); return; }

    const dlg = document.createElement('div');
    dlg.setAttribute('data-add-prop-dialog', '1');
    dlg.style.cssText = [
        'background:#eff6ff;border:1px solid #93c5fd;border-radius:4px;',
        'padding:8px;margin:4px 0;',
    ].join('');

    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;gap:4px;margin-bottom:4px;';

    const nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.placeholder = 'Назва властивості';
    nameInp.style.cssText = 'flex:1;font-size:11px;padding:3px 5px;border:1px solid #93c5fd;border-radius:3px;';

    const valInp = document.createElement('input');
    valInp.type = 'text';
    valInp.placeholder = 'Значення';
    valInp.style.cssText = 'flex:1;font-size:11px;padding:3px 5px;border:1px solid #93c5fd;border-radius:3px;';

    row1.appendChild(nameInp); row1.appendChild(valInp);

    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;gap:4px;justify-content:flex-end;';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Додати';
    okBtn.style.cssText = 'background:#2196F3;color:#fff;border:none;border-radius:3px;padding:3px 10px;font-size:11px;cursor:pointer;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Скасувати';
    cancelBtn.style.cssText = 'background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:3px;padding:3px 8px;font-size:11px;cursor:pointer;';

    okBtn.onclick = function() {
        const label = nameInp.value.trim();
        const value = valInp.value.trim();
        if (!label) { nameInp.style.borderColor = '#f44336'; nameInp.focus(); return; }
        if (!item._customProps) item._customProps = [];
        item._customProps.push({ label, value });
        renderProperties(item);
    };
    cancelBtn.onclick = function() { dlg.remove(); };

    nameInp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { e.preventDefault(); valInp.focus(); } });
    valInp.addEventListener('keydown',  function(e) { if (e.key === 'Enter') { e.preventDefault(); okBtn.click(); } });

    row2.appendChild(cancelBtn); row2.appendChild(okBtn);
    dlg.appendChild(row1); dlg.appendChild(row2);
    body.appendChild(dlg);
    nameInp.focus();
}

/** Створює контрол для властивості */
function _makeControl(prop, val, item) {
    const BASE_STYLE = [
        'width:100%;box-sizing:border-box;font-size:11px;',
        'border:none;background:transparent;',
        'padding:2px 4px;color:#111827;',
        'outline:none;',
    ].join('');

    if (prop.type === 'info') {
        const span = document.createElement('span');
        span.style.cssText = 'font-size:11px;color:#374151;padding:2px 6px;display:block;';
        span.textContent = val !== '' && val != null ? String(val) : '—';
        return span;
    }

    if (prop.type === 'bool') {
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;align-items:center;gap:4px;padding:2px 4px;cursor:pointer;';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!val;
        chk.disabled = !!prop.readOnly;
        chk.style.cssText = 'width:13px;height:13px;cursor:pointer;accent-color:#2196F3;';
        chk.onchange = function() { _propSet(item, prop.key, chk.checked); };
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:11px;color:#374151;user-select:none;';
        lbl.textContent = chk.checked ? 'Так' : 'Ні';
        chk.onchange = function() {
            lbl.textContent = chk.checked ? 'Так' : 'Ні';
            _propSet(item, prop.key, chk.checked);
        };
        wrap.appendChild(chk); wrap.appendChild(lbl);
        return wrap;
    }

    if (prop.type === 'select') {
        const sel = document.createElement('select');
        sel.style.cssText = BASE_STYLE + 'cursor:pointer;';
        sel.disabled = !!prop.readOnly;
        (prop.options || []).forEach(function(opt) {
            const o = document.createElement('option');
            o.value = opt.v;
            o.textContent = opt.l;
            if (String(val) === String(opt.v)) o.selected = true;
            sel.appendChild(o);
        });
        sel.onchange = function() { _propSet(item, prop.key, sel.value); };
        _applyFocusStyle(sel);
        return sel;
    }

    if (prop.type === 'string') {
        if (prop.readOnly) {
            const span = document.createElement('span');
            span.style.cssText = 'font-size:11px;color:#374151;padding:2px 6px;display:block;';
            span.textContent = val || '—';
            return span;
        }
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = val || '';
        inp.placeholder = prop.hint || '';
        inp.style.cssText = BASE_STYLE;
        inp.onchange = function() { _propSet(item, prop.key, inp.value.trim()); };
        _applyFocusStyle(inp);
        return inp;
    }

    if (prop.type === 'color') {
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = /^#[0-9a-f]{6}$/i.test(String(val)) ? val : '#ff0000';
        inp.disabled = !!prop.readOnly;
        inp.style.cssText = 'width:100%;height:22px;padding:1px;border:0;background:transparent;cursor:pointer;';
        inp.onchange = function() { _propSet(item, prop.key, inp.value); };
        return inp;
    }

    if (prop.type === 'number') {
        const precision = prop.key === 'area' || prop.key === 'customArea' ? 1 : 2;
        if (prop.readOnly) {
            const span = document.createElement('span');
            span.style.cssText = 'font-size:11px;color:#374151;padding:2px 6px;display:block;';
            span.textContent = val !== '' && val != null ? window.formatMeasurement(val, precision) : '—';
            return span;
        }
        const inp = document.createElement('input');
        const isMeterValue = METER_PROPERTY_KEYS.has(prop.key);
        inp.type = isMeterValue ? 'number' : 'text';
        if (isMeterValue) {
            inp.step = '0.01';
            inp.min = '0';
            inp.addEventListener('keydown', function(event) {
                if (event.key !== ',' && event.code !== 'Comma' &&
                    event.code !== 'NumpadDecimal') return;
                event.preventDefault();
                if (!inp.value.includes('.')) {
                    const current = inp.value;
                    inp.type = 'text';
                    inp.value = (current || '0') + '.';
                    try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch(e) {}
                    inp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
        }
        inp.inputMode = 'decimal';
        inp.value = val !== '' && val != null ? window.formatMeasurement(val, precision) : '';
        inp.placeholder = prop.hint || '0';
        inp.style.cssText = BASE_STYLE;
        inp.oninput = function() {
            const limited = window.limitMeasurementInput(inp.value, precision);
            if (limited !== inp.value) inp.value = limited;
        };
        const commitValue = function() {
            if (!inp.value.trim()) {
                if (isMeterValue) inp.type = 'number';
                _propSet(item, prop.key, '');
                return;
            }
            const number = window.normalizeMeasurement(inp.value, precision);
            if (!Number.isFinite(number)) {
                showToast('Введіть коректне числове значення', 'warning');
                renderProperties(item);
                return;
            }
            inp.value = window.formatMeasurement(number, precision);
            if (isMeterValue) inp.type = 'number';
            _propSet(item, prop.key, number);
        };
        inp.onchange = commitValue;
        _applyFocusStyle(inp);
        return inp;
    }

    const span = document.createElement('span');
    span.textContent = String(val ?? '—');
    return span;
}

function _applyFocusStyle(el) {
    el.onfocus = function() {
        el.style.background = '#eff6ff';
        el.style.outline = '1px solid #2196F3';
    };
    el.onblur = function() {
        el.style.background = 'transparent';
        el.style.outline = 'none';
    };
}

function _makeGroupHeader(text) {
    const div = document.createElement('div');
    div.style.cssText = [
        'background:#dbeafe;color:#1e40af;font-weight:700;',
        'padding:3px 6px;font-size:10px;letter-spacing:0.5px;',
        'text-transform:uppercase;border-top:1px solid #bfdbfe;',
        'border-bottom:1px solid #bfdbfe;user-select:none;',
    ].join('');
    div.textContent = text;
    return div;
}

/** Будує назву елемента для панелі ієрархії: "Вікно 1-2" */
function _buildElementName(elItem) {
    const base = ELEMENT_NAMES[elItem.elCode] || elItem.elCode || 'Елемент';
    const from = elItem.lineFrom ?? '?';
    const to   = elItem.lineTo   ?? '?';
    return base + ' ' + from + '-' + to;
}

window.openShapeModalForEdit = function (item) {
    appState.viewingElementMode    = false;
    appState.viewingElementSource  = null;
    appState.viewingElementTransform = null;
    document.getElementById('shapeModal').style.display = 'block';
    G.figureLines = JSON.parse(JSON.stringify(item.figureLines));
    G.shapePoints = JSON.parse(JSON.stringify(item.shapePoints));
    G.roomNumber  = item.roomNumber || '';
    G.isBuilding  = item.type === 'building';
    appState.editingHierarchyItemId = item.id;

    // Відновлюємо лічильники щоб нові лінії/точки не конфліктували з існуючими
    const maxLineId = G.figureLines.reduce((m, l) => Math.max(m, l.id || 0), 0);
    G.lineIdCounter = maxLineId + 1;
    const maxPointNum = G.shapePoints.reduce((m, p) => Math.max(m, p.num || 0), 0);
    G.pointCounter  = maxPointNum;

    redrawEntireFigure();
};

window.createHierarchyItemElement = function (item) {
    const container = document.createElement('div');
    const itemDiv   = document.createElement('div');
    itemDiv.className = 'hierarchy-item' + (G.selectedHierarchyItem === item.id ? ' selected' : '');

    const hasChildren = (item.children || []).length > 0;

    if (hasChildren) {
        const toggle = document.createElement('span');
        toggle.className = 'hierarchy-toggle';
        toggle.textContent = item.expanded ? '▼' : '▶';
        toggle.onclick = (e) => {
            e.stopPropagation();
            item.expanded = !item.expanded;
            renderHierarchy();
        };
        itemDiv.appendChild(toggle);
    } else {
        const spacer = document.createElement('span');
        spacer.style.width = '14px';
        itemDiv.appendChild(spacer);
    }

    const icon = document.createElement('i');
    icon.className = 'fas icon ' + (item.type === 'building' ? 'fa-building' : item.type === 'element' ? 'fa-window-maximize' : item.type === 'contour' ? 'fa-draw-polygon' : item.type === 'construct' ? 'fa-grip-lines' : 'fa-door-open');
    icon.style.color = item.type === 'building' ? '#2196F3' : item.type === 'element' ? '#9C27B0' : item.type === 'contour' ? '#9E9E9E' : item.type === 'construct' ? '#0ea5e9' : '#4CAF50';
    itemDiv.appendChild(icon);

    const label = document.createElement('span');
    label.style.flex = '1';
    label.textContent = item.type === 'element'
        ? _buildElementName(item)
        : (item.roomNumber || item.name);
    itemDiv.appendChild(label);

    const calculatedArea = window._getFigureAreaIncludingBoundFigures(item);
    const displayArea = (item.useCustomArea && item.customArea)
        ? window.formatMeasurement(item.customArea, 1)
        : (calculatedArea ? calculatedArea.toFixed(1) : item.area);
    if (displayArea) {
        const areaLabel = document.createElement('span');
        areaLabel.style.fontSize = '10px';
        areaLabel.style.color    = item.useCustomArea && item.customArea ? '#FF9800' : '#999';
        areaLabel.title = item.useCustomArea && item.customArea ? "Редагована площа" : "Реальна площа";
        areaLabel.textContent    = `${displayArea}м²`;
        itemDiv.appendChild(areaLabel);
    }

    // Одиночний клік — виділення
    itemDiv.onclick = () => selectHierarchyItem(item);

    // Подвійний клік — відкрити редактор фігури (тільки для кімнат і будівель)
    if (item.type !== 'element') {
        itemDiv.ondblclick = (e) => {
            e.stopPropagation();
            openShapeModalForEdit(item);
        };
    }

    container.appendChild(itemDiv);

    if (item.expanded) {
        if (hasChildren) {
            const childWrap = document.createElement('div');
            childWrap.className = 'hierarchy-children';
            item.children.forEach(child => childWrap.appendChild(createHierarchyItemElement(child)));
            container.appendChild(childWrap);
        }
    }

    return container;
};
