const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');

dotenv.config();

const products = [
  {
    title: 'Wireless Headphones',
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life',
    price: 199.99,
    image: 'https://via.placeholder.com/300x250?text=Wireless+Headphones',
    category: 'Electronics',
    stock: 50
  },
  {
    title: 'Smartphone',
    description: 'Latest model smartphone with 5G connectivity and advanced camera system',
    price: 899.99,
    image: 'https://via.placeholder.com/300x250?text=Smartphone',
    category: 'Electronics',
    stock: 30
  },
  {
    title: 'Laptop',
    description: 'High-performance laptop for professionals and students',
    price: 1299.99,
    image: 'https://via.placeholder.com/300x250?text=Laptop',
    category: 'Electronics',
    stock: 20
  },
  {
    title: 'Smartwatch',
    description: 'Feature-rich smartwatch with health monitoring and fitness tracking',
    price: 349.99,
    image: 'https://via.placeholder.com/300x250?text=Smartwatch',
    category: 'Wearables',
    stock: 45
  },
  {
    title: 'Portable Speaker',
    description: 'Waterproof portable speaker with exceptional sound quality',
    price: 79.99,
    image: 'https://via.placeholder.com/300x250?text=Portable+Speaker',
    category: 'Audio',
    stock: 60
  },
  {
    title: 'USB-C Cable',
    description: 'Durable and fast-charging USB-C cable for all devices',
    price: 14.99,
    image: 'https://via.placeholder.com/300x250?text=USB-C+Cable',
    category: 'Accessories',
    stock: 100
  },
  {
    title: 'Screen Protector',
    description: 'Tempered glass screen protector for smartphones',
    price: 9.99,
    image: 'https://via.placeholder.com/300x250?text=Screen+Protector',
    category: 'Accessories',
    stock: 150
  },
  {
    title: 'Phone Case',
    description: 'Protective and stylish phone case with premium materials',
    price: 24.99,
    image: 'https://via.placeholder.com/300x250?text=Phone+Case',
    category: 'Accessories',
    stock: 80
  }
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sd-shopping';
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    await Product.deleteMany({});
    console.log('Cleared existing products');

    const insertedProducts = await Product.insertMany(products);
    console.log(`Seeded ${insertedProducts.length} products successfully`);

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedDatabase();
