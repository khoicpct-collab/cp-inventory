// Dữ liệu mẫu từ file Excel của bạn
let inventoryData = {
    materials: [
        { id: 1, code: "RBF,P", name: "RBF,P" },
        { id: 2, code: "PMBM", name: "PMBM" },
        { id: 3, code: "FM60", name: "FM60" },
        { id: 4, code: "FM65%", name: "FM65%" },
        { id: 5, code: "TAP", name: "TAP" },
        { id: 6, code: "RBS", name: "RBS" }
    ],
    locations: [
        { id: 1, code: "C06", materialId: 1 },
        { id: 2, code: "A09", materialId: 1 },
        { id: 3, code: "A03", materialId: 1 },
        { id: 4, code: "C01", materialId: 2 },
        { id: 5, code: "B04", materialId: 2 },
        { id: 6, code: "B01", materialId: 3 },
        { id: 7, code: "B07", materialId: 3 }
    ],
    transactions: [
        {
            id: 1,
            locationId: 1,
            materialId: 1,
            openingBags: 110,
            openingWeight: 5345,
            receiveBags: 0,
            receiveWeight: 0,
            usageBags: 0,
            usageWeight: 0,
            supplierCode: "10102122922",
            inputDate: "2025-11-04",
            truckNumber: ""
        },
        {
            id: 2,
            locationId: 2,
            materialId: 1,
            openingBags: 721,
            openingWeight: 32116,
            receiveBags: 0,
            receiveWeight: 0,
            usageBags: 0,
            usageWeight: 0,
            supplierCode: "10102122959", 
            inputDate: "2025-11-04",
            truckNumber: ""
        }
    ]
};

// Lưu dữ liệu vào localStorage
function saveData() {
    localStorage.setItem('cpInventoryData', JSON.stringify(inventoryData));
}

// Load dữ liệu từ localStorage
function loadData() {
    const saved = localStorage.getItem('cpInventoryData');
    if (saved) {
        inventoryData = JSON.parse(saved);
    }
    displayData();
    updateStats();
}

// Hiển thị dữ liệu
function displayData() {
    const container = document.getElementById('materialsContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sortBy = document.getElementById('sortSelect').value;
    const supplierFilter = document.getElementById('supplierFilter').value;

    let filteredMaterials = inventoryData.materials.filter(material => {
        const materialTransactions = inventoryData.transactions.filter(t => t.materialId === material.id);
        return materialTransactions.some(t => 
            material.name.toLowerCase().includes(searchTerm) ||
            material.code.toLowerCase().includes(searchTerm) ||
            inventoryData.locations.find(l => l.id === t.locationId)?.code.toLowerCase().includes(searchTerm) ||
            t.supplierCode.toLowerCase().includes(searchTerm)
        );
    });

    // Sắp xếp
    if (sortBy === 'name') {
        filteredMaterials.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'date') {
        // Sắp xếp theo ngày giao dịch mới nhất
        filteredMaterials.sort((a, b) => {
            const aLatest = Math.max(...inventoryData.transactions.filter(t => t.materialId === a.id).map(t => new Date(t.inputDate)));
            const bLatest = Math.max(...inventoryData.transactions.filter(t => t.materialId === b.id).map(t => new Date(t.inputDate)));
            return bLatest - aLatest;
        });
    }

    container.innerHTML = filteredMaterials.map(material => {
        const materialLocations = inventoryData.locations.filter(l => l.materialId === material.id);
        
        return `
            <div class="card material-card mb-3">
                <div class="card-header bg-light">
                    <h5 class="mb-0">
                        <i class="fas fa-box"></i> ${material.name} 
                        <small class="text-muted">(${material.code})</small>
                    </h5>
                </div>
                <div class="card-body">
                    ${materialLocations.map(location => {
                        const locationTransactions = inventoryData.transactions
                            .filter(t => t.locationId === location.id)
                            .filter(t => !supplierFilter || t.supplierCode === supplierFilter)
                            .sort((a, b) => new Date(b.inputDate) - new Date(a.inputDate));
                        
                        if (locationTransactions.length === 0) return '';
                        
                        const latestTransaction = locationTransactions[0];
                        const closingBags = latestTransaction.openingBags + latestTransaction.receiveBags - latestTransaction.usageBags;
                        const closingWeight = latestTransaction.openingWeight + latestTransaction.receiveWeight - latestTransaction.usageWeight;
                        
                        return `
                            <div class="location-section">
                                <h6><i class="fas fa-map-marker-alt text-primary"></i> Vị trí: ${location.code}</h6>
                                <div class="table-responsive">
                                    <table class="table table-sm table-hover">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Ngày</th>
                                                <th>Tồn đầu</th>
                                                <th>Nhập</th>
                                                <th>Xuất</th>
                                                <th>Tồn cuối</th>
                                                <th>Tuổi</th>
                                                <th>NCC</th>
                                                <th>Xe</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${locationTransactions.map(transaction => {
                                                const ageDays = Math.floor((new Date() - new Date(transaction.inputDate)) / (1000 * 60 * 60 * 24));
                                                const closeBags = transaction.openingBags + transaction.receiveBags - transaction.usageBags;
                                                const closeWeight = transaction.openingWeight + transaction.receiveWeight - transaction.usageWeight;
                                                
                                                return `
                                                    <tr class="transaction-row">
                                                        <td>${transaction.inputDate}</td>
                                                        <td>${transaction.openingBags}bao<br><small>${transaction.openingWeight}kg</small></td>
                                                        <td class="text-success">${transaction.receiveBags}bao<br><small>${transaction.receiveWeight}kg</small></td>
                                                        <td class="text-danger">${transaction.usageBags}bao<br><small>${transaction.usageWeight}kg</small></td>
                                                        <td class="fw-bold">${closeBags}bao<br><small>${closeWeight}kg</small></td>
                                                        <td><span class="badge ${ageDays > 30 ? 'bg-warning' : 'bg-info'}">${ageDays} ngày</span></td>
                                                        <td><small>${transaction.supplierCode}</small></td>
                                                        <td><small>${transaction.truckNumber || '-'}</small></td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('') || '<div class="alert alert-info">Không tìm thấy dữ liệu phù hợp</div>';
}

// Cập nhật thống kê
function updateStats() {
    document.getElementById('totalMaterials').textContent = inventoryData.materials.length;
    document.getElementById('totalLocations').textContent = inventoryData.locations.length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = inventoryData.transactions.filter(t => t.inputDate === today).length;
    document.getElementById('todayTransactions').textContent = todayTransactions;
    
    const totalStock = inventoryData.transactions.reduce((sum, transaction) => {
        const closingWeight = transaction.openingWeight + transaction.receiveWeight - transaction.usageWeight;
        return sum + closingWeight;
    }, 0);
    document.getElementById('totalStock').textContent = totalStock.toLocaleString() + ' kg';
    
    // Cập nhật dropdown materials
    const materialSelect = document.getElementById('materialSelect');
    materialSelect.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' +
        inventoryData.materials.map(m => `<option value="${m.id}">${m.name} (${m.code})</option>`).join('');
    
    // Cập nhật dropdown suppliers
    const supplierFilter = document.getElementById('supplierFilter');
    const suppliers = [...new Set(inventoryData.transactions.map(t => t.supplierCode).filter(s => s))];
    supplierFilter.innerHTML = '<option value="">Tất cả NCC</option>' +
        suppliers.map(s => `<option value="${s}">${s}</option>`).join('');
}

// Thêm giao dịch mới
function addTransaction() {
    const materialId = parseInt(document.getElementById('materialSelect').value);
    const locationCode = document.getElementById('locationCode').value.trim();
    const receiveBags = parseInt(document.getElementById('receiveBags').value) || 0;
    const receiveWeight = parseFloat(document.getElementById('receiveWeight').value) || 0;
    const usageBags = parseInt(document.getElementById('usageBags').value) || 0;
    const usageWeight = parseFloat(document.getElementById('usageWeight').value) || 0;
    const supplierCode = document.getElementById('supplierCode').value.trim();
    const truckNumber = document.getElementById('truckNumber').value.trim();

    if (!materialId || !locationCode) {
        alert('Vui lòng chọn nguyên liệu và nhập vị trí!');
        return;
    }

    // Tìm hoặc tạo location mới
    let location = inventoryData.locations.find(l => l.code === locationCode && l.materialId === materialId);
    if (!location) {
        location = {
            id: Math.max(...inventoryData.locations.map(l => l.id), 0) + 1,
            code: locationCode,
            materialId: materialId
        };
        inventoryData.locations.push(location);
    }

    // Tìm transaction gần nhất để lấy closing balance làm opening balance mới
    const latestTransaction = inventoryData.transactions
        .filter(t => t.locationId === location.id)
        .sort((a, b) => new Date(b.inputDate) - new Date(a.inputDate))[0];

    const openingBags = latestTransaction ? (latestTransaction.openingBags + latestTransaction.receiveBags - latestTransaction.usageBags) : 0;
    const openingWeight = latestTransaction ? (latestTransaction.openingWeight + latestTransaction.receiveWeight - latestTransaction.usageWeight) : 0;

    const newTransaction = {
        id: Math.max(...inventoryData.transactions.map(t => t.id), 0) + 1,
        locationId: location.id,
        materialId: materialId,
        openingBags: openingBags,
        openingWeight: openingWeight,
        receiveBags: receiveBags,
        receiveWeight: receiveWeight,
        usageBags: usageBags,
        usageWeight: usageWeight,
        supplierCode: supplierCode,
        truckNumber: truckNumber,
        inputDate: new Date().toISOString().split('T')[0]
    };

    inventoryData.transactions.push(newTransaction);
    saveData();
    displayData();
    updateStats();
    clearForm();
    
    alert('✅ Đã thêm giao dịch thành công!');
}

// Xóa form
function clearForm() {
    document.getElementById('locationCode').value = '';
    document.getElementById('receiveBags').value = '0';
    document.getElementById('receiveWeight').value = '0';
    document.getElementById('usageBags').value = '0';
    document.getElementById('usageWeight').value = '0';
    document.getElementById('supplierCode').value = '';
    document.getElementById('truckNumber').value = '';
}

// Event listeners
document.getElementById('searchInput').addEventListener('input', displayData);
document.getElementById('sortSelect').addEventListener('change', displayData);
document.getElementById('supplierFilter').addEventListener('change', displayData);

// Khởi chạy khi trang load
window.addEventListener('DOMContentLoaded', loadData);
