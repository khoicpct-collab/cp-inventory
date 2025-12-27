// app.js - Main application logic

// Global variables
let currentSheet = '01';
let locks = [];
let materials = [];

// Google Apps Script URL - SỬ DỤNG URL NÀY
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwxvF_lpbP7QKH7uu5srD8empsRoPp1dYlxS68d2L8cU1Zjb4lB2eoAnR5Qp_Z3zwN9Zw/exec';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Load locks and materials
    await loadLocksAndMaterials();
    
    // Initialize date selector
    initializeDateSelector();
    
    // Set current date as default for forms
    setDefaultDates();
    
    // Load initial data
    await loadSheetData(currentSheet);
    
    // Set up event listeners
    setupEventListeners();
    
    // Check for end of month
    checkEndOfMonth();
}

// Load locks and materials from external files
async function loadLocksAndMaterials() {
    try {
        // Assuming these are available globally after including the script tags
        if (typeof LOCKS !== 'undefined') {
            locks = LOCKS;
            populateSelect('import-lock', locks);
            populateSelect('export-lock', locks);
        }
        
        if (typeof MATERIALS !== 'undefined') {
            materials = MATERIALS;
            populateSelect('import-material', materials);
            populateSelect('export-material', materials);
        }
    } catch (error) {
        console.error('Error loading locks and materials:', error);
        showNotification('Lỗi', 'Không thể tải danh sách khoá và nguyên liệu', 'error');
    }
}

// Populate select elements with options
function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Chọn --';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Add options from array
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

// Initialize date selector with days of the month
function initializeDateSelector() {
    const select = document.getElementById('sheet-select');
    if (!select) return;
    
    // Clear existing options
    select.innerHTML = '';
    
    // Add options for days 01-31
    for (let i = 1; i <= 31; i++) {
        const day = i.toString().padStart(2, '0');
        const option = document.createElement('option');
        option.value = day;
        option.textContent = `Ngày ${day}`;
        select.appendChild(option);
    }
    
    // Set current day as selected
    const today = new Date().getDate().toString().padStart(2, '0');
    select.value = today;
    currentSheet = today;
    
    // Add change event listener
    select.addEventListener('change', function() {
        currentSheet = this.value;
        loadSheetData(currentSheet);
    });
}

// Set default dates for forms
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('import-date').value = today;
    document.getElementById('export-date').value = today;
}

// Load data from Google Sheets
async function loadSheetData(sheetName) {
    try {
        // Update connection status
        updateConnectionStatus('connecting');
        
        // Make request to Google Apps Script
        const url = `${SCRIPT_URL}?sheet=${sheetName}`;
        console.log('Fetching data from:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Data received:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update UI with data
        updateUI(data);
        
        // Update connection status
        updateConnectionStatus('connected');
        
    } catch (error) {
        console.error('Error loading sheet data:', error);
        updateConnectionStatus('error');
        showNotification('Lỗi', `Không thể tải dữ liệu từ Google Sheets: ${error.message}`, 'error');
    }
}

// Update UI with data from Google Sheets
function updateUI(data) {
    // Update summary cards
    document.getElementById('total-import').textContent = `${formatNumber(data.summary?.totalImport) || 0} tấn`;
    document.getElementById('total-export').textContent = `${formatNumber(data.summary?.totalExport) || 0} tấn`;
    document.getElementById('total-inventory').textContent = `${formatNumber(data.summary?.totalInventory) || 0} tấn`;
    
    // Update silo data
    document.getElementById('silo-import-date').textContent = formatDate(data.silo?.importDate) || '-';
    document.getElementById('silo-inventory').textContent = `${formatNumber(data.silo?.inventory) || 0} tấn`;
    
    // Update liquid data
    document.getElementById('liquid-import-date').textContent = formatDate(data.liquid?.importDate) || '-';
    document.getElementById('liquid-inventory').textContent = `${formatNumber(data.liquid?.inventory) || 0} tấn`;
    
    // Update age inventory data
    if (data.ageInventory) {
        document.getElementById('age-0-30-tons').textContent = `${formatNumber(data.ageInventory['0-30']?.tons) || 0} tấn`;
        document.getElementById('age-0-30-percent').textContent = `${formatNumber(data.ageInventory['0-30']?.percent) || 0}%`;
        
        document.getElementById('age-31-60-tons').textContent = `${formatNumber(data.ageInventory['31-60']?.tons) || 0} tấn`;
        document.getElementById('age-31-60-percent').textContent = `${formatNumber(data.ageInventory['31-60']?.percent) || 0}%`;
        
        document.getElementById('age-61-tons').textContent = `${formatNumber(data.ageInventory['61']?.tons) || 0} tấn`;
        document.getElementById('age-61-percent').textContent = `${formatNumber(data.ageInventory['61']?.percent) || 0}%`;
        
        document.getElementById('age-total-tons').textContent = `${formatNumber(data.ageInventory.total?.tons) || 0} tấn`;
        document.getElementById('age-total-percent').textContent = `${formatNumber(data.ageInventory.total?.percent) || 0}%`;
    }
}

// Format number with 2 decimal places
function formatNumber(value) {
    if (value === null || value === undefined) return '0';
    return parseFloat(value).toFixed(2);
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return '';
    
    // Check if it's already a Date object
    if (dateString instanceof Date) {
        return dateString.toLocaleDateString('vi-VN');
    }
    
    // Try to parse as date string
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        // If not a valid date, return original string
        return dateString;
    }
    
    return date.toLocaleDateString('vi-VN');
}

// Update connection status indicator
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    const indicator = document.getElementById('status-indicator');
    
    if (!statusElement || !indicator) return;
    
    switch (status) {
        case 'connecting':
            statusElement.textContent = 'Đang kết nối...';
            indicator.className = 'status-indicator';
            break;
        case 'connected':
            statusElement.textContent = 'Đã kết nối thành công';
            indicator.className = 'status-indicator connected';
            break;
        case 'error':
            statusElement.textContent = 'Lỗi kết nối';
            indicator.className = 'status-indicator';
            indicator.style.backgroundColor = 'var(--danger-color)';
            break;
    }
}

// Set up event listeners
function setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Form submissions
    document.getElementById('import-form').addEventListener('submit', handleImportSubmit);
    document.getElementById('export-form').addEventListener('submit', handleExportSubmit);
    
    // Modal close
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('modal-confirm').addEventListener('click', closeModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('notification-modal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

// Switch between tabs
function switchTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.getElementById(`${tabId}-tab`).classList.add('active');
}

// Handle import form submission
async function handleImportSubmit(e) {
    e.preventDefault();
    
    const formData = {
        lock: document.getElementById('import-lock').value,
        material: document.getElementById('import-material').value,
        quantity: parseFloat(document.getElementById('import-quantity').value),
        date: document.getElementById('import-date').value,
        type: 'import',
        sheet: currentSheet
    };
    
    await submitData(formData);
}

// Handle export form submission
async function handleExportSubmit(e) {
    e.preventDefault();
    
    const formData = {
        lock: document.getElementById('export-lock').value,
        material: document.getElementById('export-material').value,
        quantity: parseFloat(document.getElementById('export-quantity').value),
        date: document.getElementById('export-date').value,
        type: 'export',
        sheet: currentSheet
    };
    
    await submitData(formData);
}

// Submit data to Google Sheets
async function submitData(formData) {
    try {
        showNotification('Đang xử lý', 'Đang gửi dữ liệu...', 'info');
        
        // Send data to Google Apps Script
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Submission result:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        showNotification('Thành công', 'Dữ liệu đã được lưu thành công', 'success');
        
        // Reset form
        document.getElementById(`${formData.type}-form`).reset();
        setDefaultDates();
        
        // Reload data to reflect changes
        await loadSheetData(currentSheet);
        
    } catch (error) {
        console.error('Error submitting data:', error);
        showNotification('Lỗi', `Không thể lưu dữ liệu: ${error.message}`, 'error');
    }
}

// Check if it's the end of the month
function checkEndOfMonth() {
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    if (today.getDate() === lastDayOfMonth) {
        showEndOfMonthNotification();
    }
}

// Show end of month notification
function showEndOfMonthNotification() {
    showNotification(
        'Cuối tháng', 
        'Hôm nay là ngày cuối tháng. Vui lòng sao lưu dữ liệu và hệ thống sẽ tự động xóa dữ liệu cũ.', 
        'warning',
        true
    );
}

// Show notification modal
function showNotification(title, message, type, showConfirm = false) {
    const modal = document.getElementById('notification-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirm = document.getElementById('modal-confirm');
    
    if (!modal || !modalTitle || !modalMessage) return;
    
    // Set content
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    
    // Style based on type
    modalTitle.className = '';
    switch (type) {
        case 'success':
            modalTitle.style.color = 'var(--success-color)';
            break;
        case 'error':
            modalTitle.style.color = 'var(--danger-color)';
            break;
        case 'warning':
            modalTitle.style.color = 'var(--warning-color)';
            break;
        case 'info':
            modalTitle.style.color = 'var(--primary-color)';
            break;
    }
    
    // Show/hide confirm button
    modalConfirm.style.display = showConfirm ? 'block' : 'none';
    
    // Show modal
    modal.style.display = 'block';
}

// Close modal
function closeModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
