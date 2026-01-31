import express, { Request, Response, NextFunction, Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import * as AdminController from "../controllers/admin.controller";
import * as CategoryController from "../controllers/category.controller";
import * as ListingController from "../controllers/listing.controller";
import * as NewsController from "../controllers/news.controller";
import * as DashboardController from "../controllers/dashboard.controller";

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
router.post("/auth/change-password", authenticate, AuthController.changePassword);
router.post("/auth/profile-image", authenticate, AuthController.updateProfileImage);

// User Dashboard routes
router.get("/user/dashboard", authenticate, DashboardController.getUserDashboardStats);

// Admin user management routes (protected)
router.get("/admin/users", authenticate, isAdmin, AdminController.getAdminUsers);
router.get("/admin/app-users", authenticate, isAdmin, AdminController.getAppUsers);
router.get("/admin/users/:id", authenticate, isAdmin, AdminController.getAdminUser);
router.post("/admin/users", authenticate, isAdmin, AdminController.createAdminUser);
router.put("/admin/users/:id", authenticate, isAdmin, AdminController.updateAdminUser);
router.delete("/admin/users/:id", authenticate, isAdmin, AdminController.deleteAdminUser);
router.post("/admin/users/:id/resend-invitation", authenticate, isAdmin, AdminController.resendInvitation);
router.get("/admin/dashboard-stats", authenticate, isAdmin, AdminController.getDashboardStats);

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

// News routes
router.get("/news", NewsController.getAllNews);
router.get("/news/:id", NewsController.getNewsItem);
router.post("/admin/news", authenticate, isAdmin, NewsController.createNews);
router.put("/admin/news/:id", authenticate, isAdmin, NewsController.updateNews);
router.delete("/admin/news/:id", authenticate, isAdmin, NewsController.deleteNews);

// Comment routes
import * as CommentController from "../controllers/comment.controller";
router.get("/user/comments", authenticate, CommentController.getUserComments);
router.get("/comments", CommentController.getComments);
router.post("/comments", authenticate, CommentController.createComment);
router.delete("/comments/:id", authenticate, CommentController.deleteComment);

// Rating routes
import * as RatingController from "../controllers/rating.controller";
router.get("/user/ratings", authenticate, RatingController.getUserRatings);
router.get("/ratings/:listingId/user", authenticate, RatingController.getUserRating);
router.post("/ratings", authenticate, RatingController.upsertRating);
router.delete("/ratings/:id", authenticate, RatingController.deleteRating);



router.use(function (_req: Request, res: Response, next: NextFunction) {
  res.status(404).send({ responseCode: 404, message: "Invalid resource URL", data: [] });
  next();
});

export default router;

