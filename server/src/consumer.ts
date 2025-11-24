import { Worker } from "bullmq";
import console from "console";
import connection from "./config/redis.ts";

const worker = new Worker(
  "test-queue",
  async (job) => {
    console.log("Received job:", job.id);
  },
  { connection: connection }
);
