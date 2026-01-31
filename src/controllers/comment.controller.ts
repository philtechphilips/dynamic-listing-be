import { Request, Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * Get comments for a specific listing or news item
 */
export const getComments = async (req: Request, res: Response) => {
    try {
        const { listingId, newsId } = req.query;

        if (!listingId && !newsId) {
            return res.status(400).json({ message: "Either listingId or newsId must be provided" });
        }

        const where: any = {};
        if (listingId) where.listingId = listingId as string;
        if (newsId) where.newsId = newsId as string;

        const comments = await prisma.comment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({ comments });
    } catch (error) {
        console.error("Error fetching comments:", error);
        return res.status(500).json({ message: "Failed to fetch comments" });
    }
};

/**
 * Create a new comment
 */
export const createComment = async (req: AuthRequest, res: Response) => {
    try {
        const { content, listingId, newsId } = req.body;
        const userId = req.user?.id;

        if (!content) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!listingId && !newsId) {
            return res.status(400).json({ message: "Either listingId or newsId must be provided" });
        }

        const comment = await prisma.comment.create({
            data: {
                content,
                userId,
                listingId: (listingId as string) || null,
                newsId: (newsId as string) || null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            }
        });

        return res.status(201).json({
            message: "Comment posted successfully",
            comment,
        });
    } catch (error) {
        console.error("Error creating comment:", error);
        return res.status(500).json({ message: "Failed to post comment" });
    }
};

/**
 * Delete a comment
 */
export const deleteComment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const comment = await prisma.comment.findUnique({
            where: { id },
        });

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Only author or admin can delete
        if (comment.userId !== userId && req.user?.role !== "admin") {
            return res.status(403).json({ message: "You are not authorized to delete this comment" });
        }

        await prisma.comment.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Comment deleted successfully" });
    } catch (error) {
        console.error("Error deleting comment:", error);
        return res.status(500).json({ message: "Failed to delete comment" });
    }
};
