const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const { authMiddleware } = require('../utils/jwt');

const FALLBACK_PRODUCTS = [
  {
    _id: '1',
    title: 'Italian Saffiano Leather Tote Bag',
    description: 'Structured designer leather tote bag with gold-tone hardware, top zip closure, and spacious multi-compartment interior.',
    price: 1250.00,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1591561954557-26941169b49e?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Handbags & Totes',
    brand: 'Prada',
    stock: 25,
    rating: 4.9,
    ratingCount: 42,
    reviews: [
      { userName: 'Abena M.', rating: 5, comment: 'The leather quality is top-notch! Genuine Italian craft.', createdAt: new Date(Date.now() - 86400000 * 2) },
      { userName: 'Efua K.', rating: 5, comment: 'Fits my 13-inch laptop and daily makeup essentials perfectly.', createdAt: new Date(Date.now() - 86400000 * 5) }
    ]
  },
  {
    _id: '2',
    title: 'Air Max Urban Running Sneakers',
    description: 'Lightweight responsive athletic sneakers with breathable mesh upper, cushioned air sole, and high-traction tread.',
    price: 680.00,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Sneakers & Trainers',
    brand: 'Nike',
    stock: 40,
    rating: 4.8,
    ratingCount: 65,
    reviews: [
      { userName: 'Kofi A.', rating: 5, comment: 'Super comfy for running and daily street casual wear. 100% authentic Nike.', createdAt: new Date(Date.now() - 86400000 * 3) }
    ]
  },
  {
    _id: '3',
    title: 'Classic Pointed Stiletto Pumps',
    description: 'Elegant 4-inch stiletto heels crafted with premium gloss finish, padded comfort insole, and sleek silhouette.',
    price: 420.00,
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Heels & Pumps',
    brand: 'Zara',
    stock: 30,
    rating: 4.7,
    ratingCount: 38,
    reviews: [
      { userName: 'Akosua B.', rating: 5, comment: 'Wore these for a wedding in Accra and received so many compliments!', createdAt: new Date(Date.now() - 86400000 * 4) }
    ]
  },
  {
    _id: '4',
    title: 'Waterproof Travel Laptop Backpack',
    description: 'Durable weather-resistant commuter backpack with 16-inch padded laptop sleeve, anti-theft pocket, and USB pass-through.',
    price: 320.00,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1577733966973-d680bffd2e80?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Backpacks & Travel',
    brand: 'SD Originals',
    stock: 50,
    rating: 4.9,
    ratingCount: 54,
    reviews: [
      { userName: 'Emmanuel S.', rating: 5, comment: 'Solid zippers and water-resistant fabric. Great travel bag.', createdAt: new Date(Date.now() - 86400000 * 1) }
    ]
  },
  {
    _id: '5',
    title: 'Handcrafted Penny Leather Loafers',
    description: 'Timeless slip-on dress shoes made with genuine burnished calfskin leather, leather lining, and non-slip rubber soles.',
    price: 590.00,
    image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Loafers & Dress Shoes',
    brand: 'Clarks',
    stock: 35,
    rating: 4.8,
    ratingCount: 29,
    reviews: [
      { userName: 'Kwesi O.', rating: 5, comment: 'Super comfortable right out of the box. Excellent formal shoe.', createdAt: new Date(Date.now() - 86400000 * 7) }
    ]
  },
  {
    _id: '6',
    title: 'Quilted Chain Crossbody Bag',
    description: 'Chic diamond-quilted shoulder bag featuring an adjustable gold-link chain strap and magnetic snap flap.',
    price: 780.00,
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Crossbody & Clutches',
    brand: 'Michael Kors',
    stock: 20,
    rating: 4.9,
    ratingCount: 31,
    reviews: [
      { userName: 'Nana Yaa P.', rating: 5, comment: 'The gold chain detailing is beautiful. Very chic!', createdAt: new Date(Date.now() - 86400000 * 3) }
    ]
  },
  {
    _id: '7',
    title: 'Premium Suede Chelsea Ankle Boots',
    description: 'Classic British ankle boots with elasticated side gussets, pull tabs, and Goodyear welted sole construction.',
    price: 650.00,
    image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1607522370275-f14206abe5d3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Boots & Ankle Boots',
    brand: 'Aldo',
    stock: 28,
    rating: 4.6,
    ratingCount: 22,
    reviews: [
      { userName: 'Samuel D.', rating: 5, comment: 'Rich suede texture and looks amazing with jeans and chinos.', createdAt: new Date(Date.now() - 86400000 * 6) }
    ]
  },
  {
    _id: '8',
    title: 'Ultraboost Streetwear Sport Sneakers',
    description: 'High-energy return sports running shoes with flexible Primeknit upper and Continental rubber outsole.',
    price: 720.00,
    image: 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1579338559194-a162d19bf842?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&auto=format&fit=crop&q=80'
    ],
    category: 'Sneakers & Trainers',
    brand: 'Adidas',
    stock: 45,
    rating: 4.8,
    ratingCount: 47,
    reviews: [
      { userName: 'Richmond K.', rating: 5, comment: 'Cushioning is like walking on clouds. Top tier sneakers.', createdAt: new Date(Date.now() - 86400000 * 4) }
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

// 5. Seed / Reset Catalog Route (Populates fresh Bags & Shoes inventory)
router.post('/reset-seed', async (req, res) => {
  try {
    await Product.deleteMany({});
    const created = await Product.insertMany(
      FALLBACK_PRODUCTS.map(p => {
        const { _id, ...rest } = p;
        return rest;
      })
    );
    res.status(200).json({ message: 'Catalog seeded successfully with Bags and Shoes', count: created.length, products: created });
  } catch (error) {
    console.error('Seed catalog error:', error);
    res.status(500).json({ error: 'Failed to seed catalog' });
  }
});

module.exports = router;
