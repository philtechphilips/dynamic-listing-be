/**
 * =============================================================================
 * AUTHENTICATION CONTROLLER
 * =============================================================================
 * 
 * This controller handles all authentication-related operations including:
 * - User registration (signup) with email verification
 * - Traditional email/password login
 * - Google OAuth authentication
 * - OTP (One-Time Password) authentication
 * - Password reset and change
 * - Profile image updates
 * 
 * All endpoints return consistent JSON responses with:
 * - message: Human-readable status message
 * - token: JWT token (on successful authentication)
 * - user: User object (on successful authentication)
 * 
 * @module controllers/auth.controller
 */

import { Request, Response } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";
import randomstring from "randomstring";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import prisma from "../services/db.service";
import { sendMailInBackground } from "../services/mail.service";
import { uploadToFirebase } from "../services/upload.service";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Google OAuth client for verifying Google credentials */
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Generates a JWT token for a user.
 * Token expires in 1 day.
 * 
 * @param {string} userId - The user's database ID
 * @returns {string} Signed JWT token
 */
const generateToken = (userId: string) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
  });
};

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * User Signup
 * 
 * Creates a new user account with email/password authentication.
 * Sends a verification email that user must click to activate account.
 * 
 * @route POST /auth/signup
 * @param {Request} req - Express request with { name, email, password } body
 * @param {Response} res - Express response
 * @returns {201} User created, verification email sent
 * @returns {400} User already exists
 * @returns {500} Server error
 */
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

    // Hash password with bcrypt (12 rounds)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate random verification token
    const verificationToken = randomstring.generate(32);

    // Create new user in database
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        verificationToken,
      },
    });

    console.log(`User created with ID: ${newUser.id}`);

    // Send verification email (non-blocking)
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 20px;">
<p>Hi ${name},</p>
<p>Please verify your email by clicking the link below:</p>
<p><a href="${verificationUrl}">${verificationUrl}</a></p>
<p>If you did not sign up, please ignore this email.</p>
</body>
</html>`;

    sendMailInBackground(email, "Verify your email address", emailHtml);

    return res.status(201).json({
      message:
        "User created successfully. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Email Verification
 * 
 * Verifies a user's email address using the token sent during signup.
 * Once verified, the user can log in to their account.
 * 
 * @route GET /auth/verify-email?token=xxx
 * @param {Request} req - Express request with { token } query param
 * @param {Response} res - Express response
 * @returns {200} Email verified successfully
 * @returns {400} Invalid or expired token
 * @returns {500} Server error
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return res
      .status(200)
      .json({ message: "Email verified successfully! You can now log in." });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Email/Password Login
 * 
 * Authenticates a user with their email and password.
 * Returns a JWT token on successful authentication.
 * 
 * @route POST /auth/login
 * @param {Request} req - Express request with { email, password } body
 * @param {Response} res - Express response
 * @returns {200} Login successful with token and user data
 * @returns {401} Invalid credentials
 * @returns {403} Email not verified
 * @returns {500} Server error
 */
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
      return res
        .status(403)
        .json({
          message: "Please verify your email address before logging in.",
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
        role: user.role,
        image: user.image,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const {
      credential,
      email: directEmail,
      name: directName,
      googleId: directGoogleId,
      image: directImage,
    } = req.body;

    let email: string;
    let name: string;
    let googleId: string;
    let image: string | undefined;

    // Check if we received direct user info (from access token flow)
    if (directEmail && directGoogleId) {
      email = directEmail;
      name = directName || "Google User";
      googleId = directGoogleId;
      image = directImage;
    } else if (credential) {
      // Original ID token flow
      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          return res.status(400).json({ message: "Invalid Google token" });
        }

        email = payload.email as string;
        name = payload.name || "Google User";
        googleId = payload.sub;
        image = payload.picture;
      } catch (tokenError) {
        // If ID token verification fails, the credential might be an access token
        // In this case, we should have received user info directly
        return res.status(400).json({ message: "Invalid Google credentials" });
      }
    } else {
      return res.status(400).json({ message: "Missing Google credentials" });
    }

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Create user if not exists
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          isVerified: true, // Google accounts are verified
          image,
        },
      });
    } else if (!user.googleId) {
      // Link Google account if user exists but hasn't linked Google
      user = await prisma.user.update({
        where: { email },
        data: {
          googleId,
          isVerified: true,
          image: user.image ? undefined : image,
        },
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
        role: user.role,
        image: user.image,
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
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 20px;">
<p>Your verification code is: <strong>${otp}</strong></p>
<p>This code expires in 10 minutes.</p>
</body>
</html>`;

    sendMailInBackground(email, "Your Verification Code", emailHtml);

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

    if (
      !user ||
      user.otp !== otp ||
      !user.otpExpires ||
      user.otpExpires < new Date()
    ) {
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
        role: updatedUser.role,
        image: updatedUser.image,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Verify reset password token
 */
export const verifyResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    return res.status(200).json({
      message: "Token is valid",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Verify reset token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: "Token and password are required" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user with new password and clear reset token
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        isVerified: true,
      },
    });

    // Generate login token
    const authToken = generateToken(updatedUser.id);

    return res.status(200).json({
      message: "Password has been set successfully",
      token: authToken,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        image: updatedUser.image,
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Request password reset (forgot password)
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetPasswordToken = randomstring.generate(32);
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 20px;">
<p>Hi ${user.name},</p>
<p>We received a request to reset your password.</p>
<p><a href="${resetUrl}">Reset your password</a></p>
<p>Or copy this link: ${resetUrl}</p>
<p>This link expires in 1 hour.</p>
<p>If you didn't request this, please ignore this email.</p>
</body>
</html>`;

    sendMailInBackground(
      email,
      "Reset Your Password - Dynamic Listing",
      emailHtml,
    );

    return res.status(200).json({
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Change password for logged in user
 */
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "New password must be at least 8 characters long" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.password) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update user profile image
 */
export const updateProfileImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const imageFile = req.files.image;
    // Use "listings" folder instead of "profiles" because current storage rules
    // only allow public read/write access to listings/{allPaths=**}
    const imageUrl = await uploadToFirebase(imageFile, "listings");

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { image: imageUrl },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
      },
    });

    return res.status(200).json({
      message: "Profile image updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile image error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
