# SD Shopping - MongoDB Starter

A fresh, minimal shopping backend using Node.js, Express, MongoDB, Mongoose, JWT auth, and email OTP verification.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and update values.
3. Start MongoDB locally or set a MongoDB Atlas connection string in `MONGODB_URI`.
4. Seed sample products:
   ```bash
   node seed.js
   ```
5. Start the server:
   ```bash
   npm run dev
   ```
6. Open the app:
   ```
   http://localhost:5000
   ```

## Environment Variables

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sd-shopping
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password_here
```

## API

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/resend-otp`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id`

## Notes

- `GMAIL_APP_PASSWORD` is required for OTP email delivery.
- `JWT_SECRET` must be a strong random string.
- This project uses MongoDB and no longer depends on Supabase.
