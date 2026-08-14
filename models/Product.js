const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  userName: {
    type: String,
    default: 'Verified Customer'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/300x250?text=Product'
  },
  category: {
    type: String,
    default: 'General'
  },
  brand: {
    type: String,
    default: 'SD Originals'
  },
  stock: {
    type: Number,
    default: 100
  },
  rating: {
    type: Number,
    default: 4.8
  },
  ratingCount: {
    type: Number,
    default: 12
  },
  reviews: [reviewSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Product', productSchema);
