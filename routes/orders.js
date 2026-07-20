const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../utils/jwt');
const Order = require('../models/Order');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress } = req.body;
    if (!Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
      return res.status(400).json({ error: 'Items, total amount, and shipping address are required' });
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

router.get('/', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.userId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const updateFields = { updatedAt: new Date() };
    if (status) updateFields.status = status;

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updateFields,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    res.json({ message: 'Order updated successfully', order });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

module.exports = router;
