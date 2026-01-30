import express, { Request, Response, NextFunction, Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import * as AdminController from "../controllers/admin.controller";
import * as CategoryController from "../controllers/category.controller";
import * as ListingController from "../controllers/listing.controller";

import { validate } from "../middlewares/validate.middleware";
import { signupSchema } from "../validation-schemas/auth.schema";
import { authenticate, isAdmin } from "../middlewares/auth.middleware";


const router: Router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  res.send({
    status: 200,
    message: "Welcome to Dynamic Listing API v1.0",
  });
});

// Auth routes
router.post("/auth/signup", validate(signupSchema), AuthController.signup);
router.get("/auth/verify-email", AuthController.verifyEmail);
router.post("/auth/login", AuthController.login);
router.post("/auth/google", AuthController.googleAuth);
router.post("/auth/request-otp", AuthController.requestOTP);
router.post("/auth/verify-otp", AuthController.verifyOTP);
router.post("/auth/forgot-password", AuthController.forgotPassword);
router.get("/auth/verify-reset-token", AuthController.verifyResetToken);
router.post("/auth/reset-password", AuthController.resetPassword);

// Admin user management routes (protected)
router.get("/admin/users", authenticate, isAdmin, AdminController.getAdminUsers);
router.get("/admin/app-users", authenticate, isAdmin, AdminController.getAppUsers);
router.get("/admin/users/:id", authenticate, isAdmin, AdminController.getAdminUser);
router.post("/admin/users", authenticate, isAdmin, AdminController.createAdminUser);
router.put("/admin/users/:id", authenticate, isAdmin, AdminController.updateAdminUser);
router.delete("/admin/users/:id", authenticate, isAdmin, AdminController.deleteAdminUser);
router.post("/admin/users/:id/resend-invitation", authenticate, isAdmin, AdminController.resendInvitation);

// Category routes
router.get("/categories", CategoryController.getCategories);
router.get("/categories/:id", CategoryController.getCategory);
router.post("/admin/categories", authenticate, isAdmin, CategoryController.createCategory);
router.put("/admin/categories/:id", authenticate, isAdmin, CategoryController.updateCategory);
router.delete("/admin/categories/:id", authenticate, isAdmin, CategoryController.deleteCategory);

// Listing routes
router.get("/listings", ListingController.getListings);
router.get("/listings/:id", ListingController.getListing);
router.post("/admin/listings", authenticate, isAdmin, ListingController.createListing);
router.put("/admin/listings/:id", authenticate, isAdmin, ListingController.updateListing);
router.delete("/admin/listings/:id", authenticate, isAdmin, ListingController.deleteListing);



router.use(function (_req: Request, res: Response, next: NextFunction) {
  res.status(404).send({ responseCode: 404, message: "Invalid resource URL", data: [] });
  next();
});

export default router;

