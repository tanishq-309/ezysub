import console from "console";
import { Queue } from "bullmq";
import connection from "./config/redis.ts";
const myQueue = new Queue('test-queue', { connection });

async function init(){
    const res= await myQueue.add('email',{
        emailid:"tanishq"
    });
    console.log("Queue Added 1");
}

init();