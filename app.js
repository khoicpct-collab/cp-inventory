// app.js - Tích hợp Google Sheets
const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// Global variables
let materials = [];
let stockData = [];
let categories = [];

// API Service Class
class GoogleSheetsAPI {
    static async request(endpoint, data = null) {
        try {
            const url = new URL(API_URL);
            
            if (data && Object.keys(data).length > 0) {
                // GET request với parameters
                Object.keys(data).forEach(key => {
                    url.searchParams.set(key, data[key]);
                });
            }
            
            url.searchParams.set('method', endpoint);
            
            console.log('API Request:', url.toString());
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Material methods
    static async getMaterials() {
        return await this.request('getMaterials');
    }
    
    static async addMaterial(data) {
        return await this.request('addMaterial', data);
    }

    // Stock methods
    static async getStock(materialId = null) {
        const params = {};
        if (materialId) params.materialId = materialId;
        return await this.request('getStock', params);
    }
    
    static async addStock(data) {
        return await this.request('addStock', data);
    }

    // Category methods
    static async getCategories() {
        return await this.request('getCategories');
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    showLoading(true);
    try {
        await loadAllData();
        setupEventListeners();
    } catch (error) {
        console.error('Khởi tạo ứng dụng thất bại:', error);
        showError('Không thể kết nối đến database. Vui lòng kiểm tra kết nối.');
    }
    showLoading(false);
}

// Load all data from Google Sheets
async function loadAllData() {
    try {
        console.log('Đang tải dữ liệu từ Google Sheets...');
        
        const [materialsResult, stockResult, categoriesResult] = await Promise.all([
            GoogleSheetsAPI.getMaterials(),
            GoogleSheetsAPI.getStock(),
            GoogleSheetsAPI.getCategories()
        ]);

        materials = materialsResult.materials || [];
        stockData = stockResult.stock || [];
        categories = categoriesResult.categories || [];

        console.log('Dữ liệu đã tải:', {
            materials: materials.length,
            stock: stockData.length,
            categories: categories.length
        });

        updateDashboard();
        renderMaterials();
        populateFilters();

    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
        // Fallback to sample data
        loadSampleData();
        showError('Đang sử dụng dữ liệu mẫu. Vui lòng kiểm tra kết nối Google Sheets.');
    }
}

// Sample data fallback
function loadSampleData() {
    materials = [
        { ID: 1, Name: 'RBF,P', Code: 'RBF001', Category: 'protein', Description: 'Nguyên liệu A', Active: true },
        { ID: 2, Name: 'PMBM', Code: 'PMB001', Category: 'protein', Description: 'Protein từ thịt và xương', Active: true },
        { ID: 3, Name: 'FM60', Code: 'FM6001', Category: 'plant', Description: 'Bột cá 60% protein', Active: true }
    ];

    stockData = [
        { ID: 1, MaterialID: 1, LOC: 'C06', Bags: 110, Weight: 5345, InputDate: '2025-11-04', SupplierCode: '10102122922', TruckNumber: '', Age: 0 },
        { ID: 2, MaterialID: 1, LOC: 'A09', Bags: 721, Weight: 32116, InputDate: '2025-11-04', SupplierCode: '10102122959', TruckNumber: '', Age: 0 },
        { ID: 3, MaterialID: 2, LOC: 'C01', Bags: 539, Weight: 29499, InputDate: '2025-10-24', SupplierCode: '10102122269(US)', TruckNumber: '', Age: 11 }
    ];

    categories = [
        { ID: 1, Name: 'Protein động vật', Color: '#e74c3c' },
        { ID: 2, Name: 'Nguyên liệu thực vật', Color: '#2ecc71' },
        { ID: 3, Name: 'Phụ gia', Color: '#3498db' }
    ];
}

// Update dashboard statistics
function updateDashboard() {
    const totalMaterials = materials.filter(m => m.Active).length;
    const totalLocations = new Set(stockData.map(item => item.LOC)).size;
    
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = stockData.filter(item => item.InputDate === today).length;
    
    const totalStock = stockData.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);

    document.getElementById('totalMaterials').textContent = totalMaterials;
    document.getElementById('totalLocations').textContent = totalLocations;
    document.getElementById('todayTransactions').textContent = todayTransactions;
    document.getElementById('totalStock').textContent = totalStock.toLocaleString('vi-VN') + ' kg';
}

// Render materials to the container
function renderMaterials() {
    const container = document.getElementById('materialsContainer');
    if (!container) return;

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('sortSelect')?.value || 'name';
    const supplierFilter = document.getElementById('supplierFilter')?.value || '';

    // Filter materials
    let filteredMaterials = materials.filter(material => {
        if (!material.Active) return false;
        
        const matchesSearch = material.Name.toLowerCase().includes(searchTerm) || 
                             material.Code.toLowerCase().includes(searchTerm) ||
                             material.Description.toLowerCase().includes(searchTerm);
        
        const matchesSupplier = !supplierFilter || 
                               stockData.some(item => 
                                   item.MaterialID == material.ID && 
                                   item.SupplierCode === supplierFilter
                               );
        
        return matchesSearch && matchesSupplier;
    });

    // Sort materials
    filteredMaterials.sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.Name.localeCompare(b.Name);
            case 'date':
                const aStock = getMaterialStock(a.ID);
                const bStock = getMaterialStock(b.ID);
                const aLatest = aStock.length > 0 ? new Date(aStock[aStock.length - 1].InputDate) : new Date(0);
                const bLatest = bStock.length > 0 ? new Date(bStock[bStock.length - 1].InputDate) : new Date(0);
                return bLatest - aLatest;
            case 'location':
                const aLoc = getMaterialStock(a.ID)[0]?.LOC || '';
                const bLoc = getMaterialStock(b.ID)[0]?.LOC || '';
                return aLoc.localeCompare(bLoc);
            default:
                return 0;
        }
    });

    // Render HTML
    container.innerHTML = filteredMaterials.map(material => {
        const materialStock = getMaterialStock(material.ID);
        const totalBags = materialStock.reduce((sum, item) => sum + (parseInt(item.Bags) || 0), 0);
        const totalWeight = materialStock.reduce((sum, item) => sum + (parseFloat(item.Weight) || 0), 0);

        return `
            <div class="card material-card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">
                        <i class="fas fa-box"></i> ${material.Name}
                        <small class="text-muted">${material.Code}</small>
                    </h5>
                    <div>
                        <span class="badge bg-primary me-2">${materialStock.length} lô</span>
                        <span class="badge bg-success">${totalBags} bao</span>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text">${material.Description}</p>
                    
                    <div class="location-section">
                        <h6><i class="fas fa-map-marker-alt"></i> Chi tiết các lô:</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th>LOC</th>
                                        <th>Số bao</th>
                                        <th>Trọng lượng (kg)</th>
                                        <th>Ngày nhập</th>
                                        <th>Tuổi</th>
                                        <th>Mã NCC</th>
                                        <th>Số xe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${materialStock.map(item => {
                                        const age = item.Age || calculateAge(item.InputDate);
                                        const ageClass = getAgeClass(age);
                                        return `
                                            <tr class="transaction-row">
                                                <td><strong>${item.LOC}</strong></td>
                                                <td>${item.Bags}</td>
                                                <td>${parseFloat(item.Weight).toLocaleString('vi-VN')}</td>
                                                <td>${formatDate(item.InputDate)}</td>
                                                <td><span class="badge bg-${ageClass}">${age} ngày</span></td>
                                                <td>${item.SupplierCode || '-'}</td>
                                                <td>${item.TruckNumber || '-'}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('') || '<div class="text-center text-muted">Không tìm thấy nguyên liệu nào.</div>';
}

// Get stock for a specific material
function getMaterialStock(materialId) {
    return stockData
        .filter(item => item.MaterialID == materialId)
        .sort((a, b) => new Date(a.InputDate) - new Date(b.InputDate)); // Cũ nhất lên đầu
}

// Populate filters and selects
function populateFilters() {
    populateMaterialSelect();
    populateSupplierFilter();
}

function populateMaterialSelect() {
    const select = document.getElementById('materialSelect');
    if (!select) return;

    select.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' +
        materials
            .filter(m => m.Active)
            .map(material => 
                `<option value="${material.ID}">${material.Name} (${material.Code})</option>`
            ).join('');
}

function populateSupplierFilter() {
    const select = document.getElementById('supplierFilter');
    if (!select) return;

    const suppliers = [...new Set(stockData.map(item => item.SupplierCode).filter(Boolean))];
    
    select.innerHTML = '<option value="">Tất cả NCC</option>' +
        suppliers.map(supplier => 
            `<option value="${supplier}">${supplier}</option>`
        ).join('');
}

// Add new transaction
async function addTransaction() {
    const materialId = document.getElementById('materialSelect').value;
    const locationCode = document.getElementById('locationCode').value.trim();
    const receiveBags = parseInt(document.getElementById('receiveBags').value) || 0;
    const receiveWeight = parseFloat(document.getElementById('receiveWeight').value) || 0;
    const supplierCode = document.getElementById('supplierCode').value.trim();
    const truckNumber = document.getElementById('truckNumber').value.trim();

    // Validation
    if (!materialId) {
        alert('Vui lòng chọn nguyên liệu');
        return;
    }

    if (!locationCode) {
        alert('Vui lòng nhập vị trí LOC');
        return;
    }

    if (receiveBags === 0 && receiveWeight === 0) {
        alert('Vui lòng nhập số bao hoặc trọng lượng nhập kho');
        return;
    }

    const material = materials.find(m => m.ID == materialId);
    if (!material) {
        alert('Nguyên liệu không tồn tại');
        return;
    }

    const transactionData = {
        materialId: materialId,
        loc: locationCode,
        bags: receiveBags,
        weight: receiveWeight,
        inputDate: new Date().toISOString().split('T')[0], // Today's date
        supplierCode: supplierCode,
        truckNumber: truckNumber,
        formulaDate: '' // Có thể thêm trường này sau
    };

    try {
        showLoading(true);
        
        const result = await GoogleSheetsAPI.addStock(transactionData);
        
        // Add to local data for immediate UI update
        const newStockItem = {
            ...transactionData,
            ID: stockData.length + 1,
            Age: 0
        };
        stockData.push(newStockItem);
        
        // Update UI
        updateDashboard();
        renderMaterials();
        clearForm();
        
        showLoading(false);
        showSuccess(`✅ Đã thêm lô ${locationCode} cho ${material.Name} thành công!`);
        
    } catch (error) {
        showLoading(false);
        showError('❌ Lỗi khi thêm giao dịch: ' + error.message);
    }
}

// Utility functions
function calculateAge(inputDate) {
    const today = new Date();
    const input = new Date(inputDate);
    const diffTime = Math.abs(today - input);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getAgeClass(age) {
    if (age <= 7) return 'success';
    if (age <= 14) return 'warning';
    return 'danger';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
}

function clearForm() {
    document.getElementById('locationCode').value = '';
    document.getElementById('receiveBags').value = '0';
    document.getElementById('receiveWeight').value = '0';
    document.getElementById('usageBags').value = '0';
    document.getElementById('usageWeight').value = '0';
    document.getElementById('supplierCode').value = '';
    document.getElementById('truckNumber').value = '';
}

function showLoading(show) {
    // Implement loading indicator if needed
    if (show) {
        document.body.style.opacity = '0.7';
    } else {
        document.body.style.opacity = '1';
    }
}

function showSuccess(message) {
    alert(message);
}

function showError(message) {
    alert(message);
}

// Event listeners
function setupEventListeners() {
    // Search and filter events
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const supplierFilter = document.getElementById('supplierFilter');
    
    if (searchInput) searchInput.addEventListener('input', renderMaterials);
    if (sortSelect) sortSelect.addEventListener('change', renderMaterials);
    if (supplierFilter) supplierFilter.addEventListener('change', renderMaterials);
    
    // Refresh button
    const refreshBtn = document.querySelector('button[onclick="loadData()"]');
    if (refreshBtn) {
        refreshBtn.onclick = loadAllData;
    }
}

// Global function for refresh
function loadData() {
    loadAllData();
}
