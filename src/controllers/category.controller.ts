import { Request, Response } from "express";
import prisma from "../services/db.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import slugify from "slugify";

/**
 * Get all categories
 */
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
};

/**
 * Get a single category by ID or slug
 */
export const getCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findFirst({
      where: {
        OR: [{ id: id }, { slug: id }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ category });
  } catch (error) {
    console.error("Error fetching category:", error);
    return res.status(500).json({ message: "Failed to fetch category" });
  }
};

/**
 * Create a new category
 */
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const slug = slugify(name, { lower: true, strict: true });

    // Check if category already exists
    const existingCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existingCategory) {
      return res
        .status(400)
        .json({ message: "A category with this name or slug already exists" });
    }

    const parsedSortOrder =
      sortOrder !== undefined ? parseInt(sortOrder.toString(), 10) : undefined;
    const finalSortOrder =
      parsedSortOrder !== undefined && !isNaN(parsedSortOrder)
        ? parsedSortOrder
        : 0;

    const newCategory = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        sortOrder: finalSortOrder,
      },
    });

    return res.status(201).json({
      message: "Category created successfully",
      category: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({ message: "Failed to create category" });
  }
};

/**
 * Update a category
 */
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    let slug = existingCategory.slug;
    if (name && name !== existingCategory.name) {
      slug = slugify(name, { lower: true, strict: true });

      // Check if new name/slug is taken
      const nameTaken = await prisma.category.findFirst({
        where: {
          id: { not: id },
          OR: [{ name }, { slug }],
        },
      });

      if (nameTaken) {
        return res
          .status(400)
          .json({
            message: "A category with this name or slug already exists",
          });
      }
    }

    const sortOrderRaw = req.body?.sortOrder;
    let sortOrderValue: number | undefined;
    if (sortOrderRaw !== undefined && sortOrderRaw !== null) {
      const parsed = parseInt(String(sortOrderRaw), 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        sortOrderValue = parsed;
      }
    }

    const updateData: { name?: string; slug?: string; description?: string; sortOrder?: number } = {};
    if (name) updateData.name = name;
    if (name) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (sortOrderValue !== undefined) updateData.sortOrder = sortOrderValue;

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      message: "Category updated successfully",
      category: updatedCategory,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({ message: "Failed to update category" });
  }
};

/**
 * Delete a category
 */
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    await prisma.category.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({ message: "Failed to delete category" });
  }
};
