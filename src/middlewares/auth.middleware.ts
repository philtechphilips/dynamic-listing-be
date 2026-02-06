/**
 * =============================================================================
 * AUTHENTICATION MIDDLEWARE
 * =============================================================================
 *
 * This module provides authentication and authorization middleware for the API.
 * It handles JWT token verification and role-based access control.
 *
 * @module middlewares/auth.middleware
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../services/db.service";

/**
 * Extended Request interface with authenticated user information.
 * Use this type for routes that require authentication.
 */
export interface AuthRequest extends Request {
  /** The authenticated user attached by the authenticate middleware */
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}

/**
 * Authentication Middleware
 *
 * Verifies the JWT token from the Authorization header and attaches
 * the user object to the request for use in subsequent handlers.
 *
 * Expected header format: "Authorization: Bearer <token>"
 *
 * @param req - Express request (will be extended with user info)
 * @param res - Express response
 * @param next - Next middleware function
 *
 * @returns 401 if:
 *   - No token provided
 *   - Token is invalid or expired
 *   - User not found in database
 *
 * @example
 * // Use in route definition
 * router.get('/protected', authenticate, (req, res) => {
 *   // req.user is now available
 *   res.json({ user: req.user });
 * });
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    // Check for Bearer token format
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];

    // Verify token and decode payload
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string;
    };

    // Fetch user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }

    // Attach user info to request for downstream handlers
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};

/**
 * Admin Authorization Middleware
 *
 * Checks if the authenticated user has admin role.
 * Must be used AFTER the authenticate middleware.
 *
 * @param req - Express request (must have user attached)
 * @param res - Express response
 * @param next - Next middleware function
 *
 * @returns 403 if user is not an admin
 *
 * @example
 * // Use in route definition (after authenticate)
 * router.get('/admin-only', authenticate, isAdmin, (req, res) => {
 *   // Only admins reach here
 *   res.json({ message: 'Welcome, admin!' });
 * });
 */
export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  // Check if user exists and has admin role
  if (!req.user || req.user.role !== "admin") {
    res
      .status(403)
      .json({ message: "Access denied. Admin privileges required." });
    return;
  }
  next();
};
