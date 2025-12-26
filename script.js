// script.js - HOÀN CHỈNH VỚI TẤT CẢ CHỨC NĂNG
class InventoryManager {
    constructor() {
        this.API_URL = 'https://script.google.com/macros/s/AKfycby7_CNDwE_--9A79WMQoLCbsIn2q7oT44Co4pfABVmVB48QWX-pxuz4Vtft8ei2BBgKCA/exec';
        this.currentData = [];
        this.filteredData = [];
        this.currentSheet = '15';
        this.visibleRows = 0;
        this.ROWS_PER_PAGE = 15;
        this.allMaterials = new Set();
        this.allLocations = new Set();
        
        this.init();
    }

    async init() {
        console.log('🚀 CHECKSTOCK KIEU - Khởi động...');
        
        this.initUI();
        this.setupEventListeners();
        
        // Set default dates
        const today = new Date().getDate().toString().padStart(2, '0');
        this.currentSheet = today;
        document.getElementById('daySelect').value = today;
        document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
        
        // Test connection first
        if (await this.testConnection()) {
            await this.loadData();
        } else {
            this.showNotification('warning', '⚠️ Không thể kết nối đến server. Sử dụng dữ liệu mẫu.');
            this.loadSampleData();
        }
    }

    initUI() {
        // Initialize day selector
        const daySelect = document.getElementById('daySelect');
        daySelect.innerHTML = '';
        for (let i = 1; i <= 31; i++) {
            const day = i.toString().padStart(2, '0');
            const option = document.createElement('option');
            option.value = day;
            option.textContent = `Ngày ${day}`;
            daySelect.appendChild(option);
        }

        // Initialize copy modal dropdowns
        this.initCopyModalDropdowns();
    }

    setupEventListeners() {
        // Day selector change
        document.getElementById('daySelect').addEventListener('change', (e) => {
            this.currentSheet = e.target.value;
            this.loadData();
        });

        // Filter changes
        document.getElementById('materialFilter').addEventListener('change', (e) => {
            this.handleMaterialFilter(e.target.value);
        });

        document.getElementById('locationFilter').addEventListener('change', (e) => {
            this.handleLocationFilter(e.target.value);
        });

        // Load more button
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            this.loadMoreRows();
        });

        // Auto-calculate weight from bags
        document.getElementById('bagQuantity').addEventListener('input', (e) => {
            const bags = parseFloat(e.target.value) || 0;
            if (bags > 0) {
                document.getElementById('weight').value = (bags * 25).toFixed(2);
            }
        });

        // Unit conversion
        document.getElementById('unit').addEventListener('change', (e) => {
            const weightInput = document.getElementById('weight');
            const currentValue = parseFloat(weightInput.value) || 0;
            
            if (e.target.value === 'ton' && currentValue > 0) {
                weightInput.value = (currentValue / 1000).toFixed(3);
            } else if (e.target.value === 'kg' && currentValue > 0) {
                weightInput.value = (currentValue * 1000).toFixed(2);
            }
        });

        // Export Excel button
        document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
            this.exportToExcel();
        });
    }

    initCopyModalDropdowns() {
        const fromSelect = document.getElementById('copyFrom');
        const toSelect = document.getElementById('copyTo');
        
        if (!fromSelect || !toSelect) return;
        
        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';
        
        for (let i = 1; i <= 31; i++) {
            const day = i.toString().padStart(2, '0');
            
            [fromSelect, toSelect].forEach(select => {
                const option = document.createElement('option');
                option.value = day;
                option.textContent = `Ngày ${day}`;
                select.appendChild(option);
            });
        }
    }

    async testConnection() {
        try {
            const url = `${this.API_URL}?action=test&callback=testCallback`;
            
            return new Promise((resolve) => {
                window.testCallback = (result) => {
                    delete window.testCallback;
                    console.log('Connection test:', result);
                    this.updateConnectionStatus(result.success ? 'connected' : 'error');
                    resolve(result.success);
                };
                
                const script = document.createElement('script');
                script.src = url;
                script.onerror = () => {
                    delete window.testCallback;
                    this.updateConnectionStatus('error');
                    resolve(false);
                };
                document.head.appendChild(script);
                
                setTimeout(() => {
                    if (window.testCallback) {
                        delete window.testCallback;
                        this.updateConnectionStatus('timeout');
                        resolve(false);
                    }
                }, 5000);
            });
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    async loadData() {
        this.showLoading(true);
        this.updateConnectionStatus('loading');
        
        try {
            const result = await this.callAPI('getData', { sheet: this.currentSheet });
            
            if (result.success) {
                this.currentData = result.data || [];
                this.filteredData = [...this.currentData];
                this.visibleRows = 0;
                
                this.updateFilters();
                this.renderTable();
                this.updateStatistics();
                this.updateInventoryAgeAnalysis();
                this.updateLastUpdated();
                
                this.updateConnectionStatus('connected');
                this.showNotification('success', `✅ Đã tải ${this.currentData.length} dòng từ Ngày ${this.currentSheet}`);
            } else {
                throw new Error(result.error || 'Lỗi không xác định');
            }
        } catch (error) {
            console.error('❌ Lỗi tải dữ liệu:', error);
            this.updateConnectionStatus('error');
            this.showNotification('error', `❌ ${error.message}`);
            this.loadSampleData();
        } finally {
            this.showLoading(false);
        }
    }

    async callAPI(action, params = {}) {
        return new Promise((resolve, reject) => {
            const callbackName = `apiCallback_${Date.now()}`;
            const queryParams = new URLSearchParams({
                action,
                ...params,
                callback: callbackName
            });
            
            const url = `${this.API_URL}?${queryParams}`;
            
            window[callbackName] = (result) => {
                delete window[callbackName];
                resolve(result);
            };
            
            const script = document.createElement('script');
            script.src = url;
            script.onerror = () => {
                delete window[callbackName];
                reject(new Error('API request failed'));
            };
            
            document.head.appendChild(script);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    reject(new Error('API request timeout'));
                }
            }, 10000);
        });
    }

    async submitTransaction() {
        const formData = {
            sheet: this.currentSheet,
            transactionType: document.getElementById('transactionType').value,
            materialName: document.getElementById('materialName').value.trim(),
            location: document.getElementById('materialCode').value.trim(),
            bagQuantity: document.getElementById('bagQuantity').value,
            weight: document.getElementById('weight').value,
            unit: document.getElementById('unit').value,
            transactionDate: document.getElementById('transactionDate').value,
            supplierNote: document.getElementById('transactionNote').value.trim(),
            materialCode: document.getElementById('materialCode').value.trim(),
            truck: document.getElementById('truck').value || ''
        };

        // Validation
        if (!formData.transactionType || !formData.materialName || !formData.location) {
            this.showNotification('error', '❌ Vui lòng điền đầy đủ các trường bắt buộc');
            return;
        }

        if (!formData.weight || parseFloat(formData.weight) <= 0) {
            this.showNotification('error', '❌ Trọng lượng phải lớn hơn 0');
            return;
        }

        try {
            this.showNotification('info', '⏳ Đang lưu dữ liệu...');
            
            const result = await this.callAPI('addTransaction', formData);
            
            if (result.success) {
                this.showNotification('success', result.message);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('addDataModal'));
                if (modal) modal.hide();
                
                // Reset form
                document.getElementById('newTransactionForm').reset();
                
                // Reload data after 1 second
                setTimeout(() => {
                    this.loadData();
                }, 1000);
            } else {
                this.showNotification('error', `❌ ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Lỗi lưu dữ liệu:', error);
            this.showNotification('error', `❌ Lỗi: ${error.message}`);
        }
    }

    async copyOpeningStock() {
        const fromDay = document.getElementById('copyFrom').value;
        const toDay = document.getElementById('copyTo').value;
        
        if (!fromDay || !toDay) {
            this.showNotification('warning', '⚠️ Vui lòng chọn cả ngày nguồn và ngày đích');
            return;
        }
        
        if (fromDay === toDay) {
            this.showNotification('warning', '⚠️ Không thể copy tồn kho trong cùng một ngày');
            return;
        }
        
        if (!confirm(`Bạn có chắc muốn COPY TỒN CUỐI ngày ${fromDay} sang TỒN ĐẦU ngày ${toDay}?\n\nLưu ý: Dữ liệu Tồn đầu ngày ${toDay} sẽ bị ghi đè.`)) {
            return;
        }
        
        try {
            this.showNotification('info', `⏳ Đang thực hiện copy từ ngày ${fromDay} sang ${toDay}...`);
            
            const result = await this.callAPI('copyOpeningStock', { fromDay, toDay });
            
            if (result.success) {
                this.showNotification('success', result.message);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('autoCopyModal'));
                if (modal) modal.hide();
                
                // Reload if current sheet is destination
                if (this.currentSheet === toDay) {
                    setTimeout(() => {
                        this.loadData();
                    }, 1000);
                }
            } else {
                this.showNotification('error', `❌ ${result.error}`);
            }
        } catch (error) {
            console.error('❌ Lỗi copy:', error);
            this.showNotification('error', `❌ Lỗi: ${error.message}`);
        }
    }

    updateFilters() {
        // Update material filter
        this.allMaterials.clear();
        this.currentData.forEach(row => {
            if (row.material) this.allMaterials.add(row.material);
        });
        
        const materialSelect = document.getElementById('materialFilter');
        const currentMaterial = materialSelect.value;
        materialSelect.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>';
        
        Array.from(this.allMaterials).sort().forEach(material => {
            const option = document.createElement('option');
            option.value = material;
            option.textContent = material;
            materialSelect.appendChild(option);
        });
        
        if (this.allMaterials.has(currentMaterial)) {
            materialSelect.value = currentMaterial;
        }

        // Update location filter
        this.allLocations.clear();
        this.currentData.forEach(row => {
            if (row.location) this.allLocations.add(row.location);
        });
        
        const locationSelect = document.getElementById('locationFilter');
        const currentLocation = locationSelect.value;
        locationSelect.innerHTML = '<option value="">-- Chọn vị trí/lô --</option>';
        
        Array.from(this.allLocations).sort().forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationSelect.appendChild(option);
        });
        
        if (this.allLocations.has(currentLocation)) {
            locationSelect.value = currentLocation;
        }

        // Update datalists for forms
        this.updateDatalists();
    }

    updateDatalists() {
        const materialList = document.getElementById('materialList');
        const locationList = document.getElementById('locationList');
        
        if (materialList) {
            materialList.innerHTML = '';
            this.allMaterials.forEach(material => {
                const option = document.createElement('option');
                option.value = material;
                materialList.appendChild(option);
            });
        }
        
        if (locationList) {
            locationList.innerHTML = '';
            this.allLocations.forEach(location => {
                const option = document.createElement('option');
                option.value = location;
                locationList.appendChild(option);
            });
        }
    }

    renderTable() {
        const tbody = document.getElementById('dataTable');
        
        if (this.filteredData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" class="text-center py-5">
                        <i class="fas fa-database fa-3x text-muted mb-3"></i>
                        <p class="text-muted">Không có dữ liệu</p>
                        <small>Vui lòng chọn ngày hoặc áp dụng bộ lọc</small>
                    </td>
                </tr>`;
            this.updateRowCount();
            return;
        }
        
        const start = 0;
        const end = Math.min(this.visibleRows + this.ROWS_PER_PAGE, this.filteredData.length);
        const dataToShow = this.filteredData.slice(start, end);
        
        let html = '';
        dataToShow.forEach((item, index) => {
            const age = this.calculateAge(item.importDate);
            const ageClass = this.getAgeClass(age);
            const groupClass = `badge-${this.getMaterialGroup(item.material)}`;
            const groupName = this.getGroupName(this.getMaterialGroup(item.material));
            
            html += `
            <tr>
                <td class="text-center fw-bold">${item.stt}</td>
                <td>
                    <div class="fw-bold">${item.material || ''}</div>
                    <small class="text-muted">${item.code || ''}</small>
                </td>
                <td><span class="badge bg-secondary">${item.location || ''}</span></td>
                <td><span class="material-badge ${groupClass}">${groupName}</span></td>
                <td class="text-end">
                    <div class="fw-bold">${this.formatNumberFull(item.openingWeight)} kg</div>
                    <small class="text-muted">${item.openingBags || 0} bao</small>
                </td>
                <td class="text-end text-success">
                    <div class="fw-bold">${this.formatNumberFull(item.importWeight)} kg</div>
                    <small class="text-muted">${item.importBags || 0} bao</small>
                </td>
                <td class="text-end text-danger">
                    <div class="fw-bold">${this.formatNumberFull(item.exportWeight)} kg</div>
                    <small class="text-muted">${item.exportBags || 0} bao</small>
                </td>
                <td class="text-end">
                    <div class="fw-bold text-primary">${this.formatNumberFull(item.closingWeight)} kg</div>
                    <small class="text-muted">${item.closingBags || 0} bao</small>
                </td>
                <td>${this.formatDate(item.importDate)}</td>
                <td class="text-center">
                    <div class="age-indicator ${ageClass}" title="${age} ngày">${age}</div>
                </td>
                <td><small class="text-primary">${item.code || ''}</small></td>
                <td><small>${item.supplier || ''}</small></td>
                <td><span class="badge bg-light text-dark">${item.truck || ''}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="inventory.editItem(${index})" title="Sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="inventory.deleteItem(${index})" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        });
        
        tbody.innerHTML = html;
        this.updateRowCount();
    }

    updateRowCount() {
        const visible = Math.min(this.visibleRows + this.ROWS_PER_PAGE, this.filteredData.length);
        const total = this.filteredData.length;
        
        document.getElementById('visibleRowCount').textContent = visible;
        document.getElementById('totalRowCount').textContent = total;
        
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (visible < total) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerHTML = `<i class="fas fa-chevron-down me-2"></i>Xem thêm (${Math.min(this.ROWS_PER_PAGE, total - visible)} dòng)`;
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }

    loadMoreRows() {
        this.visibleRows += this.ROWS_PER_PAGE;
        this.renderTable();
    }

    handleMaterialFilter(material) {
        if (material) {
            document.getElementById('locationFilter').value = '';
            this.filteredData = this.currentData.filter(item => 
                item.material && item.material.toLowerCase().includes(material.toLowerCase())
            );
        } else {
            this.filteredData = [...this.currentData];
        }
        
        this.visibleRows = 0;
        this.renderTable();
        this.updateStatistics();
        this.updateInventoryAgeAnalysis();
    }

    handleLocationFilter(location) {
        if (location) {
            document.getElementById('materialFilter').value = '';
            this.filteredData = this.currentData.filter(item => 
                item.location && item.location.toLowerCase() === location.toLowerCase()
            );
        } else {
            this.filteredData = [...this.currentData];
        }
        
        this.visibleRows = 0;
        this.renderTable();
        this.updateStatistics();
        this.updateInventoryAgeAnalysis();
    }

    updateStatistics() {
        let total = {
            openingWeight: 0,
            importWeight: 0,
            exportWeight: 0,
            closingWeight: 0,
            avgAge: 0
        };
        
        let totalAge = 0;
        let countWithDate = 0;
        
        this.filteredData.forEach(item => {
            total.openingWeight += parseFloat(item.openingWeight) || 0;
            total.importWeight += parseFloat(item.importWeight) || 0;
            total.exportWeight += parseFloat(item.exportWeight) || 0;
            total.closingWeight += parseFloat(item.closingWeight) || 0;
            
            if (item.importDate) {
                const age = this.calculateAge(item.importDate);
                totalAge += age;
                countWithDate++;
            }
        });
        
        total.avgAge = countWithDate > 0 ? Math.round(totalAge / countWithDate) : 0;
        
        document.getElementById('totalStock').textContent = this.formatNumberFull(total.closingWeight) + ' kg';
        document.getElementById('totalImport').textContent = this.formatNumberFull(total.importWeight) + ' kg';
        document.getElementById('totalExport').textContent = this.formatNumberFull(total.exportWeight) + ' kg';
        document.getElementById('avgAge').textContent = total.avgAge + ' ngày';
    }

    updateInventoryAgeAnalysis() {
        let age0_30 = 0, age31_60 = 0, age61Plus = 0;
        let totalWeight = 0;
        
        this.filteredData.forEach(item => {
            const weight = parseFloat(item.closingWeight) || 0;
            const age = this.calculateAge(item.importDate);
            
            totalWeight += weight;
            
            if (age <= 30) age0_30 += weight;
            else if (age <= 60) age31_60 += weight;
            else age61Plus += weight;
        });
        
        // Update UI
        document.getElementById('age0-30Weight').textContent = this.formatNumberFull(age0_30) + ' kg';
        document.getElementById('age31-60Weight').textContent = this.formatNumberFull(age31_60) + ' kg';
        document.getElementById('age61PlusWeight').textContent = this.formatNumberFull(age61Plus) + ' kg';
        document.getElementById('totalAgeWeight').textContent = this.formatNumberFull(totalWeight) + ' kg';
        
        // Update progress bars
        if (totalWeight > 0) {
            const pct0_30 = Math.round((age0_30 / totalWeight) * 100);
            const pct31_60 = Math.round((age31_60 / totalWeight) * 100);
            const pct61Plus = Math.round((age61Plus / totalWeight) * 100);
            
            document.getElementById('age0-30Bar').style.width = pct0_30 + '%';
            document.getElementById('age31-60Bar').style.width = pct31_60 + '%';
            document.getElementById('age61PlusBar').style.width = pct61Plus + '%';
            
            document.getElementById('age0-30Percent').textContent = pct0_30;
            document.getElementById('age31-60Percent').textContent = pct31_60;
            document.getElementById('age61PlusPercent').textContent = pct61Plus;
        }
    }

    exportToExcel() {
        if (this.filteredData.length === 0) {
            this.showNotification('warning', 'Không có dữ liệu để xuất!');
            return;
        }
        
        const wsData = [
            ['STT', 'Nguyên liệu', 'Vị trí', 'Tồn đầu (bao)', 'Tồn đầu (kg)', 
             'Nhập (bao)', 'Nhập (kg)', 'Xuất (bao)', 'Xuất (kg)', 
             'Tồn cuối (bao)', 'Tồn cuối (kg)', 'Ngày nhập', 'Tuổi', 
             'Code/NCC', 'Nhà CC', 'Truck'],
            ...this.filteredData.map(item => [
                item.stt,
                item.material,
                item.location,
                item.openingBags,
                item.openingWeight,
                item.importBags,
                item.importWeight,
                item.exportBags,
                item.exportWeight,
                item.closingBags,
                item.closingWeight,
                this.formatDate(item.importDate),
                this.calculateAge(item.importDate),
                item.code,
                item.supplier,
                item.truck
            ])
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `Kho_${this.currentSheet}`);
        
        const fileName = `CHECKSTOCK_KIEU_${this.currentSheet}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        this.showNotification('success', `✅ Đã xuất file ${fileName}`);
    }

    loadSampleData() {
        this.currentData = [
            {
                stt: 1,
                material: "C9959",
                location: "B16",
                openingBags: 100,
                openingWeight: 2500,
                importBags: 50,
                importWeight: 1250,
                exportBags: 30,
                exportWeight: 750,
                closingBags: 120,
                closingWeight: 3000,
                importDate: "2024-01-14T17:00:00.000Z",
                code: "105104(BT)",
                truck: "Xe 01",
                supplier: "CP Feedmill"
            },
            // ... thêm dữ liệu mẫu khác
        ];
        
        this.filteredData = [...this.currentData];
        this.visibleRows = 0;
        
        this.updateFilters();
        this.renderTable();
        this.updateStatistics();
        this.updateInventoryAgeAnalysis();
        
        this.updateConnectionStatus('sample');
        this.showNotification('warning', '⚠️ Đang hiển thị dữ liệu mẫu');
    }

    // Helper methods
    formatNumberFull(num) {
        const n = parseFloat(num) || 0;
        return n.toLocaleString('vi-VN', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 2 
        });
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
    }

    calculateAge(dateStr) {
        if (!dateStr) return 0;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 0;
        const diffMs = Date.now() - date.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    getAgeClass(age) {
        if (age <= 30) return 'age-green';
        if (age <= 60) return 'age-yellow';
        return 'age-red';
    }

    getMaterialGroup(name) {
        if (!name) return 'other';
        const n = name.toLowerCase();
        if (n.includes('dịch') || n.includes('cá') || n.includes('dầu')) return 'liquid';
        if (n.includes('đậu') || n.includes('cám') || n.includes('bột')) return 'bulk';
        return 'bao';
    }

    getGroupName(group) {
        const map = { 'bao':'Bao', 'liquid':'Lỏng', 'bulk':'Xá đổ', 'other':'Khác' };
        return map[group] || group;
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        const indicator = document.getElementById('statusIndicator');
        
        if (!statusEl || !indicator) return;
        
        const statusMap = {
            'connected': { text: 'Đã kết nối', color: 'success', bg: 'bg-success' },
            'loading': { text: 'Đang tải...', color: 'warning', bg: 'bg-warning' },
            'error': { text: 'Lỗi kết nối', color: 'danger', bg: 'bg-danger' },
            'sample': { text: 'Dữ liệu mẫu', color: 'warning', bg: 'bg-warning' },
            'timeout': { text: 'Timeout', color: 'warning', bg: 'bg-warning' }
        };
        
        const current = statusMap[status] || { text: 'Chưa kết nối', color: 'secondary', bg: 'bg-secondary' };
        
        statusEl.textContent = current.text;
        statusEl.className = `fw-bold text-${current.color}`;
        indicator.className = `${current.bg} rounded-circle me-2`;
        indicator.style.width = indicator.style.height = '10px';
    }

    updateLastUpdated() {
        document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString('vi-VN');
    }

    showNotification(type, message) {
        // Remove existing notifications
        document.querySelectorAll('.alert-notification').forEach(el => el.remove());
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-notification alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top:20px; right:20px; z-index:9999; min-width:300px;';
        alert.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        const loadingEl = document.getElementById('loadingIndicator');
        if (!loadingEl) return;
        
        if (show) {
            loadingEl.style.display = 'block';
        } else {
            loadingEl.style.display = 'none';
        }
    }

    editItem(index) {
        const item = this.filteredData[index];
        this.showNotification('info', `Chỉnh sửa: ${item.material} - Tính năng đang phát triển`);
        // TODO: Implement edit modal
    }

    deleteItem(index) {
        const item = this.filteredData[index];
        if (confirm(`Bạn có chắc muốn xóa "${item.material}" - Vị trí "${item.location}"?`)) {
            this.showNotification('info', `Đang xóa: ${item.material} - Tính năng đang phát triển`);
            // TODO: Implement delete API call
        }
    }
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    window.inventory = new InventoryManager();
    
    // Expose global functions for HTML onclick handlers
    window.loadData = () => inventory.loadData();
    window.loadMoreRows = () => inventory.loadMoreRows();
    window.submitNewTransaction = () => inventory.submitTransaction();
    window.performAutoCopy = () => inventory.copyOpeningStock();
    window.exportToExcel = () => inventory.exportToExcel();
});
