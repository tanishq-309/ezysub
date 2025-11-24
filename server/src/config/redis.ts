import "dotenv/config";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL as string);

export default connection;

// require("dotenv").config();
// console.log("Loaded REDIS_URL =", process.env.REDIS_URL);
