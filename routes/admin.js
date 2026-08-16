const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { generateAdminToken, adminAuthMiddleware } = require('../utils/jwt');

// Authorized Administrator Accounts (Exclusive access)
const AUTHORIZED_ADMIN_EMAILS = [
  'mikegborbitey05@gmail.com',
  'mikegborbitey05@gmil.com',
  (process.env.ADMIN_EMAIL || '').toLowerCase().trim()
].filter(Boolean);

const ADMIN_CREDENTIALS = {
  email: 'mikegborbitey05@gmail.com',
  password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  name: 'Store Administrator'
};

// Complete default catalog for immediate offline & admin inventory availability
const DEFAULT_CATALOG = [
  { _id: '1', title: 'Italian Saffiano Leather Tote Bag', description: 'Structured designer leather tote bag with gold-tone hardware, top zip closure, and spacious multi-compartment interior.', price: 1250.00, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80', category: 'Handbags & Totes', brand: 'Prada', stock: 25, rating: 4.9, ratingCount: 42, createdAt: new Date() },
  { _id: '2', title: 'Air Max Urban Running Sneakers', description: 'Lightweight responsive athletic sneakers with breathable mesh upper, cushioned air sole, and high-traction tread.', price: 680.00, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80', category: 'Sneakers & Trainers', brand: 'Nike', stock: 40, rating: 4.8, ratingCount: 65, createdAt: new Date() },
  { _id: '3', title: 'Classic Pointed Stiletto Pumps', description: 'Elegant 4-inch stiletto heels crafted with premium gloss finish, padded comfort insole, and sleek silhouette.', price: 420.00, image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80', category: 'Heels & Pumps', brand: 'Zara', stock: 30, rating: 4.7, ratingCount: 28, createdAt: new Date() },
  { _id: '4', title: 'Waterproof Travel Laptop Backpack', description: 'Durable weather-resistant commuter backpack with 16-inch padded laptop sleeve and USB pass-through.', price: 320.00, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80', category: 'Backpacks & Travel', brand: 'SD Originals', stock: 50, rating: 4.9, ratingCount: 51, createdAt: new Date() },
  { _id: '5', title: 'Handcrafted Penny Leather Loafers', description: 'Timeless slip-on dress shoes made with genuine burnished calfskin leather and non-slip rubber soles.', price: 590.00, image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&auto=format&fit=crop&q=80', category: 'Loafers & Dress Shoes', brand: 'Clarks', stock: 35, rating: 4.6, ratingCount: 19, createdAt: new Date() },
  { _id: '6', title: 'Quilted Chain Crossbody Bag', description: 'Chic diamond-quilted shoulder bag featuring an adjustable gold-link chain strap and magnetic snap flap.', price: 780.00, image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80', category: 'Crossbody & Clutches', brand: 'Michael Kors', stock: 20, rating: 4.8, ratingCount: 34, createdAt: new Date() },
  { _id: '7', title: 'Premium Suede Chelsea Ankle Boots', description: 'Classic British ankle boots with elasticated side gussets and Goodyear welted sole construction.', price: 650.00, image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80', category: 'Boots & Ankle Boots', brand: 'Aldo', stock: 28, rating: 4.9, ratingCount: 22, createdAt: new Date() },
  { _id: '8', title: 'Ultraboost Streetwear Sport Sneakers', description: 'High-energy return sports running shoes with flexible knit upper and Continental rubber outsole.', price: 720.00, image: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&auto=format&fit=crop&q=80', category: 'Sneakers & Trainers', brand: 'Adidas', stock: 45, rating: 4.8, ratingCount: 47, createdAt: new Date() },
  { _id: '9', title: 'Monogram Canvas Luxury Handbag', description: 'Iconic patterned top-handle satchel with detachable shoulder strap and padlock detail.', price: 1850.00, image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80', category: 'Handbags & Totes', brand: 'Gucci', stock: 15, rating: 5.0, ratingCount: 16, createdAt: new Date() },
  { _id: '10', title: 'Comfort Leather Slide Sandals', description: 'Casual slip-on slides with contoured footbed, dual buckle straps, and soft leather lining.', price: 210.00, image: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=800&auto=format&fit=crop&q=80', category: 'Sandals & Slides', brand: 'Zara', stock: 60, rating: 4.5, ratingCount: 39, createdAt: new Date() }
];

// Fallback in-memory product list initialized with full default catalog
const memoryAdminProducts = new Map(DEFAULT_CATALOG.map(p => [p._id, { ...p }]));

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

    // STRICT PERMISSION: Only authorized administrator email is accepted
    if (!AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(403).json({
        code: 'ADMIN_ACCESS_DENIED',
        error: 'Access denied: Only the designated store administrator (mikegborbitey05@gmail.com) is authorized to log in to the Admin Portal.'
      });
    }

    let adminUser = null;

    // Check Root Admin Password
    const isRootAdmin = (password === ADMIN_CREDENTIALS.password);

    if (isRootAdmin) {
      adminUser = {
        _id: 'admin_root',
        name: ADMIN_CREDENTIALS.name,
        email: normalizedEmail,
        role: 'admin',
        isAdmin: true
      };
    } else {
      // Check MongoDB user password for this admin account
      try {
        const dbUser = await User.findOne({ email: normalizedEmail }).maxTimeMS(2000);
        if (dbUser && (await dbUser.comparePassword(password))) {
          adminUser = {
            _id: dbUser._id,
            name: dbUser.name || ADMIN_CREDENTIALS.name,
            email: dbUser.email,
            role: 'admin',
            isAdmin: true
          };
        }
      } catch (e) {}
    }

    if (!adminUser) {
      return res.status(401).json({
        code: 'INVALID_ADMIN_CREDENTIALS',
        error: 'Incorrect administrator password. Please verify your admin password and try again.'
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
        role: 'admin',
        isAdmin: true
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

    // Merge in-memory orders
    if (global.sdAllOrders && global.sdAllOrders.length > 0) {
      for (const memO of global.sdAllOrders) {
        const memId = (memO._id || memO.id || '').toString();
        if (!orders.some(o => (o._id || o.id || '').toString() === memId)) {
          orders.unshift(memO);
        }
      }
    }

    // Catalog counts
    if (productsCount === 0) productsCount = memoryAdminProducts.size;

    // Calculate unique customers count
    const uniqueUserEmails = new Set();
    try {
      const allDbUsers = await User.find().select('email').maxTimeMS(1500);
      allDbUsers.forEach(u => u.email && uniqueUserEmails.add(u.email.toLowerCase().trim()));
    } catch (e) {}

    if (global.sdMemoryUsers) {
      for (const email of global.sdMemoryUsers.keys()) {
        uniqueUserEmails.add(email.toLowerCase().trim());
      }
    }

    orders.forEach(o => {
      const em = (o.userEmail || o.shippingAddress?.email || '').toLowerCase().trim();
      if (em) uniqueUserEmails.add(em);
    });

    usersCount = Math.max(usersCount, uniqueUserEmails.size, 1);

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
      recentOrders: orders.slice(0, 6),
      liveTimestamp: new Date().toISOString()
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
      products = Array.from(memoryAdminProducts.values());
    } else {
      // Merge memory additions that might not be in DB yet
      for (const [id, memP] of memoryAdminProducts.entries()) {
        if (!products.some(p => p._id.toString() === id.toString())) {
          products.unshift(memP);
        }
      }
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

    // Also check string vs ObjectId
    for (const key of memoryAdminProducts.keys()) {
      if (key.toString() === productId.toString()) {
        memoryAdminProducts.delete(key);
        deleted = true;
      }
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
    let orders = [];
    try {
      orders = await Order.find().sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    // Merge in-memory orders
    if (global.sdAllOrders && global.sdAllOrders.length > 0) {
      for (const memO of global.sdAllOrders) {
        const memId = (memO._id || memO.id || '').toString();
        if (!orders.some(o => (o._id || o.id || '').toString() === memId)) {
          orders.unshift(memO);
        }
      }
    }

    // Apply status filter
    if (status && status !== 'all') {
      orders = orders.filter(o => (o.status || 'pending').toLowerCase() === status.toLowerCase());
    }

    // Apply search filter
    if (search) {
      const q = search.toLowerCase().trim();
      orders = orders.filter(o => 
        (o.trackingNumber || '').toLowerCase().includes(q) ||
        (o.transactionId || '').toLowerCase().includes(q) ||
        (typeof o.shippingAddress === 'string' ? o.shippingAddress.toLowerCase().includes(q) : false) ||
        (o.shippingAddress?.city || '').toLowerCase().includes(q) ||
        (o.shippingAddress?.address || '').toLowerCase().includes(q)
      );
    }

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

    // Update in global.sdAllOrders
    if (global.sdAllOrders) {
      const memOrder = global.sdAllOrders.find(o => (o._id || o.id || '').toString() === req.params.id.toString());
      if (memOrder) {
        memOrder.status = cleanStatus;
        memOrder.statusHistory = memOrder.statusHistory || [];
        memOrder.statusHistory.push(trackingEntry);
        memOrder.updatedAt = new Date();
        if (!updatedOrder) updatedOrder = memOrder;
      }
    }

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
// 5. REGISTERED CUSTOMERS MANAGEMENT
// -------------------------------------------------------------

router.get('/users', adminAuthMiddleware, async (req, res) => {
  try {
    let users = [];
    try {
      users = await User.find().select('-password').sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    // Include global.sdMemoryUsers
    if (global.sdMemoryUsers && global.sdMemoryUsers.size > 0) {
      for (const [email, u] of global.sdMemoryUsers.entries()) {
        if (!users.some(dbU => (dbU.email || '').toLowerCase() === email.toLowerCase())) {
          users.push(u);
        }
      }
    }

    // Also include any customer accounts from orders
    let allDbOrders = [];
    try {
      allDbOrders = await Order.find().sort({ createdAt: -1 }).maxTimeMS(2500);
    } catch (e) {}

    const combinedOrders = [...allDbOrders, ...(global.sdAllOrders || [])];
    for (const ord of combinedOrders) {
      let custEmail = (ord.userEmail || (ord.shippingAddress && ord.shippingAddress.email) || '').toLowerCase().trim();
      if (!custEmail && ord.userId) {
        custEmail = `customer_${ord.userId.toString().slice(-4)}@sdshopping.com`;
      }
      
      let custName = (ord.shippingAddress && ord.shippingAddress.name) || ord.userName || '';
      if (!custName && typeof ord.shippingAddress === 'string') {
        custName = 'Shopper (' + (ord.shippingAddress.split(',')[0] || 'Accra') + ')';
      }
      if (!custName) custName = 'Valued Customer';

      if (custEmail && !users.some(u => (u.email || '').toLowerCase() === custEmail.toLowerCase())) {
        users.push({
          _id: (ord.userId || 'cust_' + Date.now()).toString(),
          name: custName,
          email: custEmail,
          phone: (ord.shippingAddress && ord.shippingAddress.phone) || ord.phone || '—',
          city: (ord.shippingAddress && ord.shippingAddress.city) || 'Accra',
          address: typeof ord.shippingAddress === 'string' ? ord.shippingAddress : ((ord.shippingAddress && ord.shippingAddress.address) || '14 Independence Ave, Accra'),
          isVerified: true,
          createdAt: ord.createdAt || new Date()
        });
      }
    }

    // Enhance users with exact order counts
    const enhanced = await Promise.all(users.map(async (u) => {
      let orderCount = 0;
      const uEmail = (u.email || '').toLowerCase().trim();
      const uId = (u._id || u.id || '').toString();

      try {
        orderCount = await Order.countDocuments({
          $or: [
            { userId: u._id },
            { userEmail: uEmail },
            { 'shippingAddress.email': uEmail }
          ]
        }).maxTimeMS(1000);
      } catch (e) {}

      // Check global.sdAllOrders
      if (global.sdAllOrders && global.sdAllOrders.length > 0) {
        const memCount = global.sdAllOrders.filter(o => 
          (o.userId && o.userId.toString() === uId) ||
          (o.userEmail && o.userEmail.toLowerCase() === uEmail) ||
          (o.shippingAddress?.email && o.shippingAddress.email.toLowerCase() === uEmail)
        ).length;
        if (memCount > orderCount) orderCount = memCount;
      }

      if (orderCount === 0) {
        // Count from combinedOrders
        orderCount = combinedOrders.filter(o => 
          (o.userId && o.userId.toString() === uId) ||
          ((o.userEmail || (o.shippingAddress && o.shippingAddress.email) || '').toLowerCase().trim() === uEmail)
        ).length;
      }

      return {
        id: u._id || u.id,
        name: u.name || 'Customer',
        email: u.email,
        phone: u.phone || '—',
        city: u.city || '—',
        address: u.address || '—',
        isVerified: u.isVerified !== false,
        orderCount: orderCount || 1,
        createdAt: u.createdAt || new Date()
      };
    }));

    res.json(enhanced);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch registered customers' });
  }
});

// Delete User Account
router.delete('/users/:id', adminAuthMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    let deleted = false;

    try {
      const resDb = await User.findByIdAndDelete(userId).maxTimeMS(2000);
      if (resDb) deleted = true;
    } catch (e) {}

    if (global.sdMemoryUsers) {
      for (const [email, u] of global.sdMemoryUsers.entries()) {
        if (u._id === userId || u.id === userId) {
          global.sdMemoryUsers.delete(email);
          deleted = true;
        }
      }
    }

    console.log(`👤 [Admin Removed User]: ID ${userId}`);

    res.json({ message: 'User account removed successfully from database', id: userId });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user account' });
  }
});

module.exports = router;
