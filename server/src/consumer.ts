import { Worker } from "bullmq";

new Worker(
  "translate",
  async job => {
    console.log("Received job:", job.id);
    // your translation logic
  },
  { connection: client }
);
