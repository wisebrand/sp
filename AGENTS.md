# Antigravity Operating Rules & Pairing Workflow

## 1. Core Rule: `sps` is for LOCAL and `sp` is for ONLINE (Push After Every Change)
- **`sps` (Local)**: Local dev environment with `.env` secrets, test configurations, and active Express server.
- **`sp` (Online)**: Production repo for live online hosting.
- **Push After Every Change**: After applying code changes from `sps` to `sp`, automatically commit and push to remote (`origin main`). **STRICTLY EXCLUDE SECRET FILES** (`.env`, `.env.*`).

## 2. Zero-Prompt Autonomous Execution
- **Never ask "Do you want to proceed?"** or seek confirmation before executing code changes, creating components, fixing bugs, or running terminal commands.
- Proceed immediately with implementation, run commands, verify syntax, push changes, and report completion directly.

## 3. Server & Runtime Automation
- **Node.js**: Backend server runs on `node server.js` (port `5000`).
- **npm**: Use npm to manage dependencies (`npm install`, `npm.cmd start`).
- **MongoDB**: Auto-connect with MongoDB Atlas and fallback DNS (`8.8.8.8`, `1.1.1.1`).
- **Antigravity Automation**: Run `node antigravity.js` to trigger sync, checks, and remote pushes.

## 4. Exclusive Admin Access
- **Admin Email**: `mikegborbitey05@gmail.com` (also tolerates `mikegborbitey05@gmil.com`).
- **Visibility**: Only `mikegborbitey05@gmail.com` can see the Admin buttons (hidden everywhere for regular users and guests).
- **Security**: Reject any other email attempting to log in to the admin portal (`403 Forbidden`).
