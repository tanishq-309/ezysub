import console = require("console");

const {Queue}= require("bullmq");
const connection = require("./config/redis");

// const connection = new IORedis('redis://default:cZYvSvEDj05443hLnDMc1hBkXGHrGczd@redis-18935.crce182.ap-south-1-1.ec2.cloud.redislabs.com:18935');
const myQueue = new Queue('queue_name', { connection });

async function init(){
    const res= await myQueue.add('email',{
        emailid:"tanishq"
    });
    console.log("Queue Added 1");
}

init();