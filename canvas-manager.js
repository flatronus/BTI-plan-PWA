/**
 * canvas-manager.js — Керування полотнами (вкладки, zoom, збереження).
 * Залежності: core-state.js, svg-primitives.js
 */

/* ── Внутрішні хелпери ── */
function _getActiveCanvas() {
    if (!window.canvasManager || !window.canvasManager.activeCanvasId) return null;
    return window.canvasManager.canvases.find(c => c.id === window.canvasManager.activeCanvasId) || null;
}

function _getActiveSvg(canvas) {
    return document.querySelector(`[data-canvas-id="${canvas.id}"] svg`);
}

/* ── canvasManager ── */
window.canvasManager = {
    filePickersBlocked: (function () { try { return window.self !== window.top; } catch (e) { return true; } })(),
    canvases:       [],
    activeCanvasId: null,
    nextId:         1,

    createCanvas() {
        const id = this.nextId++;
        const canvas = {
            id,
            name: `Canvas ${id}`,
            viewBox: { x: 0, y: 0, width: 900, height: 1200 },
            savedPath: null,
            fileHandle: null,
            isDirty: true,
            hierarchyData:      [],
            hierarchyIdCounter: 1
        };
        this.canvases.push(canvas);
        this.renderCanvas(canvas);
        this.renderTab(canvas);
        this.setActiveCanvas(id);
        return canvas;
    },

    renderCanvas(canvas) {
        const container = document.getElementById('canvas-container');
        const wrapper   = document.createElement('div');
        wrapper.className = 'w-full h-full';
        wrapper.style.display = 'none';
        wrapper.setAttribute('data-canvas-id', canvas.id);

        wrapper.innerHTML = `
            <svg class="w-full h-full bg-[#e6f2ff]"
                 viewBox="${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}"
                 preserveAspectRatio="xMidYMid meet">
                <rect
                    x="${A4_OFFSET}" y="${A4_OFFSET}"
                    width="${A4_WIDTH}" height="${A4_HEIGHT}"
                    fill="none" stroke="#1e88e5" stroke-width="2"
                    vector-effect="non-scaling-stroke"
                    class="paper-frame"
                />
            </svg>`;

        container.appendChild(wrapper);
        this.attachCanvasEvents(wrapper.querySelector('svg'), canvas);
        if (window.shapeTransform) {
            window.shapeTransform.attachToSvg(wrapper.querySelector('svg'));
        }
    },

    renderTab(canvas) {
        const tabsContainer = document.getElementById('tabs-container');
        const tab = document.createElement('button');
        tab.className = 'px-4 py-2 text-sm rounded-t hover:bg-white transition bg-gray-50 flex items-center';
        tab.setAttribute('data-tab-id', canvas.id);
        tab.innerHTML = `
            <span></span>
            <i class="fas fa-times ml-2 text-gray-400 hover:text-red-600 cursor-pointer"
               onclick="event.stopPropagation(); window.canvasManager.closeCanvas(${canvas.id})"
               style="min-width: 16px;"></i>`;
        tab.querySelector('span').textContent = canvas.name;
        tab.onclick = () => this.setActiveCanvas(canvas.id);
        tabsContainer.appendChild(tab);
    },

    renameCanvasFromFile(canvas, fileName) {
        if (!canvas || !fileName) return;
        const displayName = fileName.replace(/\.svg$/i, '');
        canvas.name = displayName;
        canvas.fullName = displayName;
        canvas.savedPath = fileName;

        const tab = document.querySelector(`[data-tab-id="${canvas.id}"]`);
        const title = tab?.querySelector('span');
        if (title) title.textContent = displayName;
    },

    setActiveCanvas(id) {
        if (this.activeCanvasId !== null) {
            const prev = this.canvases.find(c => c.id === this.activeCanvasId);
            if (prev) {
                prev.hierarchyData      = G.hierarchyData;
                prev.hierarchyIdCounter = G.hierarchyIdCounter;
            }
        }

        this.activeCanvasId = id;

        const next = this.canvases.find(c => c.id === id);
        if (next) {
            G.hierarchyData      = next.hierarchyData      || [];
            G.hierarchyIdCounter = next.hierarchyIdCounter || 1;
        }

        document.querySelectorAll('[data-canvas-id]').forEach(el => {
            el.style.display = 'none';
        });

        const activeEl = document.querySelector(`[data-canvas-id="${id}"]`);
        if (activeEl) activeEl.style.display = 'block';

        document.querySelectorAll('[data-tab-id]').forEach(tab => {
            const isActive = parseInt(tab.getAttribute('data-tab-id')) === id;
            tab.classList.toggle('bg-white',        isActive);
            tab.classList.toggle('border-t-2',      isActive);
            tab.classList.toggle('border-blue-600', isActive);
            tab.classList.toggle('bg-gray-50',      !isActive);
        });

        window.svg = activeEl ? activeEl.querySelector('svg') : null;

        G.selectedHierarchyItem = null;
        renderHierarchy();
    },

    openCanvas() {
        this.openFileDialog();
    },

    openFileDialog() {
        const self = this;

        if ('showOpenFilePicker' in window && !this.filePickersBlocked) {
            (async function () {
                let handle = null;
                try {
                    const handles = await window.showOpenFilePicker({
                        types: [{ description: 'SVG Files', accept: { 'image/svg+xml': ['.svg'] } }],
                        multiple: false
                    });
                    handle = handles && handles[0];
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                    self.filePickersBlocked = true;
                    showToast('Натисніть «Відкрити» ще раз', 'info');
                    return;
                }
                if (!handle) return;
                try {
                    const file = await handle.getFile();
                    const content = await file.text();
                    self.loadSvgFromContent(content, file.name, handle);
                } catch (err) {
                    console.error(err);
                    showToast('Помилка відкриття: ' + (err.message || err.name), 'error', 6000);
                }
            })();
            return;
        }

        this.openFileViaInput();
    },

    openFileViaInput() {
        const self = this;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.svg,image/svg+xml';
        input.style.display = 'none';

        input.addEventListener('change', function (event) {
            const file = event.target.files && event.target.files[0];
            input.remove();
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function () {
                try {
                    self.loadSvgFromContent(String(reader.result || ''), file.name, null);
                } catch (err) {
                    showToast('Помилка відкриття: ' + (err.message || err.name), 'error');
                }
            };
            reader.onerror = function () {
                showToast('Не вдалося прочитати SVG-файл', 'error');
            };
            reader.readAsText(file);
        }, { once: true });
        input.addEventListener('cancel', function () { input.remove(); }, { once: true });

        document.body.appendChild(input);
        input.click();
    },

    loadSvgFromContent(svgContent, name, fileHandle) {
        const cleanContent = String(svgContent || '').replace(/^\uFEFF/, '');
        let importedSvg = null;
        try {
            const xmlDoc = new DOMParser().parseFromString(cleanContent, 'image/svg+xml');
            if (!xmlDoc.querySelector('parsererror') && xmlDoc.documentElement &&
                xmlDoc.documentElement.nodeName.toLowerCase() === 'svg' &&
                xmlDoc.documentElement.namespaceURI === 'http://www.w3.org/2000/svg') {
                importedSvg = xmlDoc.documentElement;
            }
        } catch (error) {
            importedSvg = null;
        }
        if (!importedSvg) {
            const temp = document.createElement('div');
            temp.innerHTML = cleanContent;
            importedSvg = temp.querySelector('svg');
        }
        if (!importedSvg) {
            showToast('Невірний SVG-файл', 'error');
            return;
        }

        const viewBox = importedSvg.getAttribute('viewBox');
        const values = viewBox ? viewBox.split(/[\s,]+/).map(Number) : [];
        const [x, y, width, height] = values.length === 4 ? values : [0, 0, 900, 1200];

        let loadedHierarchy = [];
        let loadedIdCounter = 1;
        const metaEl = importedSvg.querySelector('metadata[data-bti]');
        if (metaEl) {
            try {
                const meta = JSON.parse(metaEl.textContent);
                loadedHierarchy = Array.isArray(meta.hierarchyData) ? meta.hierarchyData : [];
                loadedIdCounter = Number(meta.hierarchyIdCounter) || 1;
            } catch (error) {
                loadedHierarchy = [];
            }
        }

        const canvas = this.createCanvas();
        const fileName = String(name || `Canvas ${canvas.id}`).replace(/\.svg$/i, '');
        canvas.name = fileName;
        canvas.fullName = fileName;
        canvas.savedPath = fileHandle ? fileHandle.name : `${fileName}.svg`;
        canvas.fileHandle = fileHandle || null;
        canvas.isDirty = false;
        canvas.viewBox = { x, y, width, height };
        canvas.hierarchyData = loadedHierarchy;
        canvas.hierarchyIdCounter = loadedIdCounter;

        const wrapper = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
        const oldSvg = wrapper ? wrapper.querySelector('svg') : null;
        if (!wrapper || !oldSvg) {
            showToast('Не вдалося створити полотно вкладки', 'error');
            return;
        }

        for (const attribute of Array.from(oldSvg.attributes)) {
            oldSvg.removeAttribute(attribute.name);
        }
        oldSvg.setAttribute('class', 'w-full h-full bg-[#e6f2ff]');
        oldSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        oldSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        oldSvg.replaceChildren();
        for (const child of Array.from(importedSvg.childNodes)) {
            oldSvg.appendChild(document.importNode(child, true));
        }
        G.hierarchyData = loadedHierarchy;
        G.hierarchyIdCounter = loadedIdCounter;
        G.selectedHierarchyItem = null;
        this.setActiveCanvas(canvas.id);
        this.renameCanvasFromFile(canvas, canvas.savedPath);

        if (canvas.hierarchyData.length > 0) try {
            const hierarchyWrapper = document.querySelector(`[data-canvas-id="${canvas.id}"]`);
            const svgDom  = hierarchyWrapper ? hierarchyWrapper.querySelector('svg') : null;
            if (svgDom) {
                G.hierarchyData = canvas.hierarchyData;
                G.hierarchyIdCounter = canvas.hierarchyIdCounter;

                function reattachGroups(items, parentGroup) {
                    (items || []).forEach(function(item) {
                        if (item.id != null) {
                            const g = svgDom.querySelector(`[data-hierarchy-id="${item.id}"]`);
                            if (g) {
                                item.svgGroup = g;
                            } else if (item.type !== 'element') {
                                const newGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                                newGroup.setAttribute('data-hierarchy-id', item.id);
                                (parentGroup || svgDom).appendChild(newGroup);
                                item.svgGroup = newGroup;
                            }
                        }
                        reattachGroups(item.children, item.svgGroup || parentGroup);
                    });
                }
                reattachGroups(canvas.hierarchyData);

                const savedFigureLines = G.figureLines;
                const savedShapePoints = G.shapePoints;
                const savedRoomNumber = G.roomNumber;
                const savedIsBuilding = G.isBuilding;

                function rebuildGroups(items) {
                    (items || []).forEach(function(item) {
                        if (item.type !== 'element' && item.svgGroup && item.figureLines && item.shapePoints) {
                            const group = item.svgGroup;
                            const savedTransform = group.getAttribute('transform');
                            Array.from(group.children).forEach(function (child) {
                                if (!(child.tagName === 'g' && child.hasAttribute('data-hierarchy-id'))) {
                                    child.remove();
                                }
                            });

                            G.figureLines = item.figureLines;
                            G.shapePoints = item.shapePoints;
                            G.roomNumber = item.roomNumber || '';
                            G.isBuilding = item.type === 'building';
                            const offsetX = Number.isFinite(Number(item._offsetX)) ? Number(item._offsetX) : 0;
                            const offsetY = Number.isFinite(Number(item._offsetY)) ? Number(item._offsetY) : 0;
                            if (typeof window._fillSvgGroup === 'function') {
                                window._fillSvgGroup(group, offsetX, offsetY, item);
                            }
                            if (savedTransform) group.setAttribute('transform', savedTransform);
                        }
                        rebuildGroups(item.children);
                    });
                }
                rebuildGroups(canvas.hierarchyData);

                G.figureLines = savedFigureLines;
                G.shapePoints = savedShapePoints;
                G.roomNumber = savedRoomNumber;
                G.isBuilding = savedIsBuilding;
            }
            G.hierarchyData      = canvas.hierarchyData;
            G.hierarchyIdCounter = canvas.hierarchyIdCounter;
            renderHierarchy();
        } catch (error) {
            console.error(error);
            showToast('Файл відкрито, але елементи відновлено не повністю: ' + (error.message || error.name), 'warning', 6000);
            return;
        }
        showToast(`Відкрито файл: ${name}`, 'success');
    },

    renderImportedCanvas(canvas, svgContent) {
        const container = document.getElementById('canvas-container');
        const wrapper   = document.createElement('div');
        wrapper.className = 'w-full h-full';
        wrapper.style.display = 'none';
        wrapper.setAttribute('data-canvas-id', canvas.id);
        wrapper.replaceChildren();
        if (typeof svgContent === 'string') {
            wrapper.innerHTML = svgContent;
        } else if (svgContent && svgContent.nodeType === 1) {
            wrapper.appendChild(document.importNode(svgContent, true));
        }
        container.appendChild(wrapper);
        this.attachCanvasEvents(wrapper.querySelector('svg'), canvas);
        if (window.shapeTransform) {
            window.shapeTransform.attachToSvg(wrapper.querySelector('svg'));
        }
    },

    closeCanvas(id) {
        if (this.canvases.length <= 1) {
            showToast('Не можна закрити єдине полотно', 'warning');
            return;
        }
        this.canvases = this.canvases.filter(c => c.id !== id);
        document.querySelector(`[data-canvas-id="${id}"]`)?.remove();
        document.querySelector(`[data-tab-id="${id}"]`)?.remove();
        if (this.activeCanvasId === id) this.setActiveCanvas(this.canvases[0].id);
    },

    saveCanvas(id) {
        const canvas   = this.canvases.find(c => c.id === id);
        if (!canvas) return;
        const canvasEl = document.querySelector(`[data-canvas-id="${id}"]`);
        const svgEl    = canvasEl.querySelector('svg');

        const hierarchySnapshot = (id === this.activeCanvasId)
            ? G.hierarchyData : (canvas.hierarchyData || []);

        function stripDom(items) {
            return (items || []).map(function(item) {
                const clean = {};
                for (const k in item) {
                    if (k === 'svgGroup') continue;
                    if (k === 'children') { clean.children = stripDom(item.children); continue; }
                    clean[k] = item[k];
                }
                return clean;
            });
        }
        const metaJson = window.safeStringify({
            hierarchyData:      stripDom(hierarchySnapshot),
            hierarchyIdCounter: (id === this.activeCanvasId) ? G.hierarchyIdCounter : (canvas.hierarchyIdCounter || 1)
        });

        let existMeta = svgEl.querySelector('metadata[data-bti]');
        if (!existMeta) {
            existMeta = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
            existMeta.setAttribute('data-bti', '1');
            svgEl.insertBefore(existMeta, svgEl.firstChild);
        }
        existMeta.textContent = metaJson;

        const blob = new Blob([window.serializeSvgForFile(svgEl)], { type: 'image/svg+xml;charset=utf-8' });
        if ('showSaveFilePicker' in window && !this.filePickersBlocked) {
            this.saveWithFilePicker(canvas, blob);
        } else {
            this.saveWithDownload(canvas, blob);
        }
    },

    async saveWithFilePicker(canvas, blob) {
        try {
            if (canvas.fileHandle) {
                const writable = await canvas.fileHandle.createWritable({ keepExistingData: false });
                await writable.write(blob);
                await writable.close();
                this.renameCanvasFromFile(canvas, canvas.fileHandle.name);
                canvas.isDirty = false;
                showToast(`Збережено: ${canvas.savedPath}`, 'success');
                return;
            }

            let fileName = canvas.savedPath || `${canvas.name}.svg`;
            if (!/\.svg$/i.test(fileName)) fileName += '.svg';
            const handle   = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'SVG Files', accept: { 'image/svg+xml': ['.svg'] } }]
            });
            const writable = await handle.createWritable({ keepExistingData: false });
            await writable.write(blob);
            await writable.close();
            const savedName = /\.svg$/i.test(handle.name) ? handle.name : `${handle.name}.svg`;
            this.renameCanvasFromFile(canvas, savedName);
            canvas.fileHandle = handle;
            canvas.isDirty = false;
            showToast(`Збережено: ${canvas.savedPath}`, 'success');
        } catch (err) {
            if (err.name === 'AbortError') return;
            canvas.fileHandle = null;
            this.filePickersBlocked = true;
            this.saveWithDownload(canvas, blob);
        }
    },

    async saveAsCanvas(id) {
        const canvas = this.canvases.find(c => c.id === id);
        if (!canvas) return;
        const canvasEl = document.querySelector(`[data-canvas-id="${id}"]`);
        const svgEl = canvasEl?.querySelector('svg');
        if (!svgEl) return;

        function stripDom(items) {
            return (items || []).map(function (item) {
                const clean = {};
                for (const key in item) {
                    if (key === 'svgGroup') continue;
                    if (key === 'children') {
                        clean.children = stripDom(item.children);
                        continue;
                    }
                    clean[key] = item[key];
                }
                return clean;
            });
        }
        const hierarchyData = (id === this.activeCanvasId)
            ? G.hierarchyData : (canvas.hierarchyData || []);
        const hierarchyIdCounter = (id === this.activeCanvasId)
            ? G.hierarchyIdCounter : (canvas.hierarchyIdCounter || 1);
        let existMeta = svgEl.querySelector('metadata[data-bti]');
        if (!existMeta) {
            existMeta = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
            existMeta.setAttribute('data-bti', '1');
            svgEl.insertBefore(existMeta, svgEl.firstChild);
        }
        existMeta.textContent = window.safeStringify({
            hierarchyData: stripDom(hierarchyData),
            hierarchyIdCounter
        });

        const self = this;
        const askAndDownload = function () {
            const blob = new Blob([window.serializeSvgForFile(svgEl)], { type: 'image/svg+xml;charset=utf-8' });
            self.askFileName(canvas.savedPath || `${canvas.name}.svg`, function (fileName) {
                self.downloadBlob(canvas, blob, fileName);
            });
        };

        if (!('showSaveFilePicker' in window) || this.filePickersBlocked) {
            askAndDownload();
            return;
        }

        let suggestedName = canvas.savedPath || `${canvas.name}.svg`;
        if (!/\.svg$/i.test(suggestedName)) suggestedName += '.svg';

        try {
            const handle = await window.showSaveFilePicker({
                suggestedName,
                types: [{ description: 'SVG Files', accept: { 'image/svg+xml': ['.svg'] } }]
            });
            const writable = await handle.createWritable({ keepExistingData: false });
            await writable.write(new Blob([window.serializeSvgForFile(svgEl)], { type: 'image/svg+xml;charset=utf-8' }));
            await writable.close();
            const savedName = /\.svg$/i.test(handle.name) ? handle.name : `${handle.name}.svg`;
            this.renameCanvasFromFile(canvas, savedName);
            canvas.fileHandle = handle;
            canvas.isDirty = false;
            showToast(`Збережено як: ${savedName}`, 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                this.filePickersBlocked = true;
                askAndDownload();
            }
        }
    },

    showCopyModal(svgContent, fileName) {
        document.getElementById('svgCode').value          = svgContent;
        document.getElementById('modalTitle').textContent = `Скопіювати код для "${fileName}"`;
        document.getElementById('copyModal').style.display = 'block';
    },

    saveWithDownload(canvas, blob) {
        const self = this;
        const doDownload = function (fileName) {
            try {
                if (!/\.svg$/i.test(fileName)) fileName += '.svg';
                const url  = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = fileName; link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 1000);
                self.renameCanvasFromFile(canvas, fileName);
                canvas.isDirty = false;
                showToast(`Файл збережено: ${fileName}`, 'success');
            } catch (err) {
                showToast('Помилка збереження: ' + err.message, 'error');
            }
        };
        if (canvas.savedPath) doDownload(canvas.savedPath);
        else this.askFileName(`${canvas.name}.svg`, doDownload);
    },

    /** Діалог введення імені файла; onConfirm викликається в обробнику кліку користувача */
    askFileName(defaultName, onConfirm) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:8px;padding:16px;width:90%;max-width:380px;box-shadow:0 8px 24px rgba(0,0,0,0.3);';
        const title = document.createElement('div');
        title.textContent = 'Зберегти як';
        title.style.cssText = 'font-weight:bold;margin-bottom:10px;';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultName;
        input.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;font-size:16px;border:1px solid #ccc;border-radius:4px;margin-bottom:12px;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
        const ok = document.createElement('button');
        ok.textContent = 'Зберегти';
        ok.style.cssText = 'padding:8px 16px;background:#4CAF50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;';
        const cancel = document.createElement('button');
        cancel.textContent = 'Скасувати';
        cancel.style.cssText = 'padding:8px 16px;background:#9E9E9E;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;';
        const close = function () { overlay.remove(); };
        const confirm = function () {
            const name = input.value.trim().replace(/[\\/:*?"<>|]/g, '_');
            if (!name) return;
            close();
            onConfirm(name);
        };
        ok.onclick = confirm;
        cancel.onclick = close;
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            else if (e.key === 'Escape') close();
        });
        row.appendChild(cancel); row.appendChild(ok);
        box.appendChild(title); box.appendChild(input); box.appendChild(row);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
        input.setSelectionRange(0, input.value.replace(/\.svg$/i, '').length);
    },

    downloadBlob(canvas, blob, fileName) {
        const normalizedName = /\.svg$/i.test(fileName) ? fileName : `${fileName}.svg`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = normalizedName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 1000);
        this.renameCanvasFromFile(canvas, normalizedName);
        canvas.fileHandle = null;
        canvas.isDirty = false;
        showToast(`Збережено як: ${normalizedName}`, 'success');
    },

    attachCanvasEvents(svgElement, canvas) {
        let isDragging = false, startX, startY;
        let initialDistance = 0, initialViewBox = null;

        // Перевіряє чи активний режим трансформації (не drag полотна)
        const _isTransformMode = () =>
            window.shapeTransform && window.shapeTransform.getMode() !== 'pan';

        svgElement.addEventListener('mousedown', (e) => {
            if (e.button === 0 && !_isTransformMode()) {
                isDragging = true; startX = e.clientX; startY = e.clientY;
                svgElement.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging || _isTransformMode()) return;
            const dx = (startX - e.clientX) * (canvas.viewBox.width  / svgElement.clientWidth);
            const dy = (startY - e.clientY) * (canvas.viewBox.height / svgElement.clientHeight);
            canvas.viewBox.x += dx; canvas.viewBox.y += dy;
            svgElement.setAttribute('viewBox',
                `${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}`);
            startX = e.clientX; startY = e.clientY;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            if (!_isTransformMode()) svgElement.style.cursor = 'grab';
        });

        svgElement.addEventListener('touchstart', (e) => {
            if (_isTransformMode()) return;
            if (e.touches.length === 1) {
                isDragging = true; startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                isDragging = false;
                initialDistance = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                initialViewBox = { ...canvas.viewBox };
            }
        });

        svgElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                const dx = (startX - e.touches[0].clientX) * (canvas.viewBox.width  / svgElement.clientWidth);
                const dy = (startY - e.touches[0].clientY) * (canvas.viewBox.height / svgElement.clientHeight);
                canvas.viewBox.x += dx; canvas.viewBox.y += dy;
                svgElement.setAttribute('viewBox',
                    `${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}`);
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            } else if (e.touches.length === 2 && initialDistance > 0) {
                const currentDist = Math.hypot(
                    e.touches[1].clientX - e.touches[0].clientX,
                    e.touches[1].clientY - e.touches[0].clientY
                );
                const scale = initialDistance / currentDist;
                canvas.viewBox.width  = Math.max(200, Math.min(5000, initialViewBox.width  * scale));
                canvas.viewBox.height = Math.max(200, Math.min(5000, initialViewBox.height * scale));
                svgElement.setAttribute('viewBox',
                    `${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}`);
            }
        });

        svgElement.addEventListener('touchend', () => { isDragging = false; initialDistance = 0; });

        svgElement.style.cursor = 'grab';
        if (/Android|iPhone|iPad/.test(navigator.userAgent)) svgElement.style.touchAction = 'none';
    }
};

/* ── Zoom ── */
window.zoomIn = function () {
    const canvas = _getActiveCanvas(); if (!canvas) return;
    const svgEl  = _getActiveSvg(canvas); if (!svgEl) return;
    canvas.viewBox.width  *= 0.9; canvas.viewBox.height *= 0.9;
    canvas.viewBox.x += canvas.viewBox.width  * 0.05;
    canvas.viewBox.y += canvas.viewBox.height * 0.05;
    svgEl.setAttribute('viewBox',
        `${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}`);
};

window.zoomOut = function () {
    const canvas = _getActiveCanvas(); if (!canvas) return;
    const svgEl  = _getActiveSvg(canvas); if (!svgEl) return;
    canvas.viewBox.width  *= 1.1; canvas.viewBox.height *= 1.1;
    canvas.viewBox.x -= canvas.viewBox.width  * 0.045;
    canvas.viewBox.y -= canvas.viewBox.height * 0.045;
    svgEl.setAttribute('viewBox',
        `${canvas.viewBox.x} ${canvas.viewBox.y} ${canvas.viewBox.width} ${canvas.viewBox.height}`);
};

/* ── Безпечний JSON: без DOM-вузлів, функцій і циклічних посилань ── */
window.safeStringify = function (value) {
    const stack = [];
    return JSON.stringify(value, function (key, item) {
        if (typeof item === 'function') return undefined;
        if (item && typeof item === 'object') {
            if (item.nodeType) return undefined;
            while (stack.length && stack[stack.length - 1] !== this) stack.pop();
            if (stack.includes(item)) return undefined;
            stack.push(item);
        }
        return item;
    });
};

/* ── Серіалізація SVG для файла (з xmlns) ── */
window.serializeSvgForFile = function (svgEl) {
    const text = new XMLSerializer().serializeToString(svgEl);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + text;
};

/* ── Збереження активного полотна ── */
window.saveActiveCanvas = function () {
    try {
        const canvas = _getActiveCanvas();
        if (canvas) window.canvasManager.saveCanvas(canvas.id);
    } catch (err) {
        console.error(err);
        showToast('Помилка збереження: ' + (err.message || err.name), 'error', 6000);
    }
};

window.openCanvasFile = function () {
    try {
        if (!window.canvasManager) {
            showToast('Менеджер полотна не готовий', 'error');
            return;
        }
        window.canvasManager.openFileDialog();
    } catch (err) {
        console.error(err);
        showToast('Помилка відкриття: ' + (err.message || err.name), 'error', 6000);
    }
};

window.saveActiveCanvasAs = function () {
    try {
        const canvas = _getActiveCanvas();
        if (canvas) {
            Promise.resolve(window.canvasManager.saveAsCanvas(canvas.id)).catch(function (err) {
                console.error(err);
                showToast('Помилка збереження: ' + (err.message || err.name), 'error', 6000);
            });
        }
    } catch (err) {
        console.error(err);
        showToast('Помилка збереження: ' + (err.message || err.name), 'error', 6000);
    }
};

/* ── Модалка копіювання SVG ── */
window.copySvgCode = function () {
    const textarea = document.getElementById('svgCode');
    textarea.select(); textarea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textarea.value)
        .then(() => showToast('Скопійовано в буфер обміну!', 'success'))
        .catch(() => { document.execCommand('copy'); showToast('Скопійовано (резервний метод)!', 'success'); });
};

window.closeModal = function () {
    document.getElementById('copyModal').style.display = 'none';
};
