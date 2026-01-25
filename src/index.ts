import app from "./app";
import chalk from "chalk";
import config from "./config/index";
import prisma from "./services/db.service";

const startServer = async () => {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log(`${chalk.green("Connected to MySQL via Prisma")}`);

    app.listen(config.port, () => {
      console.log(
        `${chalk.blue(
          `Recruitment service running on ${config.baseUrl}:${config.port}`
        )}`
      );
    });
  } catch (error) {
    console.error(`${chalk.red("Database connection error:")}`, error);
    process.exit(1);
  }
};

startServer();


