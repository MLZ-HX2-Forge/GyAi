const Monitor = {
    stream: null,
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    isMonitoring: false,
    recordingStartTime: null,
    recordingTimer: null,
    frameCount: 0,
    lastFrameTime: null,
    fpsInterval: null,
    currentFps: 0,
    devices: [],
    currentDeviceId: null,
    
    detectionMode: 'single',
    isDetecting: false,
    detectionInterval: null,
    detectionIntervalMs: 300,
    confidence: 0.3,
    showBoxes: true,
    showLabels: true,
    saveResults: false,
    availableModels: [],
    selectedModels: [],
    previousModel: null,
    
    detectionCanvas: null,
    detectionCtx: null,
    
    liveDetectionQueue: [],
    maxLiveDetections: 3,
    
    historyPage: 1,
    historyPageSize: 10,
    historyTotal: 0,
    historyTotalPages: 1,
    
    classColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF4500'
    ],
    
    resolutionMap: {
        '4K': { width: 3840, height: 2160 },
        '1080p': { width: 1920, height: 1080 },
        '720p': { width: 1280, height: 720 },
        '480p': { width: 854, height: 480 },
        '360p': { width: 640, height: 360 }
    },
    
    async init() {
        this.detectionCanvas = document.getElementById('detectionCanvas');
        if (this.detectionCanvas) {
            this.detectionCtx = this.detectionCanvas.getContext('2d');
        }
        
        this.bindEvents();
        await this.enumerateDevices();
        await this.loadAvailableModels();
        this.loadSettings();
        this.initCollapseButtons();
    },
    
    initCollapseButtons() {
        const aiControlHeader = document.getElementById('aiControlHeader');
        const aiControlContent = document.getElementById('aiControlContent');
        const aiControlCollapseBtn = document.getElementById('aiControlCollapseBtn');
        
        if (aiControlHeader && aiControlContent) {
            aiControlHeader.addEventListener('click', () => {
                aiControlContent.classList.toggle('collapsed');
                aiControlCollapseBtn?.classList.toggle('expanded');
            });
        }
        
        const historyHeader = document.getElementById('historyHeader');
        const historyContent = document.getElementById('historyContent');
        const historyCollapseBtn = document.getElementById('historyCollapseBtn');
        
        if (historyHeader && historyContent) {
            historyHeader.addEventListener('click', () => {
                historyContent.classList.toggle('collapsed');
                historyCollapseBtn?.classList.toggle('expanded');
                if (!historyContent.classList.contains('collapsed')) {
                    this.loadHistory();
                }
            });
        }
    },
    
    bindEvents() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const screenshotBtn = document.getElementById('screenshotBtn');
        const recordBtn = document.getElementById('recordBtn');
        const stopRecordBtn = document.getElementById('stopRecordBtn');
        const backBtn = document.getElementById('backBtn');
        const cameraSelect = document.getElementById('cameraSelect');
        const resolutionSelect = document.getElementById('resolutionSelect');
        const fpsSelect = document.getElementById('fpsSelect');
        const mirrorToggle = document.getElementById('mirrorToggle');
        
        if (startBtn) startBtn.addEventListener('click', () => this.startMonitoring());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopMonitoring());
        if (screenshotBtn) screenshotBtn.addEventListener('click', () => this.takeScreenshot());
        if (recordBtn) recordBtn.addEventListener('click', () => this.startRecording());
        if (stopRecordBtn) stopRecordBtn.addEventListener('click', () => this.stopRecording());
        if (backBtn) backBtn.addEventListener('click', () => this.goBack());
        
        if (cameraSelect) {
            cameraSelect.addEventListener('change', (e) => {
                this.currentDeviceId = e.target.value;
                if (this.isMonitoring) {
                    this.restartWithNewDevice();
                }
            });
        }
        
        if (resolutionSelect) {
            resolutionSelect.addEventListener('change', () => {
                if (this.isMonitoring) {
                    this.restartWithNewSettings();
                }
                this.saveSettings();
            });
        }
        
        if (fpsSelect) {
            fpsSelect.addEventListener('change', () => {
                if (this.isMonitoring) {
                    this.restartWithNewSettings();
                }
                this.saveSettings();
            });
        }
        
        if (mirrorToggle) {
            mirrorToggle.addEventListener('change', (e) => {
                const video = document.getElementById('videoPreview');
                if (video) {
                    video.style.transform = e.target.checked ? 'scaleX(-1)' : 'scaleX(1)';
                }
                if (this.detectionCanvas) {
                    this.detectionCanvas.style.transform = e.target.checked ? 'scaleX(-1)' : 'scaleX(1)';
                }
                this.saveSettings();
            });
        }
        
        const detectionModeRadios = document.querySelectorAll('input[name="detectionMode"]');
        detectionModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.detectionMode = e.target.value;
                this.updateModelSelectionUI();
                this.saveSettings();
            });
        });
        
        const modelSelect = document.getElementById('modelSelect');
        if (modelSelect) {
            modelSelect.addEventListener('change', async (e) => {
                const newModel = e.target.value;
                
                if (this.isDetecting && this.previousModel && this.previousModel !== newModel) {
                    await this.releaseModel(this.previousModel);
                }
                
                this.selectedModels = [newModel];
                this.previousModel = newModel;
                this.saveSettings();
            });
        }
        
        const selectAllModels = document.getElementById('selectAllModels');
        if (selectAllModels) {
            selectAllModels.addEventListener('click', () => this.toggleSelectAllModels());
        }
        
        const startDetectionBtn = document.getElementById('startDetectionBtn');
        const stopDetectionBtn = document.getElementById('stopDetectionBtn');
        if (startDetectionBtn) startDetectionBtn.addEventListener('click', () => this.startDetection());
        if (stopDetectionBtn) stopDetectionBtn.addEventListener('click', () => this.stopDetection());
        
        const confidenceSlider = document.getElementById('confidenceSlider');
        const confidenceValue = document.getElementById('confidenceValue');
        if (confidenceSlider) {
            confidenceSlider.addEventListener('input', (e) => {
                this.confidence = parseFloat(e.target.value);
                if (confidenceValue) confidenceValue.textContent = this.confidence.toFixed(1);
                this.saveSettings();
            });
        }
        
        const intervalSlider = document.getElementById('intervalSlider');
        const intervalValue = document.getElementById('intervalValue');
        if (intervalSlider) {
            intervalSlider.addEventListener('input', (e) => {
                this.detectionIntervalMs = parseInt(e.target.value);
                if (intervalValue) intervalValue.textContent = this.detectionIntervalMs;
                this.saveSettings();
            });
        }
        
        const showBoxesToggle = document.getElementById('showBoxesToggle');
        if (showBoxesToggle) {
            showBoxesToggle.addEventListener('change', (e) => {
                this.showBoxes = e.target.checked;
                this.saveSettings();
            });
        }
        
        const showLabelsToggle = document.getElementById('showLabelsToggle');
        if (showLabelsToggle) {
            showLabelsToggle.addEventListener('change', (e) => {
                this.showLabels = e.target.checked;
                this.saveSettings();
            });
        }
        
        const saveResultsToggle = document.getElementById('saveResultsToggle');
        if (saveResultsToggle) {
            saveResultsToggle.addEventListener('change', (e) => {
                this.saveResults = e.target.checked;
                this.saveSettings();
            });
        }
        
        const warningClose = document.getElementById('warningClose');
        if (warningClose) {
            warningClose.addEventListener('click', () => this.hideWarningBanner());
        }
        
        const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
        if (refreshHistoryBtn) {
            refreshHistoryBtn.addEventListener('click', () => this.loadHistory());
        }
        
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }
        
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.loadHistory(this.historyPage - 1));
        if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.loadHistory(this.historyPage + 1));
        
        const historyModelFilter = document.getElementById('historyModelFilter');
        if (historyModelFilter) {
            historyModelFilter.addEventListener('change', () => this.loadHistory(1));
        }
        
        window.addEventListener('beforeunload', () => {
            this.stopDetection();
            this.stopMonitoring();
        });
    },
    
    async releaseModel(modelKey) {
        try {
            await fetch('/api/detection/release-model', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelKey })
            });
            console.log(`已释放模型: ${modelKey}`);
        } catch (error) {
            console.error('释放模型失败:', error);
        }
    },
    
    async releaseUnusedModels(keepModels) {
        try {
            await fetch('/api/detection/release-unused', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keep_models: keepModels })
            });
        } catch (error) {
            console.error('释放未使用模型失败:', error);
        }
    },
    
    async loadAvailableModels() {
        try {
            const response = await fetch('/api/detection/models');
            const data = await response.json();
            
            if (data.code === 200 && data.data) {
                this.availableModels = data.data;
                this.updateModelSelectUI();
                this.updateHistoryModelFilter();
            }
        } catch (error) {
            console.error('加载模型列表失败:', error);
            this.showToast('加载模型列表失败', 'error');
        }
    },
    
    updateHistoryModelFilter() {
        const historyModelFilter = document.getElementById('historyModelFilter');
        if (!historyModelFilter) return;
        
        historyModelFilter.innerHTML = '<option value="">全部模型</option>';
        this.availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.key;
            option.textContent = model.name;
            historyModelFilter.appendChild(option);
        });
    },
    
    updateModelSelectUI() {
        const modelSelect = document.getElementById('modelSelect');
        const modelCheckboxes = document.getElementById('modelCheckboxes');
        
        if (modelSelect && this.detectionMode === 'single') {
            modelSelect.innerHTML = '';
            this.availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.key;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
            if (this.availableModels.length > 0) {
                this.selectedModels = [this.availableModels[0].key];
                this.previousModel = this.availableModels[0].key;
            }
        }
        
        if (modelCheckboxes && this.detectionMode === 'multi') {
            modelCheckboxes.innerHTML = '';
            this.availableModels.forEach(model => {
                const label = document.createElement('label');
                label.className = 'model-checkbox';
                label.innerHTML = `
                    <input type="checkbox" value="${model.key}" ${this.selectedModels.includes(model.key) ? 'checked' : ''}>
                    <span class="model-checkbox-label">${model.name}</span>
                `;
                label.querySelector('input').addEventListener('change', (e) => {
                    if (e.target.checked) {
                        if (!this.selectedModels.includes(model.key)) {
                            this.selectedModels.push(model.key);
                        }
                    } else {
                        this.selectedModels = this.selectedModels.filter(k => k !== model.key);
                    }
                    this.saveSettings();
                });
                modelCheckboxes.appendChild(label);
            });
        }
    },
    
    updateModelSelectionUI() {
        const singleModelSelect = document.getElementById('singleModelSelect');
        const multiModelSelect = document.getElementById('multiModelSelect');
        
        if (this.detectionMode === 'single') {
            singleModelSelect?.classList.remove('hidden');
            multiModelSelect?.classList.add('hidden');
        } else {
            singleModelSelect?.classList.add('hidden');
            multiModelSelect?.classList.remove('hidden');
        }
        
        this.updateModelSelectUI();
    },
    
    toggleSelectAllModels() {
        const checkboxes = document.querySelectorAll('#modelCheckboxes input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => cb.checked = !allChecked);
        
        if (allChecked) {
            this.selectedModels = [];
        } else {
            this.selectedModels = this.availableModels.map(m => m.key);
        }
        this.saveSettings();
    },
    
    async enumerateDevices() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                this.showToast('您的浏览器不支持摄像头检测功能', 'error');
                return;
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === 'videoinput');
            
            const cameraSelect = document.getElementById('cameraSelect');
            if (!cameraSelect) return;
            
            cameraSelect.innerHTML = '';
            
            if (this.devices.length === 0) {
                cameraSelect.innerHTML = '<option value="">未检测到摄像头</option>';
                this.updateCameraStatus('未检测到摄像头', 'error');
                return;
            }
            
            this.devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `摄像头 ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            
            this.currentDeviceId = this.devices[0].deviceId;
            this.updateCameraStatus('已检测到摄像头', 'success');
            this.showToast(`检测到 ${this.devices.length} 个摄像头设备`, 'success');
            
        } catch (error) {
            console.error('检测摄像头失败:', error);
            this.showToast('检测摄像头失败: ' + error.message, 'error');
            this.updateCameraStatus('检测失败', 'error');
        }
    },
    
    async startMonitoring() {
        if (this.isMonitoring) return;
        
        try {
            const constraints = this.getMediaConstraints();
            
            this.updateOverlayText('正在请求摄像头权限...');
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const video = document.getElementById('videoPreview');
            if (video) {
                video.srcObject = this.stream;
                video.onloadedmetadata = () => {
                    this.updateVideoInfo();
                    this.startFpsCounter();
                    this.setupDetectionCanvas();
                };
            }
            
            this.isMonitoring = true;
            this.updateUI();
            this.hideOverlay();
            this.updateCameraStatus('已连接', 'success');
            
            const track = this.stream.getVideoTracks()[0];
            if (track) {
                document.getElementById('deviceName').textContent = track.label || '未知设备';
            }
            
            this.showToast('摄像头已启动', 'success');
            
        } catch (error) {
            console.error('启动摄像头失败:', error);
            this.handleCameraError(error);
        }
    },
    
    setupDetectionCanvas() {
        const video = document.getElementById('videoPreview');
        if (!video || !this.detectionCanvas) return;
        
        this.detectionCanvas.width = video.videoWidth;
        this.detectionCanvas.height = video.videoHeight;
    },
    
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.stopDetection();
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        const video = document.getElementById('videoPreview');
        if (video) {
            video.srcObject = null;
        }
        
        this.stopFpsCounter();
        this.isMonitoring = false;
        this.updateUI();
        this.showOverlay('点击下方按钮启动摄像头');
        this.updateCameraStatus('未连接', '');
        this.resetVideoInfo();
        this.clearDetectionCanvas();
        this.clearLiveDetections();
        
        this.showToast('摄像头已停止', 'success');
    },
    
    async restartWithNewDevice() {
        if (!this.isMonitoring) return;
        
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            const constraints = this.getMediaConstraints();
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            const video = document.getElementById('videoPreview');
            if (video) {
                video.srcObject = this.stream;
            }
            
            const track = this.stream.getVideoTracks()[0];
            if (track) {
                document.getElementById('deviceName').textContent = track.label || '未知设备';
            }
            
            this.updateVideoInfo();
            this.setupDetectionCanvas();
            this.showToast('已切换摄像头', 'success');
            
        } catch (error) {
            console.error('切换摄像头失败:', error);
            this.handleCameraError(error);
        }
    },
    
    async restartWithNewSettings() {
        await this.restartWithNewDevice();
        this.saveSettings();
    },
    
    getMediaConstraints() {
        const resolutionSelect = document.getElementById('resolutionSelect');
        const fpsSelect = document.getElementById('fpsSelect');
        
        const resolution = resolutionSelect?.value || 'auto';
        const fps = fpsSelect?.value || 'auto';
        
        let constraints = {
            video: {
                deviceId: this.currentDeviceId ? { exact: this.currentDeviceId } : undefined,
                facingMode: 'user'
            },
            audio: false
        };
        
        if (resolution !== 'auto' && this.resolutionMap[resolution]) {
            constraints.video.width = { ideal: this.resolutionMap[resolution].width };
            constraints.video.height = { ideal: this.resolutionMap[resolution].height };
        }
        
        if (fps !== 'auto') {
            constraints.video.frameRate = { ideal: parseInt(fps), max: parseInt(fps) };
        }
        
        return constraints;
    },
    
    startDetection() {
        if (!this.isMonitoring || !this.stream) {
            this.showToast('请先启动摄像头', 'warning');
            return;
        }
        
        if (this.isDetecting) return;
        
        if (this.selectedModels.length === 0) {
            this.showToast('请选择至少一个检测模型', 'warning');
            return;
        }
        
        this.isDetecting = true;
        this.updateDetectionUI(true);
        this.updateAIStatus('识别中', 'success');
        this.updateDetectionStatus('识别中', 'active');
        
        this.runDetection();
        
        this.showToast('开始AI识别', 'success');
    },
    
    stopDetection() {
        if (!this.isDetecting) return;
        
        this.isDetecting = false;
        
        if (this.detectionInterval) {
            clearTimeout(this.detectionInterval);
            this.detectionInterval = null;
        }
        
        this.updateDetectionUI(false);
        this.updateAIStatus('已停止', '');
        this.updateDetectionStatus('', '');
        this.clearDetectionCanvas();
        this.clearLiveDetections();
        
        if (this.detectionMode === 'single' && this.previousModel) {
            this.releaseModel(this.previousModel);
        }
        
        this.showToast('AI识别已停止', 'success');
    },
    
    async runDetection() {
        if (!this.isDetecting) return;
        
        try {
            const video = document.getElementById('videoPreview');
            if (!video || !this.stream) return;
            
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            const mirrorToggle = document.getElementById('mirrorToggle');
            if (mirrorToggle?.checked) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            let response;
            if (this.detectionMode === 'single') {
                response = await fetch('/api/detection/detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: imageData,
                        model: this.selectedModels[0],
                        confidence: this.confidence,
                        return_annotated: false,
                        save_result: this.saveResults
                    })
                });
            } else {
                response = await fetch('/api/detection/detect-multi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: imageData,
                        models: this.selectedModels,
                        confidence: this.confidence,
                        return_annotated: false,
                        save_result: this.saveResults
                    })
                });
            }
            
            const data = await response.json();
            
            if (data.code === 200) {
                this.processDetectionResults(data.data);
            }
            
        } catch (error) {
            console.error('检测错误:', error);
        }
        
        if (this.isDetecting) {
            this.detectionInterval = setTimeout(() => this.runDetection(), this.detectionIntervalMs);
        }
    },
    
    processDetectionResults(data) {
        this.clearDetectionCanvas();
        
        let allDetections = [];
        let warnings = [];
        let warningDetections = [];
        
        if (this.detectionMode === 'single') {
            allDetections = data.detections || [];
            if (data.warning) {
                warnings.push({
                    model: data.model,
                    model_name: data.model_name,
                    warning: data.warning
                });
                warningDetections = allDetections;
            }
        } else {
            const results = data.results || {};
            warnings = data.warnings || [];
            
            const warningModels = new Set(warnings.map(w => w.model));
            
            for (const [modelKey, result] of Object.entries(results)) {
                if (result.detections && result.detections.length > 0) {
                    result.detections.forEach(det => {
                        det.modelKey = modelKey;
                        det.modelName = result.model_name;
                    });
                    allDetections.push(...result.detections);
                    
                    if (warningModels.has(modelKey)) {
                        warningDetections.push(...result.detections);
                    }
                }
            }
        }
        
        if (this.showBoxes || this.showLabels) {
            this.drawDetections(allDetections);
        }
        
        this.updateLiveDetections(warningDetections, warnings);
        
        if (warnings.length > 0) {
            this.showWarningBanner(warnings);
            this.updateDetectionStatus('警告', 'warning');
        } else {
            this.hideWarningBanner();
            if (this.isDetecting) {
                this.updateDetectionStatus('识别中', 'active');
            }
        }
    },
    
    updateLiveDetections(detections, warnings) {
        const container = document.getElementById('liveDetectionResults');
        if (!container) return;
        
        if (!warnings || warnings.length === 0) {
            return;
        }
        
        const displayDetections = detections.slice(0, this.maxLiveDetections);
        
        displayDetections.forEach((det, i) => {
            const existingItems = container.querySelectorAll('.live-detection-item');
            if (existingItems.length >= this.maxLiveDetections) {
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'live-detection-item warning';
            item.innerHTML = `
                <div class="live-detection-icon">⚠</div>
                <span class="live-detection-text">${det.class_name}</span>
                <span class="live-detection-confidence">${(det.confidence * 100).toFixed(0)}%</span>
            `;
            container.appendChild(item);
            
            setTimeout(() => {
                if (item.parentNode) {
                    item.classList.add('fade-out');
                    setTimeout(() => {
                        if (item.parentNode) {
                            item.remove();
                        }
                    }, 500);
                }
            }, 4000);
        });
    },
    
    clearLiveDetections() {
        const container = document.getElementById('liveDetectionResults');
        if (container) {
            container.innerHTML = '';
        }
    },
    
    drawDetections(detections) {
        if (!this.detectionCtx || !this.detectionCanvas) return;
        
        const video = document.getElementById('videoPreview');
        if (!video) return;
        
        const scaleX = this.detectionCanvas.width / video.videoWidth;
        const scaleY = this.detectionCanvas.height / video.videoHeight;
        
        const mirrorToggle = document.getElementById('mirrorToggle');
        const isMirrored = mirrorToggle?.checked;
        
        this.detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        
        detections.forEach((det, index) => {
            const [x1, y1, x2, y2] = det.bbox;
            
            let drawX1 = x1 * scaleX;
            let drawX2 = x2 * scaleX;
            const drawY1 = y1 * scaleY;
            const drawY2 = y2 * scaleY;
            
            if (isMirrored) {
                const temp = drawX1;
                drawX1 = this.detectionCanvas.width - drawX2;
                drawX2 = this.detectionCanvas.width - temp;
            }
            
            const color = this.classColors[index % this.classColors.length];
            
            if (this.showBoxes) {
                this.detectionCtx.strokeStyle = color;
                this.detectionCtx.lineWidth = 2;
                this.detectionCtx.strokeRect(drawX1, drawY1, drawX2 - drawX1, drawY2 - drawY1);
            }
            
            if (this.showLabels) {
                const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
                this.detectionCtx.font = '14px Arial';
                const textWidth = this.detectionCtx.measureText(label).width;
                
                this.detectionCtx.fillStyle = color;
                this.detectionCtx.fillRect(drawX1, drawY1 - 20, textWidth + 10, 20);
                
                this.detectionCtx.fillStyle = '#fff';
                this.detectionCtx.fillText(label, drawX1 + 5, drawY1 - 5);
            }
        });
    },
    
    clearDetectionCanvas() {
        if (this.detectionCtx && this.detectionCanvas) {
            this.detectionCtx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        }
    },
    
    async loadHistory(page = 1) {
        try {
            const modelFilter = document.getElementById('historyModelFilter')?.value || '';
            
            const params = new URLSearchParams({
                page: page,
                page_size: this.historyPageSize
            });
            
            if (modelFilter) {
                params.append('model', modelFilter);
            }
            
            const response = await fetch(`/api/detection/results?${params}`);
            const data = await response.json();
            
            if (data.code === 200) {
                this.historyPage = data.data.page;
                this.historyTotal = data.data.total;
                this.historyTotalPages = data.data.total_pages;
                
                this.renderHistoryList(data.data.results);
                this.updatePagination();
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
        }
    },
    
    renderHistoryList(results) {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        if (results.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无检测历史</div>';
            return;
        }
        
        historyList.innerHTML = results.map(result => `
            <div class="history-item" data-id="${result.id}">
                <div class="history-item-header">
                    <span class="history-item-model">${result.model_name}</span>
                    <span class="history-item-time">${this.formatTime(result.created_at)}</span>
                </div>
                <div class="history-item-body">
                    <span class="history-item-count">检测数: ${result.detection_count}</span>
                    ${result.warning ? `<span class="history-item-warning">有警告</span>` : ''}
                </div>
            </div>
        `).join('');
    },
    
    updatePagination() {
        const pageInfo = document.getElementById('pageInfo');
        const prevPageBtn = document.getElementById('prevPageBtn');
        const nextPageBtn = document.getElementById('nextPageBtn');
        
        if (pageInfo) {
            pageInfo.textContent = `${this.historyPage}/${this.historyTotalPages}`;
        }
        
        if (prevPageBtn) {
            prevPageBtn.disabled = this.historyPage <= 1;
        }
        
        if (nextPageBtn) {
            nextPageBtn.disabled = this.historyPage >= this.historyTotalPages;
        }
    },
    
    async clearHistory() {
        if (!confirm('确定要清除所有检测历史吗？')) return;
        
        try {
            const response = await fetch('/api/detection/results/clear', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.code === 200) {
                this.showToast(data.message, 'success');
                this.loadHistory(1);
            }
        } catch (error) {
            console.error('清除历史失败:', error);
            this.showToast('清除历史失败', 'error');
        }
    },
    
    formatTime(timeStr) {
        const date = new Date(timeStr);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    showWarningBanner(warnings) {
        const banner = document.getElementById('warningBanner');
        const message = document.getElementById('warningMessage');
        const title = document.getElementById('warningTitle');
        
        if (banner && message) {
            const warningText = warnings.map(w => `${w.model_name}: ${w.warning}`).join('\n');
            message.textContent = warningText;
            title.textContent = `检测到 ${warnings.length} 个警告`;
            banner.classList.remove('hidden');
        }
    },
    
    hideWarningBanner() {
        const banner = document.getElementById('warningBanner');
        if (banner) {
            banner.classList.add('hidden');
        }
    },
    
    takeScreenshot() {
        if (!this.isMonitoring || !this.stream) {
            this.showToast('请先启动摄像头', 'warning');
            return;
        }
        
        const video = document.getElementById('videoPreview');
        if (!video) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        
        const mirrorToggle = document.getElementById('mirrorToggle');
        if (mirrorToggle?.checked) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (this.isDetecting && this.detectionCanvas) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            if (mirrorToggle?.checked) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            ctx.drawImage(this.detectionCanvas, 0, 0, canvas.width, canvas.height);
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `screenshot_${timestamp}.png`;
        
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast(`截图已保存: ${filename}`, 'success');
        }, 'image/png');
    },
    
    startRecording() {
        if (!this.isMonitoring || !this.stream) {
            this.showToast('请先启动摄像头', 'warning');
            return;
        }
        
        if (this.isRecording) return;
        
        try {
            const mimeTypes = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm',
                'video/mp4'
            ];
            
            let mimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    mimeType = type;
                    break;
                }
            }
            
            if (!mimeType) {
                this.showToast('您的浏览器不支持视频录制', 'error');
                return;
            }
            
            this.recordedChunks = [];
            
            const options = { mimeType };
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('录制错误:', event);
                this.showToast('录制过程中发生错误', 'error');
                this.stopRecording();
            };
            
            this.mediaRecorder.start(1000);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.startRecordingTimer();
            this.updateRecordingUI(true);
            this.updateCodecInfo(mimeType);
            this.showToast('开始录制', 'success');
            
        } catch (error) {
            console.error('启动录制失败:', error);
            this.showToast('启动录制失败: ' + error.message, 'error');
        }
    },
    
    stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;
        
        this.mediaRecorder.stop();
        this.isRecording = false;
        
        this.stopRecordingTimer();
        this.updateRecordingUI(false);
        this.showToast('录制已停止，正在保存...', 'success');
    },
    
    saveRecording() {
        if (this.recordedChunks.length === 0) {
            this.showToast('没有录制内容', 'warning');
            return;
        }
        
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = this.mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
        const filename = `recording_${timestamp}.${extension}`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.recordedChunks = [];
        this.showToast(`视频已保存: ${filename}`, 'success');
    },
    
    startRecordingTimer() {
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            
            const timeStr = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            document.getElementById('recordingTime').textContent = timeStr;
        }, 1000);
    },
    
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        document.getElementById('recordingTime').textContent = '00:00';
    },
    
    startFpsCounter() {
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        
        const video = document.getElementById('videoPreview');
        if (!video) return;
        
        const countFrame = () => {
            if (!this.isMonitoring) return;
            this.frameCount++;
            requestAnimationFrame(countFrame);
        };
        
        requestAnimationFrame(countFrame);
        
        this.fpsInterval = setInterval(() => {
            const now = performance.now();
            const elapsed = now - this.lastFrameTime;
            this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
            
            document.getElementById('fpsInfo').textContent = `${this.currentFps} FPS`;
            
            this.frameCount = 0;
            this.lastFrameTime = now;
        }, 1000);
    },
    
    stopFpsCounter() {
        if (this.fpsInterval) {
            clearInterval(this.fpsInterval);
            this.fpsInterval = null;
        }
        this.currentFps = 0;
        document.getElementById('fpsInfo').textContent = '-- FPS';
    },
    
    updateVideoInfo() {
        const video = document.getElementById('videoPreview');
        if (!video) return;
        
        const width = video.videoWidth;
        const height = video.videoHeight;
        
        document.getElementById('resolutionInfo').textContent = `${width}x${height}`;
        document.getElementById('currentResolution').textContent = `${width}x${height}`;
    },
    
    resetVideoInfo() {
        document.getElementById('resolutionInfo').textContent = '--';
        document.getElementById('fpsInfo').textContent = '-- FPS';
        document.getElementById('deviceName').textContent = '--';
        document.getElementById('currentResolution').textContent = '--';
        document.getElementById('codecInfo').textContent = '--';
        document.getElementById('aiStatus').textContent = '未启动';
    },
    
    updateCodecInfo(mimeType) {
        const codecMap = {
            'vp9': 'VP9',
            'vp8': 'VP8',
            'h264': 'H.264',
            'avc': 'H.264/AVC'
        };
        
        let codecName = '未知';
        for (const [key, name] of Object.entries(codecMap)) {
            if (mimeType.toLowerCase().includes(key)) {
                codecName = name;
                break;
            }
        }
        
        document.getElementById('codecInfo').textContent = codecName;
    },
    
    updateCameraStatus(status, type) {
        const statusEl = document.getElementById('cameraStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'info-value';
            if (type === 'success') {
                statusEl.style.color = 'var(--secondary-color)';
            } else if (type === 'error') {
                statusEl.style.color = 'var(--accent-color)';
            } else {
                statusEl.style.color = '';
            }
        }
    },
    
    updateAIStatus(status, type) {
        const statusEl = document.getElementById('aiStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'info-value';
            if (type === 'success') {
                statusEl.style.color = 'var(--secondary-color)';
            } else if (type === 'error') {
                statusEl.style.color = 'var(--accent-color)';
            } else {
                statusEl.style.color = '';
            }
        }
    },
    
    updateDetectionStatus(status, type) {
        const statusEl = document.getElementById('detectionStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = 'info-item detection-status';
            if (type) {
                statusEl.classList.add(type);
            }
        }
    },
    
    handleCameraError(error) {
        let message = '摄像头访问失败';
        
        switch (error.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                message = '摄像头权限被拒绝，请在浏览器设置中允许访问摄像头';
                break;
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                message = '未找到摄像头设备';
                break;
            case 'NotReadableError':
            case 'TrackStartError':
                message = '摄像头被其他应用程序占用';
                break;
            case 'OverconstrainedError':
            case 'ConstraintNotSatisfiedError':
                message = '摄像头不支持所选设置，请尝试降低分辨率或帧率';
                break;
            case 'NotSupportedError':
                message = '您的浏览器不支持摄像头功能';
                break;
            case 'TypeError':
                message = '摄像头配置错误';
                break;
            default:
                message = `摄像头错误: ${error.message || error.name}`;
        }
        
        this.updateOverlayText(message);
        this.showToast(message, 'error');
        this.updateCameraStatus('连接失败', 'error');
    },
    
    updateUI() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const screenshotBtn = document.getElementById('screenshotBtn');
        const recordBtn = document.getElementById('recordBtn');
        const startDetectionBtn = document.getElementById('startDetectionBtn');
        const cameraSelect = document.getElementById('cameraSelect');
        const resolutionSelect = document.getElementById('resolutionSelect');
        const fpsSelect = document.getElementById('fpsSelect');
        
        if (this.isMonitoring) {
            startBtn?.classList.add('hidden');
            stopBtn?.classList.remove('hidden');
            screenshotBtn && (screenshotBtn.disabled = false);
            recordBtn && (recordBtn.disabled = false);
            startDetectionBtn && (startDetectionBtn.disabled = false);
            cameraSelect && (cameraSelect.disabled = false);
            resolutionSelect && (resolutionSelect.disabled = false);
            fpsSelect && (fpsSelect.disabled = false);
        } else {
            startBtn?.classList.remove('hidden');
            stopBtn?.classList.add('hidden');
            screenshotBtn && (screenshotBtn.disabled = true);
            recordBtn && (recordBtn.disabled = true);
            startDetectionBtn && (startDetectionBtn.disabled = true);
        }
    },
    
    updateDetectionUI(isDetecting) {
        const startDetectionBtn = document.getElementById('startDetectionBtn');
        const stopDetectionBtn = document.getElementById('stopDetectionBtn');
        
        if (isDetecting) {
            startDetectionBtn?.classList.add('hidden');
            stopDetectionBtn?.classList.remove('hidden');
        } else {
            startDetectionBtn?.classList.remove('hidden');
            stopDetectionBtn?.classList.add('hidden');
        }
    },
    
    updateRecordingUI(isRecording) {
        const recordBtn = document.getElementById('recordBtn');
        const stopRecordBtn = document.getElementById('stopRecordBtn');
        const recordingIndicator = document.getElementById('recordingIndicator');
        
        if (isRecording) {
            recordBtn?.classList.add('hidden');
            stopRecordBtn?.classList.remove('hidden');
            recordingIndicator?.classList.remove('hidden');
        } else {
            recordBtn?.classList.remove('hidden');
            stopRecordBtn?.classList.add('hidden');
            recordingIndicator?.classList.add('hidden');
        }
    },
    
    showOverlay(text) {
        const overlay = document.getElementById('videoOverlay');
        const overlayText = document.getElementById('overlayText');
        
        if (overlayText) overlayText.textContent = text;
        overlay?.classList.remove('hidden');
    },
    
    hideOverlay() {
        const overlay = document.getElementById('videoOverlay');
        overlay?.classList.add('hidden');
    },
    
    updateOverlayText(text) {
        const overlayText = document.getElementById('overlayText');
        if (overlayText) overlayText.textContent = text;
    },
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    },
    
    saveSettings() {
        const settings = {
            resolution: document.getElementById('resolutionSelect')?.value || '1080p',
            fps: document.getElementById('fpsSelect')?.value || '30',
            mirror: document.getElementById('mirrorToggle')?.checked ?? true,
            detectionMode: this.detectionMode,
            selectedModels: this.selectedModels,
            confidence: this.confidence,
            detectionInterval: this.detectionIntervalMs,
            showBoxes: this.showBoxes,
            showLabels: this.showLabels,
            saveResults: this.saveResults
        };
        
        localStorage.setItem('monitorSettings', JSON.stringify(settings));
    },
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('monitorSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                
                if (settings.resolution) {
                    const resolutionSelect = document.getElementById('resolutionSelect');
                    if (resolutionSelect) resolutionSelect.value = settings.resolution;
                }
                
                if (settings.fps) {
                    const fpsSelect = document.getElementById('fpsSelect');
                    if (fpsSelect) fpsSelect.value = settings.fps;
                }
                
                if (settings.mirror !== undefined) {
                    const mirrorToggle = document.getElementById('mirrorToggle');
                    if (mirrorToggle) {
                        mirrorToggle.checked = settings.mirror;
                        const video = document.getElementById('videoPreview');
                        if (video) {
                            video.style.transform = settings.mirror ? 'scaleX(-1)' : 'scaleX(1)';
                        }
                        if (this.detectionCanvas) {
                            this.detectionCanvas.style.transform = settings.mirror ? 'scaleX(-1)' : 'scaleX(1)';
                        }
                    }
                }
                
                if (settings.detectionMode) {
                    this.detectionMode = settings.detectionMode;
                    const radio = document.querySelector(`input[name="detectionMode"][value="${settings.detectionMode}"]`);
                    if (radio) radio.checked = true;
                    this.updateModelSelectionUI();
                }
                
                if (settings.selectedModels) {
                    this.selectedModels = settings.selectedModels;
                }
                
                if (settings.confidence !== undefined) {
                    this.confidence = settings.confidence;
                    const confidenceSlider = document.getElementById('confidenceSlider');
                    const confidenceValue = document.getElementById('confidenceValue');
                    if (confidenceSlider) confidenceSlider.value = settings.confidence;
                    if (confidenceValue) confidenceValue.textContent = settings.confidence.toFixed(1);
                }
                
                if (settings.detectionInterval !== undefined) {
                    this.detectionIntervalMs = settings.detectionInterval;
                    const intervalSlider = document.getElementById('intervalSlider');
                    const intervalValue = document.getElementById('intervalValue');
                    if (intervalSlider) intervalSlider.value = settings.detectionInterval;
                    if (intervalValue) intervalValue.textContent = settings.detectionInterval;
                }
                
                if (settings.showBoxes !== undefined) {
                    this.showBoxes = settings.showBoxes;
                    const showBoxesToggle = document.getElementById('showBoxesToggle');
                    if (showBoxesToggle) showBoxesToggle.checked = settings.showBoxes;
                }
                
                if (settings.showLabels !== undefined) {
                    this.showLabels = settings.showLabels;
                    const showLabelsToggle = document.getElementById('showLabelsToggle');
                    if (showLabelsToggle) showLabelsToggle.checked = settings.showLabels;
                }
                
                if (settings.saveResults !== undefined) {
                    this.saveResults = settings.saveResults;
                    const saveResultsToggle = document.getElementById('saveResultsToggle');
                    if (saveResultsToggle) saveResultsToggle.checked = settings.saveResults;
                }
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    },
    
    goBack() {
        this.stopDetection();
        this.stopMonitoring();
        window.location.href = '/chat';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    Monitor.init();
});
