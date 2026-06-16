const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// File paths
const SERVICES_FILE = path.join(__dirname, 'data', 'services.json');
const BOOKINGS_FILE = path.join(__dirname, 'data', 'bookings.json');

// Helper functions to read/write JSON files
const readData = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
};

const writeData = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    return false;
  }
};

// ==========================================
// API Endpoints - Catering Services
// ==========================================

// Get all catering services
app.get('/api/services', (req, res) => {
  const services = readData(SERVICES_FILE);
  res.json(services);
});

// Get a single catering service by ID
app.get('/api/services/:id', (req, res) => {
  const services = readData(SERVICES_FILE);
  const service = services.find(s => s.id === req.params.id);
  if (!service) {
    return res.status(404).json({ error: 'Catering service not found.' });
  }
  res.json(service);
});

// Create a new catering service (Admin only)
app.post('/api/services', (req, res) => {
  const { name, description, category, price, minGuests, maxGuests, menu, image, available } = req.body;
  
  if (!name || !description || !category || !price) {
    return res.status(400).json({ error: 'Please provide name, description, category, and price.' });
  }

  const services = readData(SERVICES_FILE);
  
  const newService = {
    id: 'service-' + uuidv4().substring(0, 8),
    name,
    description,
    category,
    price: Number(price),
    minGuests: minGuests ? Number(minGuests) : 10,
    maxGuests: maxGuests ? Number(maxGuests) : 500,
    menu: Array.isArray(menu) ? menu : [],
    image: image || '/images/default_catering.png',
    available: available === undefined ? true : !!available
  };

  services.push(newService);
  writeData(SERVICES_FILE, services);
  
  res.status(201).json(newService);
});

// Update a catering service (Admin only)
app.put('/api/services/:id', (req, res) => {
  const services = readData(SERVICES_FILE);
  const index = services.findIndex(s => s.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Catering service not found.' });
  }

  const existingService = services[index];
  const { name, description, category, price, minGuests, maxGuests, menu, image, available } = req.body;

  const updatedService = {
    ...existingService,
    name: name !== undefined ? name : existingService.name,
    description: description !== undefined ? description : existingService.description,
    category: category !== undefined ? category : existingService.category,
    price: price !== undefined ? Number(price) : existingService.price,
    minGuests: minGuests !== undefined ? Number(minGuests) : existingService.minGuests,
    maxGuests: maxGuests !== undefined ? Number(maxGuests) : existingService.maxGuests,
    menu: Array.isArray(menu) ? menu : existingService.menu,
    image: image !== undefined ? image : existingService.image,
    available: available !== undefined ? !!available : existingService.available
  };

  services[index] = updatedService;
  writeData(SERVICES_FILE, services);

  res.json(updatedService);
});

// Delete a catering service (Admin only)
app.delete('/api/services/:id', (req, res) => {
  const services = readData(SERVICES_FILE);
  const filteredServices = services.filter(s => s.id !== req.params.id);
  
  if (services.length === filteredServices.length) {
    return res.status(404).json({ error: 'Catering service not found.' });
  }

  writeData(SERVICES_FILE, filteredServices);
  res.json({ message: 'Catering service successfully deleted.' });
});


// ==========================================
// API Endpoints - Bookings
// ==========================================

// Get all bookings (Admin only)
app.get('/api/bookings', (req, res) => {
  const bookings = readData(BOOKINGS_FILE);
  res.json(bookings);
});

// Create a new booking request (Customer)
app.post('/api/bookings', (req, res) => {
  const { serviceId, serviceName, customerName, customerEmail, customerPhone, eventDate, guestCount, specialInstructions } = req.body;

  if (!serviceId || !serviceName || !customerName || !customerEmail || !eventDate || !guestCount) {
    return res.status(400).json({ error: 'Missing required booking details.' });
  }

  const bookings = readData(BOOKINGS_FILE);

  const newBooking = {
    id: 'booking-' + uuidv4().substring(0, 8),
    serviceId,
    serviceName,
    customerName,
    customerEmail,
    customerPhone: customerPhone || 'N/A',
    eventDate,
    guestCount: Number(guestCount),
    specialInstructions: specialInstructions || '',
    status: 'pending', // pending, approved, declined, completed
    createdAt: new Date().toISOString()
  };

  bookings.push(newBooking);
  writeData(BOOKINGS_FILE, bookings);

  res.status(201).json(newBooking);
});

// Update booking status (Admin only)
app.patch('/api/bookings/:id', (req, res) => {
  const { status } = req.body;
  
  if (!status || !['pending', 'approved', 'declined', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid booking status.' });
  }

  const bookings = readData(BOOKINGS_FILE);
  const index = bookings.findIndex(b => b.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Booking request not found.' });
  }

  bookings[index].status = status;
  writeData(BOOKINGS_FILE, bookings);

  res.json(bookings[index]);
});

// Fallback to serve index.html for UI client routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Catering Service Software is running on port ${PORT}`);
  console.log(`Explore at: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
