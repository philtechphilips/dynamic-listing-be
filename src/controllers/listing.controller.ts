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
    const { category, status, search, page = 1, limit = 10 } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const where: any = {};
    if (category) where.categoryId = category;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { location: { contains: search as string } },
        { address: { contains: search as string } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNumber,
      }),
      prisma.listing.count({ where }),
    ]);

    return res.status(200).json({
      listings,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
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
        OR: [{ id: id }, { slug: id }],
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
      seoKeywords,
      rating,
      reviewCount,
      is_video,
      video_url,
    } = req.body;

    if (!title || !categoryId || !location || !address) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Parse numeric fields if they exist
    const parsedRating =
      rating !== undefined ? parseFloat(rating.toString()) : 0;
    const parsedReviewCount =
      reviewCount !== undefined ? parseInt(reviewCount.toString(), 10) : 0;
    const parsedIsVideo = is_video === "true" || is_video === true;

    let uploadedImageUrl = featuredImage;

    // Handle file upload if present
    if (req.files && req.files.featuredImage) {
      const file = Array.isArray(req.files.featuredImage)
        ? req.files.featuredImage[0]
        : req.files.featuredImage;
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
        seoKeywords,
        rating: isNaN(parsedRating) ? 0 : parsedRating,
        reviewCount: isNaN(parsedReviewCount) ? 0 : parsedReviewCount,
        is_video: parsedIsVideo,
        video_url,
      },
      include: { category: true },
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

    // Parse numeric fields if they exist in the update payload
    if (data.rating !== undefined) {
      data.rating = parseFloat(data.rating.toString());
      if (isNaN(data.rating)) data.rating = existingListing.rating;
    }
    if (data.reviewCount !== undefined) {
      data.reviewCount = parseInt(data.reviewCount.toString(), 10);
      if (isNaN(data.reviewCount))
        data.reviewCount = existingListing.reviewCount;
    }

    if (data.is_video !== undefined) {
      data.is_video = data.is_video === "true" || data.is_video === true;
    }

    // If title changed, update slug
    if (data.title && data.title !== existingListing.title) {
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (
        await prisma.listing.findFirst({ where: { slug, id: { not: id } } })
      ) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      data.slug = slug;
    }

    // Handle file upload if present
    if (req.files && req.files.featuredImage) {
      const file = Array.isArray(req.files.featuredImage)
        ? req.files.featuredImage[0]
        : req.files.featuredImage;
      data.featuredImage = await uploadToFirebase(file);
    }

    const updatedListing = await prisma.listing.update({
      where: { id },
      data,
      include: { category: true },
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
