const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { authMiddleware } = require('../utils/jwt');

// Create order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress } = req.body;

    if (!items || !totalAmount || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const order = new Order({
      userId: req.userId,
      items,
      totalAmount,
      shippingAddress,
      status: 'pending',
      paymentStatus: 'pending'
    });

    await order.save();
    res.status(201).json({ message: 'Order created successfully', order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
      .populate('items.productId')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user owns the order
    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Update order status (admin only)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (status) {
      order.status = status;
      order.updatedAt = Date.now();
    }

    await order.save();
    res.json({ message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

module.exports = router;
