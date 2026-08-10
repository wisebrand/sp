-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  otp_code VARCHAR(6),
  otp_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image VARCHAR(500),
  category VARCHAR(100),
  stock INTEGER DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  shipping_address JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  title VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  image VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Insert sample products
INSERT INTO products (title, description, price, image, category, stock) VALUES
('Wireless Headphones', 'Premium noise-cancelling wireless headphones with 30-hour battery life', 199.99, 'https://via.placeholder.com/300x250?text=Wireless+Headphones', 'Electronics', 50),
('Smartphone', 'Latest model smartphone with 5G connectivity and advanced camera system', 899.99, 'https://via.placeholder.com/300x250?text=Smartphone', 'Electronics', 30),
('Laptop', 'High-performance laptop for professionals and students', 1299.99, 'https://via.placeholder.com/300x250?text=Laptop', 'Electronics', 20),
('Smartwatch', 'Feature-rich smartwatch with health monitoring and fitness tracking', 349.99, 'https://via.placeholder.com/300x250?text=Smartwatch', 'Wearables', 45),
('Portable Speaker', 'Waterproof portable speaker with exceptional sound quality', 79.99, 'https://via.placeholder.com/300x250?text=Portable+Speaker', 'Audio', 60),
('USB-C Cable', 'Durable and fast-charging USB-C cable for all devices', 14.99, 'https://via.placeholder.com/300x250?text=USB-C+Cable', 'Accessories', 100),
('Screen Protector', 'Tempered glass screen protector for smartphones', 9.99, 'https://via.placeholder.com/300x250?text=Screen+Protector', 'Accessories', 150),
('Phone Case', 'Protective and stylish phone case with premium materials', 24.99, 'https://via.placeholder.com/300x250?text=Phone+Case', 'Accessories', 80)
ON CONFLICT DO NOTHING;
