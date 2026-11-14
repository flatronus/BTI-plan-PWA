/**
 * Глобальні константи застосунку
 */

const SCALE = 50;           // 1 метр = 50 пікселів
const A4_OFFSET = 50;       // Відступ рамки A4 від краю SVG
const A4_WIDTH  = 794;      // Ширина аркуша A4 у пікселях
const A4_HEIGHT = 1123;     // Висота аркуша A4 у пікселях
const START_X   = 400;      // X-координата початкової точки фігури
const START_Y   = 300;      // Y-координата початкової точки фігури
const ELEMENT_THICKNESS = 0.20; // Товщина елемента (WI1 тощо) у метрах

// Конвертація шрифту: масштаб 1:100, SCALE=50 px/м → 1 мм паперу = 5 px
const FONT_MM_TO_PX        = 5;     // 1 мм паперового шрифту = 5 SVG-пікселів
const DEFAULT_FONT_SIZE_MM = 3.5;   // Стандарт ЕСКД для масштабу 1:100 (мм)

const DEBUG = false;        // Вмикає налагоджувальні повідомлення в консолі

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
