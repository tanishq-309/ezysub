require('dotenv').config()
const Redis = require("ioredis");

module.exports = new Redis(process.env.REDIS_URL);

// require("dotenv").config();
// console.log("Loaded REDIS_URL =", process.env.REDIS_URL);
