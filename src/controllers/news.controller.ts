import { Request, Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import slugify from "slugify";
import { uploadToFirebase } from "../services/upload.service";

/**
 * Get all news
 */
export const getAllNews = async (req: Request, res: Response) => {
  try {
    const { status, search, category } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (category) where.categoryId = category;
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { excerpt: { contains: search as string } },
      ];
    }

    const news = await prisma.news.findMany({
      where,
      include: {
        category: true,
        author: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ news });
  } catch (error) {
    console.error("Error fetching news:", error);
    return res.status(500).json({ message: "Failed to fetch news" });
  }
};

/**
 * Get a single news by ID or slug
 */
export const getNewsItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newsItem = await prisma.news.findFirst({
      where: {
        OR: [{ id: id }, { slug: id }],
      },
      include: {
        category: true,
        author: true,
      },
    });

    if (!newsItem) {
      return res.status(404).json({ message: "News item not found" });
    }

    return res.status(200).json({ news: newsItem });
  } catch (error) {
    console.error("Error fetching news item:", error);
    return res.status(500).json({ message: "Failed to fetch news item" });
  }
};

/**
 * Create a new news item
 */
export const createNews = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      status,
      categoryId,
      excerpt,
      content,
      featuredImage,
      seoTitle,
      seoDescription,
      seoKeywords,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    let uploadedImageUrl = featuredImage;

    // Handle file upload if present
    if (req.files && req.files.featuredImage) {
      const file = Array.isArray(req.files.featuredImage)
        ? req.files.featuredImage[0]
        : req.files.featuredImage;
      uploadedImageUrl = await uploadToFirebase(file, "listings");
    }

    const baseSlug = slugify(title, { lower: true, strict: true });
    let slug = baseSlug;

    // Ensure slug uniqueness
    let counter = 1;
    while (await prisma.news.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newsItem = await prisma.news.create({
      data: {
        title,
        slug,
        status: status || "Published",
        categoryId,
        excerpt,
        content,
        featuredImage: uploadedImageUrl,
        seoTitle,
        seoDescription,
        seoKeywords,
        authorId: req.user?.id,
      },
      include: { category: true },
    });

    return res.status(201).json({
      message: "News item created successfully",
      news: newsItem,
    });
  } catch (error) {
    console.error("Error creating news item:", error);
    return res.status(500).json({ message: "Failed to create news item" });
  }
};

/**
 * Update a news item
 */
export const updateNews = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Check if news item exists
    const existingNews = await prisma.news.findUnique({
      where: { id },
    });

    if (!existingNews) {
      return res.status(404).json({ message: "News item not found" });
    }

    // If title changed, update slug
    if (data.title && data.title !== existingNews.title) {
      const baseSlug = slugify(data.title, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (
        await prisma.news.findFirst({ where: { slug, id: { not: id } } })
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
      data.featuredImage = await uploadToFirebase(file, "listings");
    }

    const updatedNews = await prisma.news.update({
      where: { id },
      data,
      include: { category: true },
    });

    return res.status(200).json({
      message: "News item updated successfully",
      news: updatedNews,
    });
  } catch (error) {
    console.error("Error updating news item:", error);
    return res.status(500).json({ message: "Failed to update news item" });
  }
};

/**
 * Delete a news item
 */
export const deleteNews = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if news item exists
    const newsItem = await prisma.news.findUnique({
      where: { id },
    });

    if (!newsItem) {
      return res.status(404).json({ message: "News item not found" });
    }

    await prisma.news.delete({
      where: { id },
    });

    return res.status(200).json({ message: "News item deleted successfully" });
  } catch (error) {
    console.error("Error deleting news item:", error);
    return res.status(500).json({ message: "Failed to delete news item" });
  }
};
