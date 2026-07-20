# MongoDB Setup Guide

## Local MongoDB

1. Install MongoDB Community Edition:
   - Windows: https://www.mongodb.com/try/download/community
   - macOS: `brew tap mongodb/brew && brew install mongodb-community`

2. Start MongoDB locally:
   ```bash
   mongod
   ```

3. Set `MONGODB_URI` in `.env`:
   ```text
   MONGODB_URI=mongodb://localhost:27017/sd-shopping
   ```

## MongoDB Atlas

1. Create a free cluster at https://www.mongodb.com/cloud/atlas
2. Create a database user with a password.
3. Copy the connection string and update `MONGODB_URI`.

Example:
```
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/sd-shopping?retryWrites=true&w=majority
```

## Final `.env` Example

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sd-shopping
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password_here
```
