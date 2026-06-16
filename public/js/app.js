// ==========================================
// APPLICATION STATE STATE CONTROL
// ==========================================
let services = [];
let bookings = [];
let currentRole = 'customer';
let activeCategoryFilter = 'all';
let activeAdminTab = 'services';
let isAdminAuthenticated = false;

// Base API URL config
const API_URL = '/api';

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize date constraint to prevent booking past dates
  const dateInput = document.getElementById('event-date');
  if (dateInput) {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Minimum booking is tomorrow
    const tomorrowStr = today.toISOString().split('T')[0];
    dateInput.setAttribute('min', tomorrowStr);
  }

  // Restore session state if exists
  if (sessionStorage.getItem('admin_authenticated') === 'true') {
    isAdminAuthenticated = true;
    switchRole('admin');
  } else {
    switchRole('customer');
  }
});

// ==========================================
// DATA RETRIEVAL (REST API WRAPPERS)
// ==========================================

// Load catering services
async function loadServices() {
  try {
    const response = await fetch(`${API_URL}/services`);
    if (!response.ok) throw new Error('Failed to fetch services.');
    services = await response.json();
    
    if (currentRole === 'customer') {
      renderCustomerCatalog();
    } else {
      renderAdminDashboard();
    }
  } catch (error) {
    console.error('Error loading services:', error);
    showToast('Failed to load catering services. Please try again.', 'error');
  }
}

// Load bookings
async function loadBookings() {
  if (!isAdminAuthenticated) return;
  try {
    const response = await fetch(`${API_URL}/bookings`);
    if (!response.ok) throw new Error('Failed to fetch bookings.');
    bookings = await response.json();
    renderBookingsList();
    updateDashboardStats();
  } catch (error) {
    console.error('Error loading bookings:', error);
    showToast('Failed to load booking requests.', 'error');
  }
}

// ==========================================
// ROLE SWITCHING ROUTER
// ==========================================
function switchRole(role) {
  currentRole = role;
  
  // Update header button active classes
  const btnCustomer = document.getElementById('btn-customer-view');
  const btnAdmin = document.getElementById('btn-admin-view');
  
  if (role === 'customer') {
    btnCustomer.classList.add('active');
    btnAdmin.classList.remove('active');
    
    document.getElementById('customer-view').classList.add('active');
    document.getElementById('admin-view').classList.remove('active');
    
    loadServices();
  } else {
    if (!isAdminAuthenticated) {
      openAdminLoginModal();
      return;
    }
    
    btnCustomer.classList.remove('active');
    btnAdmin.classList.add('active');
    
    document.getElementById('customer-view').classList.remove('active');
    document.getElementById('admin-view').classList.add('active');
    
    loadServices();
    loadBookings();
  }
}

// ==========================================
// CUSTOMER PORTAL RENDERING
// ==========================================

function renderCustomerCatalog() {
  const grid = document.getElementById('services-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Filter search terms
  const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
  const guestFilterVal = parseInt(document.getElementById('guest-input-filter').value);
  
  // Filter logic: Only active services, matching category, search text, and capacities
  const filtered = services.filter(service => {
    // 1. Must be available for customers
    if (!service.available) return false;
    
    // 2. Category match
    if (activeCategoryFilter !== 'all' && service.category !== activeCategoryFilter) return false;
    
    // 3. Search value match
    if (searchVal) {
      const matchName = service.name.toLowerCase().includes(searchVal);
      const matchDesc = service.description.toLowerCase().includes(searchVal);
      const matchMenu = service.menu.some(item => item.toLowerCase().includes(searchVal));
      if (!matchName && !matchDesc && !matchMenu) return false;
    }
    
    // 4. Capacity filter
    if (guestFilterVal && !isNaN(guestFilterVal)) {
      if (guestFilterVal < service.minGuests || guestFilterVal > service.maxGuests) return false;
    }
    
    return true;
  });
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <i class="fa-solid fa-cookie-bite"></i>
        <h3>No Catering Services Found</h3>
        <p>Try clearing your search query or choosing another event category filter.</p>
      </div>
    `;
    return;
  }
  
  // Build and insert cards
  filtered.forEach(service => {
    const card = document.createElement('div');
    card.className = 'service-card';
    card.onclick = () => openBookingModal(service.id);
    
    card.innerHTML = `
      <div class="card-img-container">
        <img src="${service.image || '/images/wedding_catering.png'}" alt="${service.name}" onerror="this.src='/images/wedding_catering.png'">
        <span class="category-tag">${service.category}</span>
        <span class="availability-tag available">Available</span>
      </div>
      <div class="card-body">
        <h3>${escapeHTML(service.name)}</h3>
        <p>${escapeHTML(service.description)}</p>
        <div class="card-meta">
          <div class="card-price">$${service.price}<span>/ plate</span></div>
          <div class="card-capacity">
            <i class="fa-solid fa-users"></i> ${service.minGuests}-${service.maxGuests}
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function setCategoryFilter(category) {
  activeCategoryFilter = category;
  
  // Update chips CSS active state
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    if (chip.getAttribute('data-category') === category) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  
  renderCustomerCatalog();
}

function filterServices() {
  renderCustomerCatalog();
}

// ==========================================
// CUSTOMER BOOKING INQUIRY FORM MODAL
// ==========================================
function openBookingModal(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  // Populate modal details
  document.getElementById('booking-service-title').innerText = service.name;
  document.getElementById('booking-service-image').src = service.image || '/images/wedding_catering.png';
  document.getElementById('booking-service-image').onerror = function() { this.src = '/images/wedding_catering.png'; };
  document.getElementById('booking-service-category').innerText = service.category;
  document.getElementById('booking-service-desc').innerText = service.description;
  document.getElementById('booking-service-price').innerText = `$${service.price}`;
  document.getElementById('booking-service-min-guests').innerText = `${service.minGuests} guests`;
  document.getElementById('booking-service-max-guests').innerText = `${service.maxGuests} guests`;
  
  // Menu items list creation
  const menuList = document.getElementById('booking-service-menu-list');
  menuList.innerHTML = '';
  service.menu.forEach(item => {
    const li = document.createElement('li');
    li.innerText = item;
    menuList.appendChild(li);
  });
  
  // Set hidden form fields
  document.getElementById('form-service-id').value = service.id;
  document.getElementById('form-service-name').value = service.name;
  
  // Open Modal
  document.getElementById('booking-modal').classList.add('active');
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.remove('active');
  document.getElementById('booking-request-form').reset();
}

async function submitBookingRequest(event) {
  event.preventDefault();
  
  const serviceId = document.getElementById('form-service-id').value;
  const serviceName = document.getElementById('form-service-name').value;
  const customerName = document.getElementById('customer-name').value.trim();
  const customerEmail = document.getElementById('customer-email').value.trim();
  const customerPhone = document.getElementById('customer-phone').value.trim();
  const eventDate = document.getElementById('event-date').value;
  const guestCount = parseInt(document.getElementById('guest-count').value);
  const specialInstructions = document.getElementById('special-instructions').value.trim();
  
  const service = services.find(s => s.id === serviceId);
  if (service) {
    if (guestCount < service.minGuests || guestCount > service.maxGuests) {
      showToast(`Guest count must be between ${service.minGuests} and ${service.maxGuests} for this package.`, 'error');
      return;
    }
  }

  const payload = {
    serviceId,
    serviceName,
    customerName,
    customerEmail,
    customerPhone,
    eventDate,
    guestCount,
    specialInstructions
  };
  
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit booking inquiry.');
    }
    
    showToast('Your booking request has been successfully submitted!', 'success');
    closeBookingModal();
    
    // Reload bookings in case admin is in background
    if (isAdminAuthenticated) {
      loadBookings();
    }
  } catch (error) {
    console.error('Submit booking error:', error);
    showToast(error.message || 'Error submitting request.', 'error');
  }
}

// ==========================================
// ADMIN LOGIN AUTHENTICATION
// ==========================================
function openAdminLoginModal() {
  if (isAdminAuthenticated) {
    switchRole('admin');
  } else {
    document.getElementById('admin-auth-modal').classList.add('active');
    document.getElementById('admin-password').focus();
  }
}

function closeAdminLoginModal() {
  document.getElementById('admin-auth-modal').classList.remove('active');
  document.getElementById('admin-login-form').reset();
  document.getElementById('login-error-msg').innerText = '';
}

function handleAdminLogin(event) {
  event.preventDefault();
  const password = document.getElementById('admin-password').value;
  
  // Simple validation for mock administrative access
  if (password === 'admin' || password === 'admin123') {
    isAdminAuthenticated = true;
    sessionStorage.setItem('admin_authenticated', 'true');
    closeAdminLoginModal();
    showToast('Admin authorization granted.', 'success');
    switchRole('admin');
  } else {
    document.getElementById('login-error-msg').innerText = 'Invalid administrator passcode.';
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

function logoutAdmin() {
  isAdminAuthenticated = false;
  sessionStorage.removeItem('admin_authenticated');
  showToast('Logged out of Admin Mode.', 'info');
  switchRole('customer');
}

// ==========================================
// ADMIN DASHBOARD CORE CONTROLS
// ==========================================

function switchAdminTab(tab) {
  activeAdminTab = tab;
  
  const tabServices = document.getElementById('tab-btn-services');
  const tabBookings = document.getElementById('tab-btn-bookings');
  const panelServices = document.getElementById('tab-panel-services');
  const panelBookings = document.getElementById('tab-panel-bookings');
  
  if (tab === 'services') {
    tabServices.classList.add('active');
    tabBookings.classList.remove('active');
    panelServices.classList.add('active');
    panelBookings.classList.remove('active');
  } else {
    tabServices.classList.remove('active');
    tabBookings.classList.add('active');
    panelServices.classList.remove('active');
    panelBookings.classList.add('active');
  }
}

function updateDashboardStats() {
  document.getElementById('stat-total-services').innerText = services.length;
  document.getElementById('stat-active-services').innerText = services.filter(s => s.available).length;
  document.getElementById('stat-pending-bookings').innerText = bookings.filter(b => b.status === 'pending').length;
  document.getElementById('stat-completed-bookings').innerText = bookings.filter(b => b.status === 'approved' || b.status === 'completed').length;
}

function renderAdminDashboard() {
  updateDashboardStats();
  renderAdminServicesList();
  renderBookingsList();
}

// Render administrative list of services
function renderAdminServicesList() {
  const tbody = document.getElementById('admin-services-list');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color:var(--text-muted);">No services available. Create a new service above!</td></tr>`;
    return;
  }
  
  services.forEach(service => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="table-service-info">
          <img src="${service.image || '/images/wedding_catering.png'}" alt="" onerror="this.src='/images/wedding_catering.png'">
          <div class="table-service-details">
            <h4>${escapeHTML(service.name)}</h4>
            <p>${escapeHTML(service.description)}</p>
          </div>
        </div>
      </td>
      <td><span class="status-badge" style="background:var(--border-light); color:var(--secondary); text-transform:uppercase; font-size:10px;">${service.category}</span></td>
      <td><strong>$${service.price}</strong></td>
      <td>${service.minGuests} - ${service.maxGuests} plates</td>
      <td>
        <label class="switch">
          <input type="checkbox" id="avail-toggle-${service.id}" ${service.available ? 'checked' : ''} onchange="toggleServiceAvailability('${service.id}', this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn-action" title="Edit Service Details" onclick="openEditServiceModal('${service.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action btn-delete" title="Remove Service" onclick="deleteService('${service.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render booking entries table
function renderBookingsList() {
  const tbody = document.getElementById('admin-bookings-list');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color:var(--text-muted);">No bookings requested yet.</td></tr>`;
    return;
  }
  
  // Sort bookings newest first
  const sortedBookings = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  sortedBookings.forEach(booking => {
    const createdDate = new Date(booking.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const eventDateFormated = new Date(booking.eventDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    
    // Status Action items
    let actionButtons = '';
    if (booking.status === 'pending') {
      actionButtons = `
        <button class="btn-action-text btn-approve" onclick="updateBookingStatus('${booking.id}', 'approved')"><i class="fa-solid fa-check"></i> Approve</button>
        <button class="btn-action-text btn-decline" onclick="updateBookingStatus('${booking.id}', 'declined')"><i class="fa-solid fa-xmark"></i> Decline</button>
      `;
    } else if (booking.status === 'approved') {
      actionButtons = `
        <button class="btn-action-text btn-complete" onclick="updateBookingStatus('${booking.id}', 'completed')"><i class="fa-solid fa-circle-check"></i> Complete</button>
      `;
    } else {
      actionButtons = `<span style="font-size:12px; color:var(--text-muted);">No pending actions</span>`;
    }
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${booking.id}</strong>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Request: ${createdDate}</div>
      </td>
      <td>
        <strong style="color:var(--secondary);">${escapeHTML(booking.serviceName)}</strong>
      </td>
      <td>
        <div><strong>${escapeHTML(booking.customerName)}</strong></div>
        <div style="font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-envelope" style="width:14px;"></i> ${escapeHTML(booking.customerEmail)}</div>
        <div style="font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-phone" style="width:14px;"></i> ${escapeHTML(booking.customerPhone)}</div>
      </td>
      <td>
        <strong>${booking.guestCount} guests</strong>
        <div style="font-size:11px; color:var(--primary-hover); margin-top:4px; font-weight:600;"><i class="fa-solid fa-calendar-days"></i> ${eventDateFormated}</div>
      </td>
      <td>
        <div style="font-size:12px; max-width:200px; white-space:normal; overflow:hidden; text-overflow:ellipsis;" title="${escapeHTML(booking.specialInstructions)}">
          ${booking.specialInstructions ? escapeHTML(booking.specialInstructions) : '<span style="color:var(--text-muted); font-style:italic;">None</span>'}
        </div>
      </td>
      <td><span class="status-badge ${booking.status}">${booking.status}</span></td>
      <td>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-start;">
          ${actionButtons}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// CATERING OFFERINGS CRUD OPERATIONS
// ==========================================

async function toggleServiceAvailability(serviceId, isAvailable) {
  try {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const response = await fetch(`${API_URL}/services/${serviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...service, available: isAvailable })
    });
    
    if (!response.ok) throw new Error('Failed to update service status.');
    const updated = await response.json();
    
    // Update local state
    const index = services.findIndex(s => s.id === serviceId);
    if (index !== -1) services[index] = updated;
    
    updateDashboardStats();
    showToast(`"${updated.name}" is now ${isAvailable ? 'visible' : 'hidden'} to customers.`, 'success');
  } catch (error) {
    console.error('Toggle availability error:', error);
    showToast('Failed to toggle service availability status.', 'error');
    // Revert switch visually
    const chk = document.getElementById(`avail-toggle-${serviceId}`);
    if (chk) chk.checked = !isAvailable;
  }
}

async function deleteService(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  if (!confirm(`Are you absolutely sure you want to delete "${service.name}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/services/${serviceId}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete service.');
    
    services = services.filter(s => s.id !== serviceId);
    renderAdminDashboard();
    showToast('Catering service successfully deleted.', 'success');
  } catch (error) {
    console.error('Delete service error:', error);
    showToast('Failed to delete service.', 'error');
  }
}

// Edit and Creation Modal toggling
function openCreateServiceModal() {
  document.getElementById('service-modal-title').innerText = 'Add New Catering Service';
  document.getElementById('upsert-service-id').value = '';
  document.getElementById('service-upsert-form').reset();
  document.getElementById('btn-upsert-submit').innerText = 'Save Catering Package';
  document.getElementById('service-form-modal').classList.add('active');
}

function openEditServiceModal(serviceId) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return;
  
  document.getElementById('service-modal-title').innerText = 'Edit Catering Service';
  document.getElementById('upsert-service-id').value = service.id;
  document.getElementById('service-name').value = service.name;
  document.getElementById('service-description').value = service.description;
  document.getElementById('service-category').value = service.category;
  document.getElementById('service-price').value = service.price;
  document.getElementById('service-min-guests').value = service.minGuests;
  document.getElementById('service-max-guests').value = service.maxGuests;
  document.getElementById('service-image-select').value = service.image;
  document.getElementById('service-menu-items').value = service.menu.join('\n');
  document.getElementById('service-available').checked = service.available;
  
  document.getElementById('btn-upsert-submit').innerText = 'Update Catering Package';
  document.getElementById('service-form-modal').classList.add('active');
}

function closeServiceFormModal() {
  document.getElementById('service-form-modal').classList.remove('active');
  document.getElementById('service-upsert-form').reset();
}

async function handleServiceUpsert(event) {
  event.preventDefault();
  
  const id = document.getElementById('upsert-service-id').value;
  const name = document.getElementById('service-name').value.trim();
  const description = document.getElementById('service-description').value.trim();
  const category = document.getElementById('service-category').value;
  const price = parseFloat(document.getElementById('service-price').value);
  const minGuests = parseInt(document.getElementById('service-min-guests').value);
  const maxGuests = parseInt(document.getElementById('service-max-guests').value);
  const image = document.getElementById('service-image-select').value;
  const menu = document.getElementById('service-menu-items').value.split('\n').map(i => i.trim()).filter(i => i.length > 0);
  const available = document.getElementById('service-available').checked;
  
  if (minGuests > maxGuests) {
    showToast('Minimum capacity cannot exceed maximum capacity.', 'error');
    return;
  }
  
  const payload = { name, description, category, price, minGuests, maxGuests, menu, image, available };
  
  const isEdit = !!id;
  const url = isEdit ? `${API_URL}/services/${id}` : `${API_URL}/services`;
  const method = isEdit ? 'PUT' : 'POST';
  
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) throw new Error('Failed to save catering service details.');
    const saved = await response.json();
    
    if (isEdit) {
      const idx = services.findIndex(s => s.id === id);
      if (idx !== -1) services[idx] = saved;
      showToast('Catering service successfully updated.', 'success');
    } else {
      services.push(saved);
      showToast('Catering service successfully created.', 'success');
    }
    
    closeServiceFormModal();
    renderAdminDashboard();
  } catch (error) {
    console.error('Upsert service error:', error);
    showToast('Failed to save catering service.', 'error');
  }
}

// ==========================================
// BOOKING STAT MANAGEMENT (APPROVE/DECLINE/COMPLETE)
// ==========================================
async function updateBookingStatus(bookingId, status) {
  try {
    const response = await fetch(`${API_URL}/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) throw new Error('Failed to update booking status.');
    const updated = await response.json();
    
    // Update booking item in array
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx !== -1) bookings[idx] = updated;
    
    renderBookingsList();
    updateDashboardStats();
    showToast(`Booking request status set to "${status}".`, 'success');
  } catch (error) {
    console.error('Update booking status error:', error);
    showToast('Failed to update request status.', 'error');
  }
}

// ==========================================
// CLIENT VISUAL UI UTILITIES (TOASTS & SECURITY)
// ==========================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${escapeHTML(message)}</span>
  `;
  
  container.appendChild(toast);
  
  // Set trigger to automatically remove toast
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 4000);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
