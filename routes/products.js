const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

const FALLBACK_PRODUCTS = [
  { _id: '1', title: 'Wireless Headphones', description: 'Premium noise-cancelling wireless headphones with 30-hour battery life', price: 199.99, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 50 },
  { _id: '2', title: 'Smartphone', description: 'Latest model smartphone with 5G connectivity and advanced camera system', price: 899.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 30 },
  { _id: '3', title: 'Laptop', description: 'High-performance laptop for professionals and students', price: 1299.99, image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60', category: 'Electronics', stock: 20 },
  { _id: '4', title: 'Smartwatch', description: 'Feature-rich smartwatch with health monitoring and fitness tracking', price: 349.99, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60', category: 'Wearables', stock: 45 },
  { _id: '5', title: 'Portable Speaker', description: 'Waterproof portable speaker with exceptional sound quality', price: 79.99, image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop&q=60', category: 'Audio', stock: 60 },
  { _id: '6', title: 'USB-C Cable', description: 'Durable and fast-charging USB-C cable for all devices', price: 14.99, image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 100 },
  { _id: '7', title: 'Screen Protector', description: 'Tempered glass screen protector for smartphones', price: 9.99, image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 150 },
  { _id: '8', title: 'Phone Case', description: 'Protective and stylish phone case with premium materials', price: 24.99, image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60', category: 'Accessories', stock: 80 }
];

router.get('/', async (req, res) => {
  try {
    const products = await Product.find().maxTimeMS(3000).sort({ createdAt: -1 });
    if (products && products.length > 0) {
      return res.json(products);
    }
    return res.json(FALLBACK_PRODUCTS);
  } catch (error) {
    console.warn('Get products DB notice, serving fallback list:', error.message);
    res.json(FALLBACK_PRODUCTS);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const fallback = FALLBACK_PRODUCTS.find(p => p._id === req.params.id);
      if (fallback) return res.json(fallback);
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    const fallback = FALLBACK_PRODUCTS.find(p => p._id === req.params.id);
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, price, image, category, stock } = req.body;
    if (!title || !description || price == null) {
      return res.status(400).json({ error: 'Title, description, and price are required' });
    }

    const product = new Product({ title, description, price, image, category, stock });
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

module.exports = router;
