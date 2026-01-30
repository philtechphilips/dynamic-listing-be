import { Request, Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import slugify from "slugify";
import { uploadToFirebase } from "../services/upload.service";

/**
 * Get all listings
 */
export const getListings = async (req: Request, res: Response) => {
    try {
        const { category, status, search } = req.query;

        const where: any = {};
        if (category) where.categoryId = category;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { title: { contains: search as string } },
                { location: { contains: search as string } },
                { address: { contains: search as string } }
            ];
        }

        const listings = await prisma.listing.findMany({
            where,
            include: { category: true },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({ listings });
    } catch (error) {
        console.error("Error fetching listings:", error);
        return res.status(500).json({ message: "Failed to fetch listings" });
    }
};

/**
 * Get a single listing by ID or slug
 */
export const getListing = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const listing = await prisma.listing.findFirst({
            where: {
                OR: [
                    { id: id },
                    { slug: id }
                ]
            },
            include: { category: true },
        });

        if (!listing) {
            return res.status(404).json({ message: "Listing not found" });
        }

        return res.status(200).json({ listing });
    } catch (error) {
        console.error("Error fetching listing:", error);
        return res.status(500).json({ message: "Failed to fetch listing" });
    }
};

/**
 * Create a new listing
 */
export const createListing = async (req: AuthRequest, res: Response) => {
    try {
        const {
            title,
            categoryId,
            location,
            address,
            priceRange,
            status,
            excerpt,
            content,
            featuredImage,
            phone,
            email,
            website,
            openingHours,
            googleMapUrl,
            seoTitle,
            seoDescription,
            seoKeywords
        } = req.body;

        if (!title || !categoryId || !location || !address) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        let uploadedImageUrl = featuredImage;

        // Handle file upload if present
        if (req.files && req.files.featuredImage) {
            const file = Array.isArray(req.files.featuredImage) ? req.files.featuredImage[0] : req.files.featuredImage;
            uploadedImageUrl = await uploadToFirebase(file);
        }

        const baseSlug = slugify(title, { lower: true, strict: true });
        let slug = baseSlug;

        // Ensure slug uniqueness
        let counter = 1;
        while (await prisma.listing.findUnique({ where: { slug } })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        const newListing = await prisma.listing.create({
            data: {
                title,
                slug,
                categoryId,
                location,
                address,
                priceRange: priceRange || "$$",
                status: status || "Draft",
                excerpt,
                content,
                featuredImage: uploadedImageUrl,
                phone,
                email,
                website,
                openingHours,
                googleMapUrl,
                seoTitle,
                seoDescription,
                seoKeywords
            },
            include: { category: true }
        });

        return res.status(201).json({
            message: "Listing created successfully",
            listing: newListing,
        });
    } catch (error) {
        console.error("Error creating listing:", error);
        return res.status(500).json({ message: "Failed to create listing" });
    }
};

/**
 * Update a listing
 */
export const updateListing = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const data = req.body;

        // Check if listing exists
        const existingListing = await prisma.listing.findUnique({
            where: { id },
        });

        if (!existingListing) {
            return res.status(404).json({ message: "Listing not found" });
        }

        // If title changed, update slug
        if (data.title && data.title !== existingListing.title) {
            const baseSlug = slugify(data.title, { lower: true, strict: true });
            let slug = baseSlug;
            let counter = 1;
            while (await prisma.listing.findFirst({ where: { slug, id: { not: id } } })) {
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
            data.slug = slug;
        }

        // Handle file upload if present
        if (req.files && req.files.featuredImage) {
            const file = Array.isArray(req.files.featuredImage) ? req.files.featuredImage[0] : req.files.featuredImage;
            data.featuredImage = await uploadToFirebase(file);
        }

        const updatedListing = await prisma.listing.update({
            where: { id },
            data,
            include: { category: true }
        });

        return res.status(200).json({
            message: "Listing updated successfully",
            listing: updatedListing,
        });
    } catch (error) {
        console.error("Error updating listing:", error);
        return res.status(500).json({ message: "Failed to update listing" });
    }
};

/**
 * Delete a listing
 */
export const deleteListing = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Check if listing exists
        const listing = await prisma.listing.findUnique({
            where: { id },
        });

        if (!listing) {
            return res.status(404).json({ message: "Listing not found" });
        }

        await prisma.listing.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Listing deleted successfully" });
    } catch (error) {
        console.error("Error deleting listing:", error);
        return res.status(500).json({ message: "Failed to delete listing" });
    }
};
