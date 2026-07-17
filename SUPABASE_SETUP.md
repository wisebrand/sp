# Supabase Setup Guide

## Step 1: Create Supabase Account & Project

1. Go to **https://supabase.com**
2. Click **Sign Up**
3. Create an account (use GitHub or email)
4. Create a new project:
   - Project name: `sd-shopping`
   - Password: Create a strong password
   - Region: Choose closest to you
   - Click **Create new project**

## Step 2: Get Your Credentials

After project creation (takes ~2 minutes):

1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` → `SUPABASE_URL` in .env
   - `anon public` key → `SUPABASE_ANON_KEY` in .env
   - `service_role secret` key → `SUPABASE_SERVICE_KEY` in .env

## Step 3: Create Database Tables

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy and paste the SQL from `db/schema.sql`
4. Click **Run**

## Step 4: Update .env

Replace these values in `.env`:
```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

## Step 5: Install & Run

```bash
npm install @supabase/supabase-js
npm install pg
npm start
```

## Done! 🎉

Your website now uses Supabase (PostgreSQL) instead of MongoDB!

### Troubleshooting

- **"Connection refused"** → Check SUPABASE_URL is correct
- **"Invalid API key"** → Copy anon key again from Settings
- **Tables not created** → Run the SQL schema in SQL Editor
