/**
 * history.js — Журнал скасування та повторення змін.
 */

(function () {
    const undoStack = [];
    const redoStack = [];
    let pendingBefore = null;
    let finalizing = false;
    let restoring = false;

    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value, function (key, item) {
            if (item && typeof item === 'object' && item.nodeType) return undefined;
            return item;
        }));
    }

    function snapshot() {
        const currentAppState = typeof appState !== 'undefined' ? appState : {};
        const canvases = (window.canvasManager?.canvases || []).map(function (canvas) {
            const wrapper = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
            const svg = wrapper ? wrapper.querySelector('svg') : null;
            const isActive = canvas.id === window.canvasManager?.activeCanvasId;
            return {
                id: canvas.id,
                name: canvas.name,
                fullName: canvas.fullName,
                viewBox: cloneJson(canvas.viewBox),
                savedPath: canvas.savedPath,
                hierarchyData: cloneJson(isActive ? (window.G?.hierarchyData || []) : (canvas.hierarchyData || [])),
                hierarchyIdCounter: isActive ? (window.G?.hierarchyIdCounter || 1) : (canvas.hierarchyIdCounter || 1),
                svg: svg ? svg.outerHTML : null
            };
        });

        return {
            activeCanvasId: window.canvasManager?.activeCanvasId ?? null,
            nextId: window.canvasManager?.nextId ?? 1,
            g: cloneJson(window.G || {}),
            appState: cloneJson(currentAppState),
            canvases
        };
    }

    function signature(state) {
        return JSON.stringify(state);
    }

    function reattachCanvas(wrapper, canvas) {
        if (!wrapper) return;
        const svg = wrapper.querySelector('svg');
        if (!svg) return;
        window.canvasManager.attachCanvasEvents(svg, canvas);
        if (window.shapeTransform) window.shapeTransform.attachToSvg(svg);
    }

    function restoreHierarchyReferences(items, svg) {
        (items || []).forEach(function (item) {
            if (item.id != null && svg) {
                item.svgGroup = svg.querySelector(`[data-hierarchy-id="${item.id}"]`) || null;
            }
            restoreHierarchyReferences(item.children, svg);
        });
    }

    function restore(state) {
        if (!state || !window.canvasManager) return;
        restoring = true;

        window.canvasManager.nextId = state.nextId;

        window.canvasManager.canvases.slice().forEach(function (canvas) {
            if (state.canvases.some(function (savedCanvas) { return savedCanvas.id === canvas.id; })) return;
            const wrapper = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
            if (wrapper) wrapper.remove();
            const tab = document.querySelector(`[data-tab-id="${canvas.id}"]`);
            if (tab) tab.remove();
            window.canvasManager.canvases.splice(window.canvasManager.canvases.indexOf(canvas), 1);
        });

        state.canvases.forEach(function (savedCanvas) {
            let canvas = window.canvasManager.canvases.find(function (item) {
                return item.id === savedCanvas.id;
            });
            if (!canvas) {
                canvas = {
                    id: savedCanvas.id,
                    name: savedCanvas.name,
                    fullName: savedCanvas.fullName,
                    viewBox: cloneJson(savedCanvas.viewBox),
                    savedPath: savedCanvas.savedPath,
                    hierarchyData: [],
                    hierarchyIdCounter: 1
                };
                window.canvasManager.canvases.push(canvas);
                const container = document.getElementById('canvas-container');
                if (container) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'w-full h-full';
                    wrapper.style.display = 'none';
                    wrapper.setAttribute('data-canvas-id', canvas.id);
                    wrapper.innerHTML = savedCanvas.svg || '';
                    container.appendChild(wrapper);
                    window.canvasManager.renderTab(canvas);
                    reattachCanvas(wrapper, canvas);
                }
            }

            canvas.name = savedCanvas.name;
            canvas.fullName = savedCanvas.fullName;
            canvas.viewBox = cloneJson(savedCanvas.viewBox);
            canvas.savedPath = savedCanvas.savedPath;
            canvas.hierarchyData = cloneJson(savedCanvas.hierarchyData);
            canvas.hierarchyIdCounter = savedCanvas.hierarchyIdCounter;

            const wrapper = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
            if (wrapper && savedCanvas.svg) {
                wrapper.innerHTML = savedCanvas.svg;
                reattachCanvas(wrapper, canvas);
                restoreHierarchyReferences(canvas.hierarchyData, wrapper.querySelector('svg'));
            }
        });

        Object.keys(window.G).forEach(function (key) {
            delete window.G[key];
        });
        Object.assign(window.G, cloneJson(state.g));

        if (typeof appState !== 'undefined') {
            Object.keys(appState).forEach(function (key) {
                delete appState[key];
            });
            Object.assign(appState, cloneJson(state.appState));
        }

        const active = window.canvasManager.canvases.find(function (canvas) {
            return canvas.id === state.activeCanvasId;
        });
        if (active) {
            window.canvasManager.activeCanvasId = active.id;
            document.querySelectorAll('[data-canvas-id]').forEach(function (el) {
                el.style.display = el.getAttribute('data-canvas-id') === String(active.id) ? 'block' : 'none';
            });
            document.querySelectorAll('[data-tab-id]').forEach(function (tab) {
                const isActive = parseInt(tab.getAttribute('data-tab-id')) === active.id;
                tab.classList.toggle('bg-white', isActive);
                tab.classList.toggle('border-t-2', isActive);
                tab.classList.toggle('border-blue-600', isActive);
                tab.classList.toggle('bg-gray-50', !isActive);
            });
            window.svg = document.querySelector(`[data-canvas-id="${active.id}"] svg`);
            const activeWrapper = document.querySelector(`[data-canvas-id="${active.id}"]`);
            if (activeWrapper) {
                const activeSvg = activeWrapper.querySelector('svg');
                restoreHierarchyReferences(active.hierarchyData, activeSvg);
                window.svg = activeSvg;
            }
            G.hierarchyData = cloneJson(active.hierarchyData || []);
            G.hierarchyIdCounter = active.hierarchyIdCounter || 1;
            restoreHierarchyReferences(G.hierarchyData, activeWrapper ? activeWrapper.querySelector('svg') : null);
            active.hierarchyData = G.hierarchyData;
            active.hierarchyIdCounter = G.hierarchyIdCounter;
        }

        if (typeof renderHierarchy === 'function') renderHierarchy();
        if (typeof renderProperties === 'function') renderProperties(G.selectedHierarchyItem ? findHierarchyItemById(G.selectedHierarchyItem) : null);
        if (typeof redrawEntireFigure === 'function') redrawEntireFigure();
        if (typeof renderLinesPanel === 'function') renderLinesPanel();
        restoring = false;
        updateButtons();
    }

    function finalizeCapture() {
        if (!pendingBefore || finalizing || restoring) return;
        finalizing = true;
        setTimeout(function () {
            const after = snapshot();
            if (signature(pendingBefore) !== signature(after)) {
                undoStack.push(pendingBefore);
                if (undoStack.length > 100) undoStack.shift();
                redoStack.length = 0;
            }
            pendingBefore = null;
            finalizing = false;
            updateButtons();
        }, 0);
    }

    function captureMutationStart() {
        if (pendingBefore) return;
        pendingBefore = snapshot();
    }

    function updateButtons() {
        const undoButton = document.getElementById('btn-history-undo');
        const redoButton = document.getElementById('btn-history-redo');
        if (undoButton) undoButton.disabled = undoStack.length === 0;
        if (redoButton) redoButton.disabled = redoStack.length === 0;
    }

    function isHistoryButton(target) {
        return Boolean(target && target.closest && target.closest('#btn-history-undo, #btn-history-redo'));
    }

    window.undoLastAction = function () {
        if (undoStack.length === 0) {
            showToast && showToast('Немає дій для скасування', 'warning');
            return;
        }
        const current = snapshot();
        const previous = undoStack.pop();
        redoStack.push(current);
        restore(previous);
        showToast && showToast('Останню дію скасовано', 'success');
    };

    window.redoLastAction = function () {
        if (redoStack.length === 0) {
            showToast && showToast('Немає дій для повернення', 'warning');
            return;
        }
        const current = snapshot();
        const next = redoStack.pop();
        undoStack.push(current);
        restore(next);
        showToast && showToast('Дію повернено', 'success');
    };

    document.addEventListener('pointerdown', function (event) {
        if (!isHistoryButton(event.target)) captureMutationStart();
    }, true);
    document.addEventListener('pointerup', function (event) {
        if (!isHistoryButton(event.target)) finalizeCapture();
    }, true);
    document.addEventListener('click', function (event) {
        if (isHistoryButton(event.target)) return;
        captureMutationStart();
        finalizeCapture();
    }, true);
    document.addEventListener('change', function () {
        captureMutationStart();
        finalizeCapture();
    }, true);

    document.addEventListener('keydown', function (event) {
        if (!(event.ctrlKey || event.metaKey)) return;
        if (event.key.toLowerCase() === 'z') {
            event.preventDefault();
            if (event.shiftKey) window.redoLastAction();
            else window.undoLastAction();
        } else if (event.key.toLowerCase() === 'y') {
            event.preventDefault();
            window.redoLastAction();
        }
    });

    document.addEventListener('DOMContentLoaded', updateButtons);
})();
