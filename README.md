# Dynamic Listing Backend

This is the backend for the Dynamic Listing Application, built with Node.js, Express, and Prisma.

## 🚀 Getting Started

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Environment Configuration**:
   - Copy `.env.example` to `.env`.
   - Update `DATABASE_URL`, `JWT_SECRET`, and Firebase/SMTP credentials.

3. **Database Setup**:

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## 🛠 Tech Stack

- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: MySQL (via mysql2)
- **Services**: Firebase Admin SDK, Nodemailer, Resend

## 📂 Features

- JWT Authentication & Google OAuth
- Admin User Management
- Category & Listing Management
- News & Headlines System
- Comment & Rating API
- File Uploads via Firebase

For more details, see the main [Project README](../README.md).
