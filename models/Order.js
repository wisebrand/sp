const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    required: true
  },
  title: String,
  description: String,
  location: { type: String, default: 'Distribution Center' },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.Mixed
      },
      title: String,
      price: Number,
      quantity: Number,
      image: String
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'processing'
  },
  trackingNumber: {
    type: String,
    default: () => 'SD-TRK-' + Math.floor(100000 + Math.random() * 900000)
  },
  carrier: {
    type: String,
    default: 'SD Express Delivery'
  },
  estimatedDelivery: {
    type: Date,
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 business days
  },
  statusHistory: [statusHistorySchema],
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  paymentMethod: {
    type: String,
    default: 'Credit Card'
  },
  transactionId: {
    type: String,
    default: () => 'TXN-' + Math.floor(100000 + Math.random() * 900000)
  },
  shippingAddress: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-seed initial status history for orders
orderSchema.pre('save', function(next) {
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
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
        description: 'Items packed and labeled for dispatch.',
        location: 'Main Fulfillment Center',
        timestamp: new Date()
      }
    ];
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Order', orderSchema);
