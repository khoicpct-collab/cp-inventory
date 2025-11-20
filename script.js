// Google Sheets configuration
const SHEET_BASE_URL = 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit#gid=';
const SHEET_DAYS = 31;

// Global variables
let currentTransactions = [];
let materials = [];
let liquids = [];
let locks = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadInitialData();
});

function initializeApp() {
    // Populate day selector
    const daySelect = document.getElementById('reportDay');
    for (let i = 1; i <= 31; i++) {
        const day = i.toString().padStart(2, '0');
        const option = document.createElement('option');
        option.value = day;
        option.textContent = `Ngày ${day}`;
        daySelect.appendChild(option);
    }
    
    // Set current date as default
    const today = new Date().getDate().toString().padStart(2, '0');
    daySelect.value = today;
}

function setupEventListeners() {
    // Form buttons
    document.getElementById('addTransactionBtn').addEventListener('click', showTransactionForm);
    document.getElementById('cancelBtn').addEventListener('click', hideTransactionForm);
    document.getElementById('newTransactionForm').addEventListener('submit', saveTransaction);
    
    // Report buttons
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    document.getElementById('loadSheetData').addEventListener('click', loadSheetData);
    
    // Material type change
    document.getElementById('materialType').addEventListener('change', handleMaterialTypeChange);
    
    // Custom material input
    document.getElementById('materialName').addEventListener('change', function() {
        const customInput = document.getElementById('customMaterial');
        customInput.style.display = this.value === 'custom' ? 'block' : 'none';
    });
    
    // Custom liquid input
    document.getElementById('liquidName').addEventListener('change', function() {
        const customInput = document.getElementById('customLiquid');
        customInput.style.display = this.value === 'custom' ? 'block' : 'none';
    });
}

function loadInitialData() {
    // Load from localStorage or initialize
    const savedData = localStorage.getItem('inventoryData');
    if (savedData) {
        currentTransactions = JSON.parse(savedData);
        updateUI();
    }
    
    // Populate material and lock dropdowns
    populateDropdown('materialName', MATERIALS);
    populateDropdown('lockLocation', LOCKS);
}

function handleMaterialTypeChange() {
    const type = document.getElementById('materialType').value;
    const solidSection = document.getElementById('solidSection');
    const liquidSection = document.getElementById('liquidSection');
    
    if (type === 'solid') {
        solidSection.style.display = 'block';
        liquidSection.style.display = 'none';
    } else if (type === 'liquid') {
        solidSection.style.display = 'none';
        liquidSection.style.display = 'block';
    } else {
        solidSection.style.display = 'none';
        liquidSection.style.display = 'none';
    }
}

function showTransactionForm() {
    document.getElementById('transactionForm').style.display = 'flex';
    // Set current date
    document.getElementById('inputDate').valueAsDate = new Date();
}

function hideTransactionForm() {
    document.getElementById('transactionForm').style.display = 'none';
    document.getElementById('newTransactionForm').reset();
}

function saveTransaction(e) {
    e.preventDefault();
    
    const formData = {
        id: Date.now(),
        date: document.getElementById('inputDate').value,
        type: document.getElementById('materialType').value,
        supplierCode: document.getElementById('supplierCode').value,
        batchNumber: document.getElementById('batchNumber').value,
        formulaDate: document.getElementById('formulaDate').value,
        productionDate: document.getElementById('productionDate').value,
        notes: document.getElementById('notes').value,
        timestamp: new Date().toISOString()
    };
    
    if (formData.type === 'solid') {
        formData.materialName = document.getElementById('customMaterial').value || 
                               document.getElementById('materialName').value;
        formData.location = document.getElementById('lockLocation').value;
        formData.importBags = parseInt(document.getElementById('importBags').value) || 0;
        formData.importWeight = parseFloat(document.getElementById('importWeight').value) || 0;
        formData.usageBags = parseInt(document.getElementById('usageBags').value) || 0;
        formData.usageWeight = parseFloat(document.getElementById('usageWeight').value) || 0;
    } else if (formData.type === 'liquid') {
        formData.materialName = document.getElementById('customLiquid').value || 
                               document.getElementById('liquidName').value;
        formData.location = document.getElementById('siloLocation').value;
        formData.importLiters = parseFloat(document.getElementById('importLiters').value) || 0;
        formData.importWeight = parseFloat(document.getElementById('importLiquidWeight').value) || 0;
        formData.usageLiters = parseFloat(document.getElementById('usageLiters').value) || 0;
        formData.usageWeight = parseFloat(document.getElementById('usageLiquidWeight').value) || 0;
    }
    
    currentTransactions.push(formData);
    saveToLocalStorage();
    updateUI();
    hideTransactionForm();
    
    alert('Data đã được lưu thành công!');
}

function populateDropdown(elementId, dataArray) {
    const dropdown = document.getElementById(elementId);
    dropdown.innerHTML = '<option value="">Chọn...</option>';
    
    dataArray.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id || item.name;
        option.textContent = item.name;
        dropdown.appendChild(option);
    });
    
    // Add custom option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Nhập tay...';
    dropdown.appendChild(customOption);
}

function updateUI() {
    updateTable();
    updateSummary();
    updateAgeInventory();
}

function updateTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    const selectedDay = document.getElementById('reportDay').value;
    const dayTransactions = currentTransactions.filter(transaction => {
        const transactionDay = transaction.date.split('-')[2];
        return transactionDay === selectedDay;
    });
    
    dayTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        if (transaction.type === 'solid') {
            row.innerHTML = `
                <td>${transaction.date}</td>
                <td>Rắn</td>
                <td>${transaction.materialName}</td>
                <td>${transaction.location}</td>
                <td>${transaction.importBags}</td>
                <td>${transaction.importWeight.toFixed(2)}</td>
                <td>${transaction.usageBags}</td>
                <td>${transaction.usageWeight.toFixed(2)}</td>
                <td>${(transaction.importWeight - transaction.usageWeight).toFixed(2)}</td>
                <td>${calculateAge(transaction.date)} ngày</td>
                <td>${transaction.supplierCode}</td>
                <td>${transaction.batchNumber}</td>
                <td>${transaction.notes}</td>
            `;
        } else {
            row.innerHTML = `
                <td>${transaction.date}</td>
                <td>Lỏng</td>
                <td>${transaction.materialName}</td>
                <td>${transaction.location}</td>
                <td>${transaction.importLiters}</td>
                <td>${transaction.importWeight.toFixed(2)}</td>
                <td>${transaction.usageLiters}</td>
                <td>${transaction.usageWeight.toFixed(2)}</td>
                <td>${(transaction.importWeight - transaction.usageWeight).toFixed(2)}</td>
                <td>${calculateAge(transaction.date)} ngày</td>
                <td>${transaction.supplierCode}</td>
                <td>${transaction.batchNumber}</td>
                <td>${transaction.notes}</td>
            `;
        }
        
        tbody.appendChild(row);
    });
}

function updateSummary() {
    const selectedDay = document.getElementById('reportDay').value;
    const dayTransactions = currentTransactions.filter(transaction => {
        const transactionDay = transaction.date.split('-')[2];
        return transactionDay === selectedDay;
    });
    
    let totalImport = 0;
    let totalExport = 0;
    let totalInventory = 0;
    
    dayTransactions.forEach(transaction => {
        totalImport += transaction.importWeight || 0;
        totalExport += transaction.usageWeight || 0;
        totalInventory += (transaction.importWeight - transaction.usageWeight) || 0;
    });
    
    document.getElementById('totalImport').textContent = totalImport.toFixed(2);
    document.getElementById('totalExport').textContent = totalExport.toFixed(2);
    document.getElementById('totalInventory').textContent = totalInventory.toFixed(2);
}

function updateAgeInventory() {
    // This would typically calculate based on inventory age
    // For now, using mock data
    const ageData = [
        { range: '0-7 ngày', tonnage: 45.2, percentage: 32 },
        { range: '8-15 ngày', tonnage: 38.7, percentage: 27 },
        { range: '16-30 ngày', tonnage: 28.4, percentage: 20 },
        { range: '>30 ngày', tonnage: 30.1, percentage: 21 }
    ];
    
    const ageGrid = document.querySelector('.age-grid');
    ageGrid.innerHTML = '';
    
    ageData.forEach(item => {
        const ageItem = document.createElement('div');
        ageItem.className = 'age-item';
        ageItem.innerHTML = `
            <span class="age-days">${item.range}</span>
            <span class="age-tonnage">${item.tonnage} tấn</span>
            <span class="age-percentage">${item.percentage}%</span>
        `;
        ageGrid.appendChild(ageItem);
    });
}

function calculateAge(dateString) {
    const inputDate = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - inputDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function refreshData() {
    loadSheetData();
}

function loadSheetData() {
    const selectedDay = document.getElementById('reportDay').value;
    if (!selectedDay) {
        alert('Vui lòng chọn ngày làm việc');
        return;
    }
    
    // In a real implementation, this would fetch from Google Sheets
    // For now, we'll use localStorage data
    alert(`Đang tải data từ Sheet ngày ${selectedDay}...`);
    updateUI();
}

function saveToLocalStorage() {
    localStorage.setItem('inventoryData', JSON.stringify(currentTransactions));
}

// Google Sheets Integration (placeholder functions)
function connectToGoogleSheet() {
    // This would contain the actual Google Sheets API integration
    console.log('Connecting to Google Sheet...');
}

function exportToGoogleSheet() {
    // Export data to Google Sheets
    console.log('Exporting to Google Sheet...');
}
