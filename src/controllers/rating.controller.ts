/**
 * =============================================================================
 * RATING CONTROLLER
 * =============================================================================
 * 
 * This controller handles business listing ratings (star ratings).
 * It manages individual user ratings and updates listing aggregates.
 * 
 * Features:
 * - Upsert logic (create or update) for user ratings
 * - Automatic recalculation of listing average rating and review count
 * - Atomic rating updates
 * - User rating history tracking
 * 
 * @module controllers/rating.controller
 */

import { Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Get the current user's rating for a specific listing.
 * 
 * Also returns fresh listing-wide stats (average rating, review count).
 * 
 * @route GET /ratings/:listingId
 * @requires authenticate middleware
 * @param {AuthRequest} req - Express request with listingId param
 * @returns {200} Rating object and fresh listing stats
 * @returns {401} Unauthorized
 * @returns {500} Server error
 */
export const getUserRating = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const rating = await prisma.rating.findUnique({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
    });

    // Fetch fresh listing stats to ensure UI is up to date
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { rating: true, reviewCount: true },
    });

    return res.status(200).json({
      rating,
      avgRating: listing?.rating || 0,
      reviewCount: listing?.reviewCount || 0,
    });
  } catch (error) {
    console.error("Error fetching user rating:", error);
    return res.status(500).json({ message: "Failed to fetch rating" });
  }
};

/**
 * Create or update a rating for a listing
 */
export const upsertRating = async (req: AuthRequest, res: Response) => {
  try {
    const { listingId, value } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!listingId || value === undefined) {
      return res
        .status(400)
        .json({ message: "listingId and value are required" });
    }

    const ratingValue = parseInt(value);
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res
        .status(400)
        .json({ message: "Rating value must be between 1 and 5" });
    }

    const rating = await prisma.rating.upsert({
      where: {
        userId_listingId: {
          userId,
          listingId,
        },
      },
      update: {
        value: ratingValue,
      },
      create: {
        userId,
        listingId,
        value: ratingValue,
      },
    });

    // 🏆 Update the Listing's aggregate rating
    const allRatings = await prisma.rating.findMany({
      where: { listingId },
      select: { value: true },
    });

    const totalRating = allRatings.reduce((acc, curr) => acc + curr.value, 0);
    const reviewCount = allRatings.length;
    const avgRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        rating: avgRating,
        reviewCount: reviewCount,
      },
    });

    return res.status(200).json({
      message: "Rating saved successfully",
      rating,
      avgRating,
      reviewCount,
    });
  } catch (error) {
    console.error("Error saving rating:", error);
    return res.status(500).json({ message: "Failed to save rating" });
  }
};

/**
 * Get all ratings made by the authenticated user
 */
export const getUserRatings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Fetch ratings with listing details
    const ratings = await prisma.rating.findMany({
      where: { userId },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
            featuredImage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Fetch comments to associate text with ratings if available
    const listingIds = ratings.map((r) => r.listingId);
    const comments = await prisma.comment.findMany({
      where: {
        userId,
        listingId: { in: listingIds },
      },
    });

    const commentMap = new Map<string, string>();
    comments.forEach((c) => {
      if (c.listingId) commentMap.set(c.listingId, c.content);
    });

    const formattedRatings = ratings.map((rating) => ({
      id: rating.id,
      listing: rating.listing.title,
      rating: rating.value,
      text: commentMap.get(rating.listingId) || "", // Attach comment text if available
      date: rating.createdAt,
      slug: rating.listing.slug,
      image:
        rating.listing.featuredImage ||
        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400",
    }));

    return res.status(200).json(formattedRatings);
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    return res.status(500).json({ message: "Failed to fetch user ratings" });
  }
};

/**
 * Delete a rating
 */
export const deleteRating = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const rating = await prisma.rating.findUnique({
      where: { id },
    });

    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    if (rating.userId !== userId && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const listingId = rating.listingId;

    await prisma.rating.delete({
      where: { id },
    });

    // Recalculate listing average rating
    const allRatings = await prisma.rating.findMany({
      where: { listingId },
      select: { value: true },
    });

    const totalRating = allRatings.reduce((acc, curr) => acc + curr.value, 0);
    const reviewCount = allRatings.length;
    const avgRating = reviewCount > 0 ? totalRating / reviewCount : 0;

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        rating: avgRating,
        reviewCount: reviewCount,
      },
    });

    return res.status(200).json({ message: "Rating deleted successfully" });
  } catch (error) {
    console.error("Error deleting rating:", error);
    return res.status(500).json({ message: "Failed to delete rating" });
  }
};
