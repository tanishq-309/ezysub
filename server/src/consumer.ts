import { Worker } from "bullmq";
import console from "console";
import connection from "./config/redis.ts";

new Worker(
  "translate",
  async job => {
    console.log("Received job:", job.id);
    // your translation logic
  },
  { connection: connection }
);
