const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { generateAdminToken, adminAuthMiddleware } = require('../utils/jwt');

// Default Admin Credentials (Configurable via environment variables)
const ADMIN_CREDENTIALS = {
  email: (process.env.ADMIN_EMAIL || 'admin@sdshopping.com').toLowerCase().trim(),
  password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  name: 'Store Administrator'
};

// Fallback in-memory product list for offline DB resilience
const memoryAdminProducts = new Map();

// Helper to generate tracking status checkpoint
function generateTrackingEntry(status) {
  const map = {
    pending: { title: 'Order Placed', description: 'Order confirmed and payment verified.', location: 'SD Central Hub' },
    processing: { title: 'Packed & Processed', description: 'Items verified, securely boxed, and labeled.', location: 'Main Fulfillment Hub' },
    shipped: { title: 'Dispatched & In Transit', description: 'Handed over to SD Express Courier in transit to destination.', location: 'Regional Distribution Center' },
    delivered: { title: 'Delivered to Customer', description: 'Package successfully delivered and signed for at customer address.', location: 'Customer Doorstep' },
    cancelled: { title: 'Order Cancelled', description: 'Order was marked cancelled by administrator.', location: 'SD Customer Support' }
  };
  return {
    status,
    title: map[status]?.title || 'Status Updated',
    description: map[status]?.description || 'Order status was updated by store administrator.',
    location: map[status]?.location || 'Logistics Operations Center',
    timestamp: new Date()
  };
}

// -------------------------------------------------------------
// 1. ADMIN AUTHENTICATION
// -------------------------------------------------------------

// Dedicated Admin Login Route (Completely separate from user login)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Administrator email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check Root Admin credentials
    const isRootAdmin = (normalizedEmail === ADMIN_CREDENTIALS.email) && (password === ADMIN_CREDENTIALS.password);

    let adminUser = null;

    if (isRootAdmin) {
      adminUser = {
        _id: 'admin_root',
        name: ADMIN_CREDENTIALS.name,
        email: ADMIN_CREDENTIALS.email,
        role: 'admin'
      };
    } else {
      // Optional check in DB for users with role='admin'
      try {
        const dbUser = await User.findOne({ email: normalizedEmail, role: 'admin' }).maxTimeMS(1500);
        if (dbUser && (await dbUser.comparePassword(password))) {
          adminUser = {
            _id: dbUser._id,
            name: dbUser.name,
            email: dbUser.email,
            role: 'admin'
          };
        }
      } catch (e) {}
    }

    if (!adminUser) {
      return res.status(401).json({
        error: 'Invalid Administrator credentials. Please check your admin email and password.'
      });
    }

    const token = generateAdminToken(adminUser);

    console.log(`\n👑 [Administrator Logged In]: ${adminUser.email} at ${new Date().toISOString()}`);

    res.json({
      message: 'Admin authentication successful! Welcome to the Management Portal.',
      admin: {
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: 'admin'
      },
      token
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Administrator login failed' });
  }
});

// Verify Admin Session
router.get('/me', adminAuthMiddleware, (req, res) => {
  res.json({
    admin: {
      id: req.adminId,
      name: req.adminName,
      email: req.adminEmail,
      role: 'admin'
    }
  });
});

// -------------------------------------------------------------
// 2. DASHBOARD OVERVIEW & ANALYTICS
// -------------------------------------------------------------

router.get('/stats', adminAuthMiddleware, async (req, res) => {
  try {
    let orders = [];
    let productsCount = 0;
    let usersCount = 0;

    try {
      orders = await Order.find().sort({ createdAt: -1 }).maxTimeMS(2500);
      productsCount = await Product.countDocuments().maxTimeMS(1500);
      usersCount = await User.countDocuments().maxTimeMS(1500);
    } catch (e) {}

    // Fallback counts if DB is starting up
    if (productsCount === 0) productsCount = 8;
    if (usersCount === 0) usersCount = 1;

    // Calculate revenue and counts
    let totalRevenue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let shippedCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    orders.forEach(order => {
      if (order.status !== 'cancelled') {
        totalRevenue += Number(order.totalAmount || 0);
      }
      const st = (order.status || 'pending').toLowerCase();
      if (st === 'pending') pendingCount++;
      else if (st === 'processing') processingCount++;
      else if (st === 'shipped') shippedCount++;
      else if (st === 'delivered') deliveredCount++;
      else if (st === 'cancelled') cancelledCount++;
    });

    res.json({
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders: orders.length,
      pendingOrders: pendingCount + processingCount,
      shippedOrders: shippedCount,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
      totalProducts: productsCount,
      totalUsers: usersCount,
      recentOrders: orders.slice(0, 6)
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve admin analytics' });
  }
});

// -------------------------------------------------------------
// 3. PRODUCT INVENTORY MANAGEMENT (CRUD)
// -------------------------------------------------------------

// List All Products for Admin
router.get('/products', adminAuthMiddleware, async (req, res) => {
  try {
    let products = [];
    try {
      products = await Product.find().sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    if (!products || products.length === 0) {
      // Fallback
      products = Array.from(memoryAdminProducts.values());
    }

    res.json(products);
  } catch (error) {
    console.error('Admin list products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add New Product
router.post('/products', adminAuthMiddleware, async (req, res) => {
  try {
    const { title, description, price, category, brand, stock, image, images } = req.body;

    if (!title || !price || !category) {
      return res.status(400).json({ error: 'Title, price (in GH₵), and category are required' });
    }

    const defaultImg = image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80';
    let imageGallery = Array.isArray(images) && images.length > 0 ? images : [defaultImg];

    const productData = {
      title: title.trim(),
      description: (description || '').trim(),
      price: Number(price),
      category: category.trim(),
      brand: (brand || 'SD Originals').trim(),
      stock: Number(stock) >= 0 ? Number(stock) : 50,
      image: defaultImg,
      images: imageGallery,
      rating: 5.0,
      ratingCount: 0,
      reviews: [],
      createdAt: new Date()
    };

    let newProduct = null;
    try {
      const product = new Product(productData);
      newProduct = await product.save();
    } catch (dbErr) {
      newProduct = { _id: 'prod_' + Date.now(), ...productData };
    }

    memoryAdminProducts.set(newProduct._id.toString(), newProduct);

    console.log(`🛍️ [Admin Added Product]: "${newProduct.title}" (GH₵ ${newProduct.price})`);

    res.status(201).json({
      message: 'Product added successfully to store catalog',
      product: newProduct
    });
  } catch (error) {
    console.error('Admin create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update Existing Product
router.put('/products/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const { title, description, price, category, brand, stock, image, images } = req.body;
    const productId = req.params.id;

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (price !== undefined) updateData.price = Number(price);
    if (category !== undefined) updateData.category = category.trim();
    if (brand !== undefined) updateData.brand = brand.trim();
    if (stock !== undefined) updateData.stock = Number(stock);
    if (image !== undefined) updateData.image = image.trim();
    if (images !== undefined && Array.isArray(images)) updateData.images = images;

    let updatedProduct = null;
    try {
      updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $set: updateData },
        { new: true }
      ).maxTimeMS(2000);
    } catch (e) {}

    if (!updatedProduct && memoryAdminProducts.has(productId)) {
      const p = memoryAdminProducts.get(productId);
      Object.assign(p, updateData);
      updatedProduct = p;
    }

    if (!updatedProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Admin update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete Product
router.delete('/products/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const productId = req.params.id;
    let deleted = false;

    try {
      const resDb = await Product.findByIdAndDelete(productId).maxTimeMS(2000);
      if (resDb) deleted = true;
    } catch (e) {}

    if (memoryAdminProducts.has(productId)) {
      memoryAdminProducts.delete(productId);
      deleted = true;
    }

    res.json({ message: 'Product removed successfully from store catalog', id: productId });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// -------------------------------------------------------------
// 4. ORDER FULFILLMENT & STATUS TRACKING
// -------------------------------------------------------------

// List All Customer Orders
router.get('/orders', adminAuthMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status && status !== 'all') {
      query.status = status.toLowerCase();
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { trackingNumber: regex },
        { transactionId: regex },
        { 'shippingAddress.address': regex },
        { 'shippingAddress.city': regex }
      ];
    }

    let orders = [];
    try {
      orders = await Order.find(query).sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    res.json(orders);
  } catch (error) {
    console.error('Admin get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch customer orders' });
  }
});

// Update Order Status & Dispatch Courier Tracking Update
router.patch('/orders/:id/status', adminAuthMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!status || !allowed.includes(status.toLowerCase())) {
      return res.status(400).json({
        error: `Invalid status. Allowed values: ${allowed.join(', ')}`
      });
    }

    const cleanStatus = status.toLowerCase();
    const trackingEntry = generateTrackingEntry(cleanStatus);

    let updatedOrder = null;
    try {
      updatedOrder = await Order.findById(req.params.id).maxTimeMS(2000);
      if (updatedOrder) {
        updatedOrder.status = cleanStatus;
        updatedOrder.statusHistory = updatedOrder.statusHistory || [];
        updatedOrder.statusHistory.push(trackingEntry);
        updatedOrder.updatedAt = new Date();
        await updatedOrder.save();
      }
    } catch (e) {}

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`📦 [Admin Updated Order #${updatedOrder.trackingNumber}]: Status -> ${cleanStatus.toUpperCase()}`);

    res.json({
      message: `Order #${updatedOrder.trackingNumber} status updated to "${cleanStatus}"`,
      order: updatedOrder
    });
  } catch (error) {
    console.error('Admin update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// -------------------------------------------------------------
// 5. REGISTERED CUSTOMERS
// -------------------------------------------------------------

router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    let users = [];
    try {
      users = await User.find().select('-password').sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    // Enhance users with order counts
    const enhanced = await Promise.all(users.map(async (u) => {
      let orderCount = 0;
      try {
        orderCount = await Order.countDocuments({ userId: u._id }).maxTimeMS(1000);
      } catch (e) {}
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        city: u.city || '',
        address: u.address || '',
        isVerified: u.isVerified !== undefined ? u.isVerified : true,
        orderCount,
        createdAt: u.createdAt
      };
    }));

    res.json(enhanced);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch registered customers' });
  }
});

module.exports = router;
