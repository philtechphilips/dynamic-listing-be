import { Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Get the current user's rating for a specific listing
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
                    listingId
                }
            }
        });

        // Fetch fresh listing stats to ensure UI is up to date
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
            select: { rating: true, reviewCount: true }
        });

        return res.status(200).json({
            rating,
            avgRating: listing?.rating || 0,
            reviewCount: listing?.reviewCount || 0
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
            return res.status(400).json({ message: "listingId and value are required" });
        }

        const ratingValue = parseInt(value);
        if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            return res.status(400).json({ message: "Rating value must be between 1 and 5" });
        }

        const rating = await prisma.rating.upsert({
            where: {
                userId_listingId: {
                    userId,
                    listingId
                }
            },
            update: {
                value: ratingValue
            },
            create: {
                userId,
                listingId,
                value: ratingValue
            }
        });

        // 🏆 Update the Listing's aggregate rating
        const allRatings = await prisma.rating.findMany({
            where: { listingId },
            select: { value: true }
        });

        const totalRating = allRatings.reduce((acc, curr) => acc + curr.value, 0);
        const reviewCount = allRatings.length;
        const avgRating = reviewCount > 0 ? totalRating / reviewCount : 0;

        await prisma.listing.update({
            where: { id: listingId },
            data: {
                rating: avgRating,
                reviewCount: reviewCount
            }
        });

        return res.status(200).json({
            message: "Rating saved successfully",
            rating,
            avgRating,
            reviewCount
        });
    } catch (error) {
        console.error("Error saving rating:", error);
        return res.status(500).json({ message: "Failed to save rating" });
    }
};
