/**
 * core-state.js — Константи, централізований стан і toast-повідомлення.
 */

/* ── Глобальні константи застосунку ── */
const APP_VERSION = 'v0.8.54';
window.APP_VERSION = APP_VERSION;
const SCALE = 50;
const A4_OFFSET = 50;
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const START_X = 400;
const START_Y = 300;
const ELEMENT_THICKNESS = 0.20;

const FONT_MM_TO_PX = 5;
const DEFAULT_FONT_SIZE_MM = 3.5;
const DEBUG = false;

window.normalizeMeasurement = function (value, precision) {
    precision = precision == null ? 2 : precision;
    const text = String(value).trim().replace(',', '.');
    if (!text) return NaN;
    const number = Number(text);
    if (!Number.isFinite(number)) return NaN;
    const magnitude = Math.abs(number);
    const factor = Math.pow(10, precision);
    const rounded = Math.sign(number) *
        Math.round((magnitude + Number.EPSILON * Math.max(1, magnitude)) * factor) / factor;
    return rounded;
};

window.formatMeasurement = function (value, precision) {
    precision = precision == null ? 2 : precision;
    const number = window.normalizeMeasurement(value, precision);
    return Number.isFinite(number) ? number.toFixed(precision) : '';
};

window.limitMeasurementInput = function (value, precision) {
    precision = precision == null ? 2 : precision;
    const text = String(value).replace(/,/g, '.');
    const negative = text.trim().startsWith('-');
    const digits = text.replace(/[^0-9.]/g, '');
    const decimalIndex = digits.indexOf('.');
    const whole = decimalIndex === -1 ? digits : digits.slice(0, decimalIndex);
    const rawFraction = decimalIndex === -1
        ? ''
        : digits.slice(decimalIndex + 1).replace(/\./g, '');
    if (rawFraction.length > precision) {
        const candidate = (negative ? '-' : '') + (whole || '0') + '.' + rawFraction;
        const number = window.normalizeMeasurement(candidate, precision);
        return Number.isFinite(number) ? number.toFixed(precision) : '';
    }
    const fraction = decimalIndex === -1
        ? ''
        : rawFraction.slice(0, precision);
    return (negative ? '-' : '') + whole + (decimalIndex === -1 ? '' : '.' + fraction);
};

/* ── Централізований стан застосунку ── */
const appState = {
    isClosingLine: false,
    editingLineId: null,
    editingHierarchyItemId: null,
    calculatedArea: null,
    viewingElementMode: false,
    viewingElementSource: null,
    viewingElementTransform: null,
    editingElementThickness: ELEMENT_THICKNESS,
    editingElementAnchor: '',
    editingElementAnchorParsed: null,
    _addingElementLine: false,
    customArea: null,
};

/* ── Глобальний змінний стан ── */
window.G = {
    isWebCodeApp: navigator.userAgent.toLowerCase().includes('web code'),
    isAndroid: /Android/i.test(navigator.userAgent),
    isLocalFile: window.location.protocol === 'file:',

    dimensionsOutside: false,
    isBuilding: false,
    roomNumber: '',

    roomNumberInputValue: '',
    roomNumberInputFocused: false,
    roomNumberInputSelectionStart: 0,
    roomNumberInputSelectionEnd: 0,

    figureLines: [],
    lineIdCounter: 1,
    pointCounter: 1,

    pendingFreeLines: [],
    freeLineQuadrant: null,

    hierarchyData: [],
    hierarchyIdCounter: 1,
    selectedHierarchyItem: null,

    currentAngle: 'up',
    currentLineType: 'line',
    selectedElement: null,

    diagonals: [],

    shapePoints: [{ x: START_X, y: START_Y, num: 1 }],

    elementEditorLines: [],
    elementEditorPoints: [{ x: START_X, y: START_Y, num: 1 }],
    elementEditorCounter: 1,
};

/* ── Toast-повідомлення ── */
(function () {
    let container = null;

    function ensureContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }

    window.showToast = function (message, type = 'info', duration = 3000) {
        ensureContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    };
})();
