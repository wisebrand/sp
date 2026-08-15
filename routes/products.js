const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const { authMiddleware } = require('../utils/jwt');

const FALLBACK_PRODUCTS = [
  {
    _id: '1',
    title: 'Wireless Noise-Canceling Headphones',
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life, spatial audio, and high-fidelity drivers.',
    price: 199.99,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Audio',
    brand: 'Sony',
    stock: 50,
    rating: 4.8,
    ratingCount: 34,
    reviews: [
      { userName: 'Michael G.', rating: 5, comment: 'Incredible sound clarity and battery life lasts for days!', createdAt: new Date(Date.now() - 86400000 * 2) },
      { userName: 'Sarah K.', rating: 5, comment: 'Best noise cancellation for work and flights.', createdAt: new Date(Date.now() - 86400000 * 5) },
      { userName: 'David L.', rating: 4, comment: 'Very comfortable cushions, slightly heavy but totally worth it.', createdAt: new Date(Date.now() - 86400000 * 10) }
    ]
  },
  {
    _id: '2',
    title: 'Flagship 5G Ultra Smartphone',
    description: 'Latest model smartphone with OLED display, 5G ultra connectivity, and 108MP triple camera system.',
    price: 899.99,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Electronics',
    brand: 'Samsung',
    stock: 30,
    rating: 4.9,
    ratingCount: 52,
    reviews: [
      { userName: 'Alex R.', rating: 5, comment: 'The camera takes studio-quality photos. Blazing fast CPU.', createdAt: new Date(Date.now() - 86400000 * 3) },
      { userName: 'Emmanuel T.', rating: 5, comment: 'Battery easily lasts all day. Highly recommended.', createdAt: new Date(Date.now() - 86400000 * 7) }
    ]
  },
  {
    _id: '3',
    title: 'Pro Studio Ultra Laptop 16-inch',
    description: 'High-performance laptop for professionals, creators, and developers with 32GB RAM and 1TB SSD.',
    price: 1299.99,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Electronics',
    brand: 'Apple',
    stock: 20,
    rating: 4.7,
    ratingCount: 28,
    reviews: [
      { userName: 'Kwame J.', rating: 5, comment: 'Handles video rendering and coding with zero stutter.', createdAt: new Date(Date.now() - 86400000 * 4) }
    ]
  },
  {
    _id: '4',
    title: 'Fitness Smartwatch Pro Edition',
    description: 'Feature-rich smartwatch with heart rate monitoring, GPS, sleep tracking, and waterproof casing.',
    price: 349.99,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Wearables',
    brand: 'Apple',
    stock: 45,
    rating: 4.6,
    ratingCount: 41,
    reviews: [
      { userName: 'Jessica B.', rating: 5, comment: 'Tracks all my morning runs accurately. Beautiful screen.', createdAt: new Date(Date.now() - 86400000 * 1) }
    ]
  },
  {
    _id: '5',
    title: 'Waterproof Boombox Portable Speaker',
    description: 'Rugged portable speaker with 360-degree bass, IP67 water resistance, and 24-hour battery.',
    price: 79.99,
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1543512214-318c7553f230?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Audio',
    brand: 'JBL',
    stock: 60,
    rating: 4.5,
    ratingCount: 19,
    reviews: [
      { userName: 'Daniel O.', rating: 4, comment: 'Loud punchy bass. Great for outdoor barbecues.', createdAt: new Date(Date.now() - 86400000 * 6) }
    ]
  },
  {
    _id: '6',
    title: 'Braided Fast-Charging USB-C Cable',
    description: 'Durable nylon-braided fast charging cable with reinforced connectors for all modern devices.',
    price: 14.99,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Accessories',
    brand: 'Anker',
    stock: 100,
    rating: 4.9,
    ratingCount: 88,
    reviews: [
      { userName: 'Prince A.', rating: 5, comment: 'Very sturdy cable. Doesn\'t break at the ends.', createdAt: new Date(Date.now() - 86400000 * 8) }
    ]
  },
  {
    _id: '7',
    title: '9H Tempered Glass Screen Protector',
    description: 'Ultra-thin scratch resistant 9H tempered glass screen protector with anti-fingerprint coating.',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Accessories',
    brand: 'Spigen',
    stock: 150,
    rating: 4.4,
    ratingCount: 30,
    reviews: [
      { userName: 'Collins M.', rating: 4, comment: 'Easy bubble-free application. Good protection.', createdAt: new Date(Date.now() - 86400000 * 9) }
    ]
  },
  {
    _id: '8',
    title: 'Shockproof Matte Armor Phone Case',
    description: 'Drop-tested military-grade shockproof phone case with comfortable non-slip grip.',
    price: 24.99,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1586105251261-72a756497a11?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Accessories',
    brand: 'Spigen',
    stock: 80,
    rating: 4.7,
    ratingCount: 45,
    reviews: [
      { userName: 'Grace N.', rating: 5, comment: 'Saved my phone from several drops already. Looks sleek!', createdAt: new Date(Date.now() - 86400000 * 2) }
    ]
  }
];

// In-memory reviews map
const memoryReviews = new Map();

// 1. Get Products with Search, Categories, Price Range, Rating, and Sort
router.get('/', async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, minRating, brand, sort } = req.query;

    let query = {};
    if (category && category !== 'All') {
      query.category = new RegExp('^' + category + '$', 'i');
    }
    if (brand && brand !== 'All') {
      query.brand = new RegExp('^' + brand + '$', 'i');
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    if (minPrice != null || maxPrice != null) {
      query.price = {};
      if (minPrice != null && minPrice !== '') query.price.$gte = Number(minPrice);
      if (maxPrice != null && maxPrice !== '') query.price.$lte = Number(maxPrice);
    }
    if (minRating != null && minRating !== '') {
      query.rating = { $gte: Number(minRating) };
    }

    let sortObj = { createdAt: -1 };
    if (sort === 'price-asc') sortObj = { price: 1 };
    else if (sort === 'price-desc') sortObj = { price: -1 };
    else if (sort === 'rating') sortObj = { rating: -1 };
    else if (sort === 'newest') sortObj = { createdAt: -1 };

    let products = [];
    try {
      products = await Product.find(query).sort(sortObj).maxTimeMS(2500);
    } catch (dbErr) {
      console.warn('Get products DB notice, filtering fallback list:', dbErr.message);
    }

    if (products && products.length > 0) {
      const enriched = products.map(p => {
        const obj = p.toObject ? p.toObject() : { ...p };
        if (!obj.images || obj.images.length === 0) {
          const t = (obj.title || '').toLowerCase();
          const c = (obj.category || '').toLowerCase();
          const match = FALLBACK_PRODUCTS.find(f => {
            const ft = f.title.toLowerCase();
            const fc = f.category.toLowerCase();
            return ft === t || ft.includes(t) || t.includes(ft) || fc === c;
          });
          if (match && match.images) {
            obj.images = match.images;
          } else if (obj.image) {
            obj.images = [obj.image];
          }
        }
        return obj;
      });
      return res.json(enriched);
    }

    // Filter fallback list in-memory if DB has no custom query results
    let filtered = [...FALLBACK_PRODUCTS];
    if (category && category !== 'All') {
      filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (brand && brand !== 'All') {
      filtered = filtered.filter(p => p.brand && p.brand.toLowerCase() === brand.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q))
      );
    }
    if (minPrice != null && minPrice !== '') {
      filtered = filtered.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice != null && maxPrice !== '') {
      filtered = filtered.filter(p => p.price <= Number(maxPrice));
    }
    if (minRating != null && minRating !== '') {
      filtered = filtered.filter(p => (p.rating || 0) >= Number(minRating));
    }

    if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
    else if (sort === 'rating') filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));


    res.json(filtered);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 2. Get Single Product by ID
router.get('/:id', async (req, res) => {
  try {
    let product = null;
    try {
      product = await Product.findById(req.params.id).maxTimeMS(2000);
    } catch (dbErr) {}

    if (!product) {
      const fallback = FALLBACK_PRODUCTS.find(p => p._id === req.params.id);
      if (fallback) {
        const customReviews = memoryReviews.get(fallback._id) || [];
        return res.json({ ...fallback, reviews: [...(fallback.reviews || []), ...customReviews] });
      }
      return res.status(404).json({ error: 'Product not found' });
    }

    const obj = product.toObject ? product.toObject() : { ...product };
    if (!obj.images || obj.images.length === 0) {
      const t = (obj.title || '').toLowerCase();
      const c = (obj.category || '').toLowerCase();
      const match = FALLBACK_PRODUCTS.find(f => {
        const ft = f.title.toLowerCase();
        const fc = f.category.toLowerCase();
        return ft === t || ft.includes(t) || t.includes(ft) || fc === c;
      });
      if (match && match.images) {
        obj.images = match.images;
      } else if (obj.image) {
        obj.images = [obj.image];
      }
    }
    res.json(obj);
  } catch (error) {
    const fallback = FALLBACK_PRODUCTS.find(p => p._id === req.params.id);
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// 3. Post a Review & Star Rating for a Product
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5 || !comment || !comment.trim()) {
      return res.status(400).json({ error: 'Please provide a valid rating (1 to 5 stars) and a written review.' });
    }

    let userName = 'Verified Customer';
    try {
      const user = await User.findById(req.userId).maxTimeMS(1500);
      if (user && user.name) userName = user.name;
    } catch (e) {}

    const newReview = {
      userId: req.userId,
      userName,
      rating: numRating,
      comment: comment.trim(),
      createdAt: new Date()
    };

    let product = null;
    try {
      product = await Product.findById(req.params.id).maxTimeMS(2000);
      if (product) {
        product.reviews = product.reviews || [];
        product.reviews.unshift(newReview);
        const sum = product.reviews.reduce((acc, r) => acc + (r.rating || 5), 0);
        product.rating = Number((sum / product.reviews.length).toFixed(1));
        product.ratingCount = product.reviews.length;
        await product.save();
        return res.status(201).json({ message: 'Review submitted successfully!', product });
      }
    } catch (dbErr) {}

    // In-memory fallback
    const customList = memoryReviews.get(req.params.id) || [];
    customList.unshift(newReview);
    memoryReviews.set(req.params.id, customList);

    res.status(201).json({
      message: 'Review submitted successfully!',
      review: newReview
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// 4. Create Product Route (Admin)
router.post('/', async (req, res) => {
  try {
    const { title, description, price, image, category, brand, stock } = req.body;
    if (!title || !description || price == null) {
      return res.status(400).json({ error: 'Title, description, and price are required' });
    }

    const product = new Product({
      title,
      description,
      price,
      image,
      category: category || 'General',
      brand: brand || 'SD Originals',
      stock: stock || 100
    });
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

module.exports = router;
