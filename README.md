# SD Shopping - Complete E-commerce Website

A full-stack e-commerce platform with user authentication (OTP verification), product catalog, shopping cart, and order management.

## Features

- ✅ User Authentication with Email OTP verification
- ✅ Product catalog with dynamic rendering
- ✅ Shopping cart with local storage
- ✅ Order management system
- ✅ Responsive design
- ✅ Real-time cart updates
- ✅ Toast notifications

## Tech Stack

**Frontend:**
- HTML5
- CSS3
- Vanilla JavaScript
- Font Awesome Icons

**Backend:**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Bcrypt Password Hashing
- Nodemailer (Email OTP)

## Project Structure

```
sp/
├── models/              # Database schemas
│   ├── User.js         # User model with auth
│   ├── Product.js      # Product model
│   └── Order.js        # Order model
├── routes/             # API endpoints
│   ├── auth.js        # Authentication routes
│   ├── products.js    # Product routes
│   └── orders.js      # Order routes
├── utils/             # Helper functions
│   ├── email.js       # Email sending (OTP)
│   └── jwt.js         # JWT token management
├── index.html         # Main frontend
├── script.js          # Frontend logic
├── style.css          # Styling
├── server.js          # Backend server
├── seed.js            # Database seed script
├── package.json       # Dependencies
└── .env              # Environment variables
```

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB (local or cloud)
- Gmail account (for OTP emails)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   
   Edit `.env` file with your settings:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/sd-shopping
   JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
   
   # Gmail Configuration (for OTP)
   GMAIL_USER=your_email@gmail.com
   GMAIL_APP_PASSWORD=your_app_password_here
   ```

3. **Get Gmail App Password:**
   - Go to Google Account Security settings
   - Enable 2-Factor Authentication
   - Generate an App Password
   - Use this password in `.env` as `GMAIL_APP_PASSWORD`

4. **Start MongoDB:**
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Seed the database with sample products:**
   ```bash
   node seed.js
   ```

6. **Start the server:**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```

7. **Open in browser:**
   ```
   http://localhost:5000
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create product (admin)

### Orders
- `POST /api/orders` - Create order (requires auth)
- `GET /api/orders` - Get user orders (requires auth)
- `GET /api/orders/:id` - Get order by ID (requires auth)
- `PATCH /api/orders/:id` - Update order status (requires auth)

## Authentication Flow

1. **Registration:**
   - User fills registration form
   - OTP sent to email
   - User verifies OTP
   - Account created and auto-logged in

2. **Login:**
   - User enters email and password
   - JWT token issued
   - Token stored in localStorage
   - Used for authenticated requests

## Testing

### Test User (after seeding)
You can create a test user or:
1. Register a new account
2. Check console for OTP (in development mode, logs to console)
3. Verify the account

### Test Products
8 sample products are seeded by default including:
- Electronics (headphones, smartphone, laptop, smartwatch)
- Audio (portable speaker)
- Accessories (cables, screen protector, phone case)

## Database Models

### User
- `name` - User's full name
- `email` - Email address (unique)
- `password` - Hashed password
- `isVerified` - Email verification status
- `otp` - OTP code and expiry
- `createdAt` - Account creation timestamp

### Product
- `title` - Product name
- `description` - Product description
- `price` - Price in USD
- `image` - Product image URL
- `category` - Product category
- `stock` - Available quantity

### Order
- `userId` - Reference to User
- `items` - Array of cart items
- `totalAmount` - Order total
- `status` - Order status (pending/confirmed/shipped/delivered)
- `paymentStatus` - Payment status
- `shippingAddress` - Delivery address

## Development Tips

1. **Check Network Tab:**
   - Open DevTools (F12) → Network tab
   - Monitor API calls and responses

2. **Local Storage:**
   - Cart persists in browser localStorage
   - Check: DevTools → Application → Local Storage

3. **Console Errors:**
   - Check browser console for frontend errors
   - Check server logs for backend errors

4. **MongoDB:**
   - Use MongoDB Compass to view database
   - Default connection: mongodb://localhost:27017/sd-shopping

## Troubleshooting

### "Cannot connect to MongoDB"
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- Try connection string: `mongodb://localhost:27017/sd-shopping`

### "Gmail OTP not sending"
- Verify GMAIL_USER and GMAIL_APP_PASSWORD
- Use App Password, not regular Gmail password
- Check 2FA is enabled on Google Account

### "Port 5000 already in use"
- Change PORT in .env
- Or kill the process: `lsof -i :5000` (Mac/Linux) or `netstat -ano | findstr :5000` (Windows)

### "Products not showing"
- Run `node seed.js` to populate products
- Check Network tab for API errors
- Verify MongoDB connection

## Future Enhancements

- [ ] Payment integration (Stripe/PayPal)
- [ ] Admin dashboard
- [ ] Product search and filtering
- [ ] User reviews and ratings
- [ ] Wishlists
- [ ] Email notifications
- [ ] Real-time order tracking
- [ ] Product images upload
- [ ] Discount codes/coupons

## Security Notes

⚠️ **Important for Production:**
- Change JWT_SECRET to a strong random string
- Use HTTPS only
- Store sensitive data securely
- Implement rate limiting
- Add CORS restrictions
- Validate all inputs
- Use environment variables for all secrets
- Enable MongoDB authentication

## License

ISC

## Support

For issues or questions, check the code comments or create an issue.
