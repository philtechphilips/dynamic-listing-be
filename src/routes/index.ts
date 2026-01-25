import express, { Request, Response, NextFunction, Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import { signupSchema } from "../validation-schemas/auth.schema";


const router: Router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  res.send({
    status: 200,
    message: "Welcome to MyXalary Recruitment Service v1.0",
  });
});

router.post("/auth/signup", validate(signupSchema), AuthController.signup);



router.use(function (_req: Request, res: Response, next: NextFunction) {
  res.status(404).send({ responseCode: 404, message: "Invalid resource URL", data: [] });
  next();
});

export default router;
