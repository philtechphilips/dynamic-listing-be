/**
 * =============================================================================
 * EXPRESS APPLICATION SETUP
 * =============================================================================
 *
 * This file initializes the Express application and configures global middlewares.
 * It serves as the main entry point for the REST API's route definitions.
 *
 * Middlewares:
 * - Helmet: Security headers
 * - CORS: Cross-origin resource sharing
 * - Compression: Gzip compression
 * - Morgan: Request logging
 * - FileUpload: Handling multipart form-data
 * - BodyParser: Parsing JSON and URL-encoded bodies
 *
 * @module app
 */

import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import fileUpload from "express-fileupload";
import morgan from "morgan";
import bodyParser from "body-parser";

import v1Router from "./routes/index";

const app = express();

// Setup middlewares
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan("tiny"));
app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    useTempFiles: true,
    abortOnLimit: true,
    responseOnLimit: "Maximum upload size is 10MB",
  }),
);
app.use(
  bodyParser.json({
    limit: "50mb",
    extended: true,
    parameterLimit: "50mb",
  } as any),
);
app.use(
  bodyParser.urlencoded({ extended: true, parameterLimit: "100000" } as any),
);

app.use("/api/v1", v1Router);

app.get("/", (_req: Request, res: Response) => {
  res.send({
    status: 200,
    message: "Welcome to Dynamic Listing API v1.0",
  });
});

app.use(function (_req: Request, res: Response, next: NextFunction) {
  res
    .status(404)
    .send({ responseCode: 404, message: "Invalid resource URL", data: [] });
  next();
});

export default app;
