import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import randomstring from "randomstring";
import prisma from "../services/db.service";
import { sendMail } from "../services/mail.service";

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
