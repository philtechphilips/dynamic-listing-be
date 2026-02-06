/**
 * =============================================================================
 * ADMIN CONTROLLER
 * =============================================================================
 * 
 * This controller manages administrative user operations.
 * It is primarily used for the admin dashboard to manage admin accounts.
 * 
 * Features:
 * - List all admin users with verification status
 * - Admin account management
 * 
 * @module controllers/admin.controller
 */

import { Response } from "express";
import randomstring from "randomstring";
import prisma from "../services/db.service";
import { sendMailInBackground } from "../services/mail.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Get all admin users.
 * 
 * Fetches all users with the 'admin' role, including their verification
 * status and basic profile information.
 * 
 * @route GET /admin/users
 * @requires isAdmin middleware
 * @returns {200} List of admin users
 * @returns {500} Server error
 */
export const getAdminUsers = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Map to include status based on isVerified
    const usersWithStatus = users.map((user) => ({
      ...user,
      status: user.isVerified ? "Active" : "Pending",
    }));

    return res.status(200).json({ users: usersWithStatus });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

/**
 * Get all app users (non-admins)
 */
export const getAppUsers = async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "user" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const usersWithStatus = users.map((user) => ({
      ...user,
      status: user.isVerified ? "Active" : "Pending",
    }));

    return res.status(200).json({ users: usersWithStatus });
  } catch (error) {
    console.error("Error fetching app users:", error);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

/**
 * Get a single admin user by ID
 */
export const getAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, role: "admin" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    return res.status(200).json({
      user: {
        ...user,
        status: user.isVerified ? "Active" : "Pending",
      },
    });
  } catch (error) {
    console.error("Error fetching admin user:", error);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
};

/**
 * Create a new admin user and send invitation email
 */
export const createAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }

    // Generate a reset password token for the invitation
    const resetPasswordToken = randomstring.generate(32);
    const resetPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Create new admin user without password (they'll set it via reset link)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role: "admin",
        isVerified: true, // Admin-created users are pre-verified
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    // Send invitation email with password reset link
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 20px;">
<p>Hi ${name},</p>
<p>You have been invited to join Dynamic Listing as an administrator.</p>
<p><a href="${resetUrl}">Set your password</a></p>
<p>Or copy this link: ${resetUrl}</p>
<p>This link expires in 7 days.</p>
<p>If you did not expect this invitation, please ignore this email.</p>
</body>
</html>`;

    sendMailInBackground(
      email,
      "You're Invited to Dynamic Listing Admin",
      emailHtml,
    );

    return res.status(201).json({
      message:
        "Admin user created successfully. An invitation email has been sent.",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: "Pending",
      },
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return res.status(500).json({ message: "Failed to create admin user" });
  }
};

/**
 * Update an admin user
 */
export const updateAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    // Check if user exists and is an admin
    const existingUser = await prisma.user.findFirst({
      where: { id, role: "admin" },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    // If email is being changed, check it's not taken
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email },
      });
      if (emailTaken) {
        return res.status(400).json({ message: "Email is already in use" });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      message: "Admin user updated successfully",
      user: {
        ...updatedUser,
        status: updatedUser.isVerified ? "Active" : "Pending",
      },
    });
  } catch (error) {
    console.error("Error updating admin user:", error);
    return res.status(500).json({ message: "Failed to update admin user" });
  }
};

/**
 * Delete an admin user
 */
export const deleteAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (req.user?.id === id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    // Check if user exists and is an admin
    const existingUser = await prisma.user.findFirst({
      where: { id, role: "admin" },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    await prisma.user.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Admin user deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin user:", error);
    return res.status(500).json({ message: "Failed to delete admin user" });
  }
};

/**
 * Resend invitation email to an admin user
 */
export const resendInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: { id, role: "admin" },
    });

    if (!user) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    // Generate a new reset password token
    const resetPasswordToken = randomstring.generate(32);
    const resetPasswordExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.user.update({
      where: { id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    // Send invitation email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 560px; margin: 0 auto; padding: 20px;">
<p>Hi ${user.name},</p>
<p>A new invitation link has been generated for your admin account.</p>
<p><a href="${resetUrl}">Set your password</a></p>
<p>Or copy this link: ${resetUrl}</p>
<p>This link expires in 7 days.</p>
</body>
</html>`;

    sendMailInBackground(
      user.email,
      "Set Your Password - Dynamic Listing Admin",
      emailHtml,
    );

    return res
      .status(200)
      .json({ message: "Invitation email has been resent" });
  } catch (error) {
    console.error("Error resending invitation:", error);
    return res.status(500).json({ message: "Failed to resend invitation" });
  }
};

/**
 * Get admin dashboard statistics
 */
export const getDashboardStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalListings,
      totalNews,
      totalCategories,
      recentUsers,
      recentListings,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "user" } }),
      prisma.listing.count(),
      prisma.news.count(),
      prisma.category.count(),
      prisma.user.findMany({
        where: { role: "user" },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          isVerified: true,
        },
      }),
      prisma.listing.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    return res.status(200).json({
      counts: {
        users: totalUsers,
        listings: totalListings,
        news: totalNews,
        categories: totalCategories,
      },
      lists: {
        recentUsers,
        recentListings,
      },
    });
  } catch (error: unknown) {
    console.error("Error fetching dashboard stats:", error);
    const prismaError = error as { code?: string };
    if (prismaError.code === "P1001" || prismaError.code === "P1002") {
      return res.status(503).json({
        message: "Database unavailable. Please check your connection and that the database server is running.",
      });
    }
    return res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
