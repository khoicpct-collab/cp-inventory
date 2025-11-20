// Dữ liệu tạm thời (sau này sẽ thay bằng Google Sheets)
let inventoryData = [];
let currentFilter = null;

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    populateDropdowns();
    setupEventListeners();
    loadSampleData(); // Tạm thời load dữ liệu mẫu
    renderTable();
}

function populateDropdowns() {
    const materialSelect = document.getElementById('materialName');
    const reportMaterialSelect = document.getElementById('reportMaterial');
    const lockSelect = document.getElementById('lockLocation');

    // Populate materials
    MATERIALS.forEach(material => {
        materialSelect.appendChild(new Option(material, material));
        reportMaterialSelect.appendChild(new Option(material, material));
    });

    // Populate locks
    LOCKS.forEach(lock => {
        lockSelect.appendChild(new Option(lock, lock));
    });
}

function setupEventListeners() {
    // Form events
    document.getElementById('addTransactionBtn').addEventListener('click', showTransactionForm);
    document.getElementById('cancelBtn').addEventListener('click', hideTransactionForm);
    document.getElementById('newTransactionForm').addEventListener('submit', saveTransaction);
    
    // Report events
    document.getElementById('generateReport').addEventListener('click', generateReport);
    document.getElementById('showAll').addEventListener('click', showAllData);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);
    
    // Close modal when clicking outside
    document.getElementById('transactionForm').addEventListener('click', function(e) {
        if (e.target === this) hideTransactionForm();
    });
}

function showTransactionForm() {
    document.getElementById('transactionForm').style.display = 'flex';
    // Set today's date as default
    document.getElementById('inputDate').valueAsDate = new Date();
}

function hideTransactionForm() {
    document.getElementById('transactionForm').style.display = 'none';
    document.getElementById('newTransactionForm').reset();
}

function saveTransaction(e) {
    e.preventDefault();
    
    const transaction = {
        id: Date.now(), // Temporary ID
        date: document.getElementById('inputDate').value,
        name: document.getElementById('materialName').value,
        lock: document.getElementById('lockLocation').value,
        importBags: parseInt(document.getElementById('importBags').value) || 0,
        importWeight: parseFloat(document.getElementById('importWeight').value) || 0,
        usageBags: parseInt(document.getElementById('usageBags').value) || 0,
        usageWeight: parseFloat(document.getElementById('usageWeight').value) || 0,
        codeSupplier: document.getElementById('supplierCode').value,
        formulaDate: document.getElementById('formulaDate').value,
        productionDate: document.getElementById('productionDate').value,
        // Calculated fields will be added in calculateFields()
    };
    
    // Calculate automatic fields
    calculateFields(transaction);
    
    inventoryData.push(transaction);
    hideTransactionForm();
    renderTable();
    
    // In real implementation, save to Google Sheets here
    console.log('New transaction:', transaction);
}

function calculateFields(transaction) {
    // For now, we'll calculate basic fields
    // In complete version, we'll calculate opening stock from previous records
    
    transaction.endingBags = transaction.importBags - transaction.usageBags;
    transaction.endingWeight = transaction.importWeight - transaction.usageWeight;
    transaction.averageWeight = transaction.endingBags > 0 ? 
        (transaction.endingWeight / transaction.endingBags).toFixed(2) : '';
    
    // Calculate storage age
    if (transaction.date) {
        const inputDate = new Date(transaction.date);
        const today = new Date();
        transaction.storageAge = Math.floor((today - inputDate) / (1000 * 60 * 60 * 24));
    } else {
        transaction.storageAge = '';
    }
    
    // For demo, set opening as 0
    transaction.openingBags = 0;
    transaction.openingWeight = 0;
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    const tfoot = document.getElementById('tableFooter');
    
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    
    const dataToRender = currentFilter ? 
        inventoryData.filter(item => filterData(item, currentFilter)) : 
        inventoryData;
    
    // Render table rows
    dataToRender.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.name}</td>
            <td>${item.lock}</td>
            <td>${item.openingBags}</td>
            <td>${item.openingWeight}</td>
            <td>${item.importBags}</td>
            <td>${item.importWeight}</td>
            <td>${item.usageBags}</td>
            <td>${item.usageWeight}</td>
            <td>${item.endingBags}</td>
            <td>${item.endingWeight}</td>
            <td>${item.averageWeight}</td>
            <td>${item.storageAge}</td>
            <td>${item.codeSupplier || ''}</td>
            <td>${formatDate(item.formulaDate)}</td>
            <td>${formatDate(item.productionDate)}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Render footer with totals
    if (dataToRender.length > 0) {
        const totals = calculateTotals(dataToRender);
        const footerRow = document.createElement('tr');
        footerRow.innerHTML = `
            <td colspan="3"><strong>TỔNG CỘNG</strong></td>
            <td><strong>${totals.openingBags}</strong></td>
            <td><strong>${totals.openingWeight}</strong></td>
            <td><strong>${totals.importBags}</strong></td>
            <td><strong>${totals.importWeight}</strong></td>
            <td><strong>${totals.usageBags}</strong></td>
            <td><strong>${totals.usageWeight}</strong></td>
            <td><strong>${totals.endingBags}</strong></td>
            <td><strong>${totals.endingWeight}</strong></td>
            <td colspan="5"></td>
        `;
        tfoot.appendChild(footerRow);
    }
}

// Các hàm hỗ trợ sẽ được tiếp tục trong phần tiếp theo...
