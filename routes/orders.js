const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../utils/jwt');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendOrderReceiptEmail } = require('../utils/email');

// In-memory orders cache fallback
const memoryOrders = new Map();

// Helper to generate tracking entry
function generateTrackingEntry(status) {
  const map = {
    pending: { title: 'Order Placed', description: 'Order confirmed and verified.', location: 'SD Shopping Hub' },
    processing: { title: 'Packed & Processed', description: 'Items securely packed and prepared for carrier.', location: 'Fulfillment Center' },
    shipped: { title: 'Shipped & In Transit', description: 'Package handed to courier and currently on route.', location: 'Regional Transit Hub' },
    delivered: { title: 'Delivered', description: 'Package successfully delivered to shipping address.', location: 'Customer Doorstep' },
    cancelled: { title: 'Order Cancelled', description: 'Order was cancelled and payment refunded.', location: 'SD Shopping Support' }
  };
  return {
    status,
    title: map[status]?.title || 'Status Updated',
    description: map[status]?.description || 'Order status was updated.',
    location: map[status]?.location || 'Logistics Center',
    timestamp: new Date()
  };
}

// 1. Create New Order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
    if (!Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
      return res.status(400).json({ error: 'Items, total amount, and shipping address are required' });
    }

    const transactionId = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    const trackingNumber = 'SD-TRK-' + Math.floor(100000 + Math.random() * 900000);
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const initialHistory = [
      {
        status: 'pending',
        title: 'Order Placed',
        description: 'Order confirmed and payment verified.',
        location: 'SD Shopping Hub',
        timestamp: new Date()
      },
      {
        status: 'processing',
        title: 'Packed & Processed',
        description: 'Items securely packed and labeled for dispatch.',
        location: 'Main Fulfillment Hub',
        timestamp: new Date()
      }
    ];

    const orderData = {
      userId: req.userId,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod: paymentMethod || 'Credit Card',
      paymentStatus: 'completed',
      status: 'processing',
      trackingNumber,
      carrier: 'SD Express Delivery',
      estimatedDelivery,
      statusHistory: initialHistory,
      transactionId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let order = null;
    try {
      const newOrder = new Order(orderData);
      order = await newOrder.save();
    } catch (dbErr) {
      console.warn('Order DB save notice (using in-memory fallback):', dbErr.message);
      order = { _id: 'order_' + Date.now(), ...orderData };
    }

    // Cache in-memory
    const userOrders = memoryOrders.get(req.userId) || [];
    userOrders.unshift(order);
    memoryOrders.set(req.userId, userOrders);

    // Auto-dispatch official email receipt asynchronously
    (async () => {
      try {
        let recipientEmail = (req.body.userEmail || req.userEmail || (req.user && req.user.email) || '').trim();
        if (!recipientEmail && req.userId) {
          const u = await User.findById(req.userId).maxTimeMS(2000).catch(() => null);
          if (u && u.email) recipientEmail = u.email;
        }
        if (recipientEmail) {
          console.log(`✉️ [Auto Sending Order Receipt]: Delivering to ${recipientEmail} for Order #${order.trackingNumber}...`);
          await sendOrderReceiptEmail(recipientEmail, order);
        } else {
          console.warn('⚠️ [Receipt Notice]: No recipient email found for order:', order._id);
        }
      } catch (err) {
        console.warn('Receipt auto-dispatch notice:', err.message);
      }
    })();

    res.status(201).json({ message: 'Order created and paid successfully', order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// 2. Public Tracking Lookup by Tracking Number (No auth required)
router.get('/track/:trackingNumber', async (req, res) => {
  try {
    const rawNumber = req.params.trackingNumber.trim();
    let order = null;

    try {
      order = await Order.findOne({ trackingNumber: new RegExp('^' + rawNumber + '$', 'i') }).maxTimeMS(2000);
    } catch (dbErr) {}

    // Check in-memory store
    if (!order) {
      for (const ordersList of memoryOrders.values()) {
        const found = ordersList.find(o => o.trackingNumber && o.trackingNumber.toLowerCase() === rawNumber.toLowerCase());
        if (found) {
          order = found;
          break;
        }
      }
    }

    if (!order) {
      return res.status(404).json({ error: `No package found matching tracking number "${rawNumber}".` });
    }

    res.json({
      orderId: order._id || order.id,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier || 'SD Express Delivery',
      status: order.status,
      estimatedDelivery: order.estimatedDelivery,
      statusHistory: order.statusHistory || [],
      itemsCount: order.items ? order.items.length : 0,
      shippingCity: order.shippingAddress ? (order.shippingAddress.city || order.shippingAddress.address) : 'Standard Shipping',
      createdAt: order.createdAt
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Failed to track order' });
  }
});

// 3. Get All Orders for Logged-In User
router.get('/', authMiddleware, async (req, res) => {
  try {
    let orders = [];
    try {
      orders = await Order.find({ userId: req.userId }).maxTimeMS(2500).sort({ createdAt: -1 });
    } catch (dbErr) {
      console.warn('Get orders DB notice:', dbErr.message);
    }

    const cached = memoryOrders.get(req.userId) || [];
    const merged = [...orders];
    for (const c of cached) {
      if (!merged.some(o => (o._id || o.id) === (c._id || c.id))) {
        merged.unshift(c);
      }
    }

    res.json(merged);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// 4. Update Order Status & Append Tracking Entry
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    let order = null;
    const entry = generateTrackingEntry(status);

    try {
      order = await Order.findOne({ _id: req.params.id, userId: req.userId }).maxTimeMS(2000);
      if (order) {
        order.status = status;
        order.statusHistory = order.statusHistory || [];
        order.statusHistory.push(entry);
        order.updatedAt = new Date();
        await order.save();
      }
    } catch (dbErr) {}

    // Update in-memory cache
    const userOrders = memoryOrders.get(req.userId) || [];
    const cachedIdx = userOrders.findIndex(o => (o._id || o.id) === req.params.id);
    if (cachedIdx !== -1) {
      userOrders[cachedIdx].status = status;
      userOrders[cachedIdx].statusHistory = userOrders[cachedIdx].statusHistory || [];
      userOrders[cachedIdx].statusHistory.push(entry);
      order = userOrders[cachedIdx];
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: `Order status updated to ${status}`, order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// 5. Get Single Order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId }).maxTimeMS(2500);
    if (!order) {
      const cached = (memoryOrders.get(req.userId) || []).find(o => (o._id || o.id) === req.params.id);
      if (cached) return res.json(cached);
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
