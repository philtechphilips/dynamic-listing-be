import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import randomstring from "randomstring";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../services/db.service";
import { sendMail } from "../services/mail.service";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId: number) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
        expiresIn: "1d",
    });
};

export const signup = async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Generate verification token
        const verificationToken = randomstring.generate(32);

        // Create new user
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                verificationToken,
            },
        });

        console.log(`User created with ID: ${newUser.id}`);

        // Send verification email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const emailHtml = `
      <h1>Welcome to Dynamic Listing, ${name}!</h1>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
      <p>If you did not sign up for an account, please ignore this email.</p>
    `;

        await sendMail(email, "Verify your email address", emailHtml);

        return res.status(201).json({
            message: "User created successfully. Please check your email to verify your account.",
        });
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: "Invalid verification token" });
        }

        const user = await prisma.user.findFirst({
            where: { verificationToken: token },
        });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired verification token" });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
            },
        });

        return res.status(200).json({ message: "Email verified successfully! You can now log in." });
    } catch (error) {
        console.error("Verify email error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || !user.password) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        if (!user.isVerified) {
            return res.status(403).json({ message: "Please verify your email address before logging in." });
        }

        const token = generateToken(user.id);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const googleAuth = async (req: Request, res: Response) => {
    try {
        const { credential } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            return res.status(400).json({ message: "Invalid Google token" });
        }

        const { email, name, sub: googleId } = payload;

        let user = await prisma.user.findUnique({
            where: { email: email as string },
        });

        if (!user) {
            // Create user if not exists
            user = await prisma.user.create({
                data: {
                    email: email as string,
                    name: name || "Google User",
                    googleId,
                    isVerified: true, // Google accounts are verified
                },
            });
        } else if (!user.googleId) {
            // Link Google account if user exists but hasn't linked Google
            user = await prisma.user.update({
                where: { email: email as string },
                data: { googleId, isVerified: true },
            });
        }

        const token = generateToken(user.id);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        console.error("Google auth error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const requestOTP = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        let user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Create user if not exists (Signup via OTP)
            user = await prisma.user.create({
                data: {
                    email,
                    name: email.split("@")[0], // Default name
                    otp,
                    otpExpires,
                },
            });
        } else {
            // Update existing user with new OTP
            await prisma.user.update({
                where: { email },
                data: {
                    otp,
                    otpExpires,
                },
            });
        }

        // Send OTP via email
        const emailHtml = `
      <h1>Your Login Code</h1>
      <p>Your verification code is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

        await sendMail(email, "Your Verification Code", emailHtml);

        return res.status(200).json({
            message: "OTP sent to your email.",
        });
    } catch (error) {
        console.error("Request OTP error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const verifyOTP = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        // Clear OTP after successful verification
        const updatedUser = await prisma.user.update({
            where: { email },
            data: {
                otp: null,
                otpExpires: null,
                isVerified: true,
            },
        });

        const token = generateToken(updatedUser.id);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
            },
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

