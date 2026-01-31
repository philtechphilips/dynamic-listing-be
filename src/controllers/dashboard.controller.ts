import { Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Get user dashboard statistics
 */
export const getUserDashboardStats = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 1. Total Reviews (Comments on Listings)
    const totalReviews = await prisma.comment.count({
      where: {
        userId,
        listingId: { not: null },
      },
    });

    // 2. Average Rating (Average value of ratings given by user)
    const ratingAgg = await prisma.rating.aggregate({
      where: { userId },
      _avg: { value: true },
    });
    const averageRating = ratingAgg._avg.value || 0;

    // 3. Total Comments (All comments)
    const totalComments = await prisma.comment.count({
      where: { userId },
    });

    // 4. Recent Activity (Comments on Listings)
    // We fetch recent comments and try to match with ratings for that listing
    const recentComments = await prisma.comment.findMany({
      where: {
        userId,
        listingId: { not: null },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    // Fetch ratings for the listings in recent comments to display alongside
    const listingIds = recentComments
      .map((c) => c.listingId)
      .filter((id): id is string => id !== null);

    const ratings = await prisma.rating.findMany({
      where: {
        userId,
        listingId: { in: listingIds },
      },
    });

    const ratingMap = new Map<string, number>();
    ratings.forEach((r) => ratingMap.set(r.listingId, r.value));

    const recentActivity = recentComments.map((comment) => ({
      id: comment.id,
      listing: comment.listing?.title || "Unknown Listing",
      slug: comment.listing?.slug || "#",
      text: comment.content,
      date: comment.createdAt,
      rating: comment.listingId ? ratingMap.get(comment.listingId) : undefined,
    }));

    // 5. Quick Stats (Mocked or real)
    // Profile Views, Helpful Votes, Following - Not in schema, so we mock them or return 0
    return res.status(200).json({
      stats: {
        totalReviews,
        averageRating: Number(averageRating.toFixed(1)), // Format to 1 decimal
        totalComments,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Error fetching user dashboard stats:", error);
    return res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
};
