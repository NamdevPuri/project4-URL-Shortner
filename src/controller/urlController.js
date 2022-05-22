const urlModel = require("../model/urlModel");
const shortid = require('shortid');
const validUrl = require('valid-url');
const redis = require('redis'); //here util its a package and promisify is a method on that pakage we are destructure it.

const {promisify} = require('util') // promisify convert callback function to promise in redis


// connect to redis
const redisClient = redis.createClient(18325,  // Port No
    "redis-18325.c264.ap-south-1-1.ec2.cloud.redislabs.com", // Id of redis
{no_ready_check:true});
redisClient.auth("Q9eDx6UnSWh5kgWqSCR0wOtaiJTQ1rrn", function (err) {  // auth is use to check authentication
   if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..")
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);



const baseUrl= 'http://localhost:3000'

//*********************************************// Short Url //************************************************* */

const shortUrl = async function ( req, res ) {
    let longUrl = req.body.longUrl
    const urlCode = shortid.generate()

    if(longUrl){
    try{
        longUrl = longUrl.trim()

        if(!(longUrl.includes('//'))){
            return res.status(400).send({status:false, msg:"Invalid longUrl"})
        }
        const urlParts= longUrl.split("//")
        const scheme = urlParts[0]
        const uri = urlParts[1]
        let islongUrl

        if(!(uri.includes("."))){
            return res.status(400).send({status:false, msg:"Invalid longUrl"})
        }
        const uriParts = uri.split(".")

        if(!(((scheme == "https:") || (scheme == "http:") && (uriParts[0].trim().length) && (uriParts[1].trim().length)))){
            return res.status(400).send({status:false, msg:'Invalid longUrl'})
        }
         // db call
     islongUrl= await urlModel.findOne({longUrl})//.select({_id:0, longUrl:1, shortUrl:1, urlCode:1 })
    if(islongUrl){

        return res.status(200).send({status:true, data:islongUrl})

    } else {

     const shortUrl = baseUrl + '/' + urlCode.toLowerCase()

        const data= {
            longUrl: longUrl,
            shortUrl: shortUrl,
            urlCode: urlCode, 
          }

        const createUrl=await urlModel.create(data)

        await SET_ASYNC(urlCode.toLowerCase(),longUrl)

        return res.status(201).send({msg:"you already created shortUrl for this longUrl", data:createUrl})
    }
} catch (err){
   res.status(500).send({status:false, msg:err.massage})
}
   } else {
       return res.status(400).send({status:false , msg:" please enter longUrl details"})
   }
}

//**********************************************// getlink //**************************************************** */

const getShortUrl= async function (req,res){
    try{
     let urlCode=req.params.urlCode.trim()

    //checking url in cache server memory
    let cachedLongUrl = await GET_ASYNC(urlCode)
    if(cachedLongUrl){
       // console.log("cachedLongUrl=",cachedLongUrl )

      return res.status(302).redirect(cachedLongUrl)   
    }
    else {
        // db call
      const url = await urlModel.findOne({urlCode:req.params.urlCode})
  
    if(url) {

     return res.status(302).redirect(url.longUrl) // 302 stand for successful redirection

    }else{

        return res.status(404).send({status:false,message:"urlcode not found"})
    }
}    
} catch(err) {   
    console.log(err);
    res.status(500).send({status:false, msg:err.massage})
}

}

module.exports= {shortUrl, getShortUrl }

