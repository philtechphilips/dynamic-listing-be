import dotenv from "dotenv";

dotenv.config();

interface Config {
  baseUrl: string;
  port: number;
  environment: string;
  dbUri: string;
  jwtSecret: string;
  development: boolean;
  production: boolean;
}

const config: Config = {
  baseUrl: process.env.BASE_URL || "http://localhost",
  port: parseInt(process.env.PORT || "3000", 10),
  environment: process.env.NODE_ENV || "development",
  dbUri: process.env.DATABASE_URL || "mysql://root:password@localhost:3306/dynamic_listing",
  jwtSecret: process.env.JWT_SECRET || "1234",
  development: process.env.NODE_ENV === "development",
  production: process.env.NODE_ENV === "production",
};

export default config;
