# 🚀 Quick Start Guide - SD Shopping Site

This guide will help you get the shopping site up and running with Supabase in 5 minutes.

## Prerequisites

Make sure you have installed:
- **Node.js** (v14 or higher) - Download from https://nodejs.org
- **npm** (comes with Node.js)

## Step 1: Set Up Supabase Account

1. Go to https://supabase.com and sign up for a free account
2. Create a new project:
   - Click "New Project"
   - Name it `sd-shopping`
   - Create a strong database password
   - Choose a region closest to you
   - Click "Create new project" and wait for it to initialize (2-3 minutes)

## Step 2: Get Your Supabase Credentials

Once your project is created:

1. Go to **Settings** → **API** (left sidebar)
2. Copy these three values and keep them handy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (looks like a long string starting with `eyJhb...`)
   - **service_role secret** (looks like another long string, keep this private!)

## Step 3: Run the Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Open the file [db/schema.sql](db/schema.sql) in this folder
4. Copy the entire contents and paste it into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Verify the output shows "Success" - you should see tables created: `users`, `products`, `orders`, `order_items`

## Step 4: Configure Environment

1. Open the `.env` file in this folder
2. Replace the placeholders:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
GMAIL_USER=your_email@gmail.com
GMAIL_PASS=your_app_password_here
```

### For Gmail OTP (Email Verification):

1. Enable 2-Step Verification on your Gmail account: https://myaccount.google.com/security
2. Generate an App Password: https://myaccount.google.com/apppasswords
   - Select "Mail" → "Windows Computer"
   - Copy the 16-character password (without spaces)
3. Paste this into `GMAIL_PASS` in your `.env` file

**Note:** If you skip Gmail setup now, registration won't send OTP emails, but you can use test accounts instead.

## Step 5: Install Dependencies

Open your terminal/command prompt in this folder and run:

```bash
npm install
npm install @supabase/supabase-js
```

This installs all required packages including Express, Supabase client, bcrypt, and others.

## Step 6: Start the Server

In the same terminal, run:

```bash
npm start
```

You should see:
```
✅ SD Shopping Server is running!
📱 Open http://localhost:5000 in your browser
```

## Step 7: Test the Application

1. Open your browser and go to: http://localhost:5000
2. You should see the shopping site homepage with products
3. Try these actions:
   - **Register:** Click "Login" → "Register Tab" → Enter email, password → Click "Send OTP" → Check your email for the code
   - **Login:** After registration, click "Login" and use your credentials
   - **Add to Cart:** Click "Add to Cart" on any product
   - **View Cart:** Click the shopping cart icon
   - **Checkout:** Fill in shipping info and place order

## Troubleshooting

### "Cannot find module 'supabase'"
- Run: `npm install @supabase/supabase-js`

### "Missing SUPABASE_URL or keys"
- Check your `.env` file - make sure the values are filled in correctly
- Values should NOT have quotes around them

### "Port 5000 is already in use"
- Either close the application using port 5000, or change `PORT=5000` to `PORT=5001` in `.env`

### "Gmail OTP not sending"
- Verify GMAIL_USER and GMAIL_PASS are correct in `.env`
- Make sure you used the **App Password** (not your regular Gmail password)
- Check Gmail security settings: https://myaccount.google.com/apppasswords

### Server starts but products don't load
- Make sure you ran the SQL schema (Step 3)
- Check that SUPABASE_URL and keys are correct
- Check browser console (F12) for API errors

## File Structure

```
sp/
├── index.html           # Main shopping site UI
├── style.css            # Complete styling
├── script.js            # Frontend logic
├── server.js            # Express server setup
├── .env                 # Configuration (fill this in!)
├── package.json         # Dependencies list
├── db/
│   └── schema.sql       # Database tables and sample data
├── routes/
│   ├── auth.js          # Login/register/OTP endpoints
│   ├── products.js      # Product catalog endpoints
│   └── orders.js        # Order management endpoints
└── utils/
    ├── supabase.js      # Supabase client initialization
    ├── email.js         # OTP email functions
    └── jwt.js           # Authentication tokens
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/verify-otp` - Verify OTP from email
- `POST /api/auth/login` - Log in user
- `POST /api/auth/resend-otp` - Resend OTP email
- `GET /api/auth/me` - Get current user info (requires login)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product

### Orders
- `POST /api/orders` - Create new order (requires login)
- `GET /api/orders` - Get user's orders (requires login)
- `GET /api/orders/:id` - Get single order details (requires login)

## Next Steps

1. ✅ Complete all 7 steps above
2. Test the application thoroughly
3. Customize:
   - Add more products via database or admin panel
   - Customize colors in `style.css`
   - Update product categories in `script.js`
4. Deploy to production when ready

## Need Help?

- Check the browser console (F12 → Console tab) for JavaScript errors
- Check the terminal output for server errors
- Verify all credentials are correct in `.env`
- Make sure Supabase project is active and database is created

Happy shopping! 🛍️
