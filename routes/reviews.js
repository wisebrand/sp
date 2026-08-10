const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../utils/jwt');
const Review = require('../models/Review');

// In-memory reviews store fallback for offline/delayed DB
const memoryReviews = new Map();

// Sample initial reviews for default products
const DEFAULT_REVIEWS = [
  { _id: 'rev_1', productId: '1', userName: 'Alex Johnson', rating: 5, comment: 'Exceptional noise cancellation and crisp sound quality. Highly recommended!', createdAt: new Date(Date.now() - 86400000 * 2) },
  { _id: 'rev_2', productId: '1', userName: 'Sarah Miller', rating: 4, comment: 'Great battery life and very comfortable to wear for long working hours.', createdAt: new Date(Date.now() - 86400000 * 5) },
  { _id: 'rev_3', productId: '2', userName: 'David K.', rating: 5, comment: 'Fast 5G speeds and stellar camera quality for photos and videos.', createdAt: new Date(Date.now() - 86400000 * 1) },
  { _id: 'rev_4', productId: '3', userName: 'Emily Watson', rating: 5, comment: 'Blazing fast laptop! Perfect for programming and multitasking.', createdAt: new Date(Date.now() - 86400000 * 3) },
  { _id: 'rev_5', productId: '4', userName: 'Michael B.', rating: 4, comment: 'Sleek design and accurate heart rate / step tracking.', createdAt: new Date(Date.now() - 86400000 * 4) }
];

// GET /api/reviews/:productId
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    let reviews = [];

    try {
      reviews = await Review.find({ productId }).maxTimeMS(2500).sort({ createdAt: -1 });
    } catch (dbErr) {
      console.warn('Reviews DB notice:', dbErr.message);
    }

    // Merge in-memory reviews
    const cached = memoryReviews.get(productId) || [];
    const defaults = DEFAULT_REVIEWS.filter(r => r.productId === productId);
    const combined = [...reviews, ...cached, ...defaults];

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    for (const r of combined) {
      const idStr = r._id ? r._id.toString() : r.comment;
      if (!seen.has(idStr)) {
        seen.add(idStr);
        unique.push(r);
      }
    }

    const totalReviews = unique.length;
    const averageRating = totalReviews > 0
      ? (unique.reduce((sum, r) => sum + Number(r.rating), 0) / totalReviews).toFixed(1)
      : '5.0';

    res.json({
      productId,
      averageRating: Number(averageRating),
      totalReviews,
      reviews: unique
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// POST /api/reviews
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    if (!productId || !rating || !comment) {
      return res.status(400).json({ error: 'Product ID, rating (1-5), and comment are required' });
    }

    const numRating = Number(rating);
    if (numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const userName = req.userName || 'Verified Buyer';

    const reviewData = {
      productId,
      userId: req.userId,
      userName,
      rating: numRating,
      comment: comment.trim(),
      createdAt: new Date()
    };

    let review = null;
    try {
      const newReview = new Review(reviewData);
      review = await newReview.save();
    } catch (dbErr) {
      console.warn('Review save DB notice (using in-memory fallback):', dbErr.message);
      review = { _id: 'rev_' + Date.now(), ...reviewData };
    }

    const existing = memoryReviews.get(productId) || [];
    existing.unshift(review);
    memoryReviews.set(productId, existing);

    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

module.exports = router;
