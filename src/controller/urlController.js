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





// const isValid= function(value){
//     if(typeof (value)==='undefined' || typeof (value)==='null') return false
//     if(typeof (value) === 'string' && value.trim().length > 0) return false
//     return true
// }
const isValidRequestBody = function (requestBody) {
    return Object.keys(requestBody).length > 0
}


const baseUrl= 'http://localhost:3000'

//*********************************************// Short Url //************************************************* */

const shortUrl = async function ( req, res ) {
    try{
    const Url = req.body
    // console.log(longUrl)
    const longUrl =Url.longUrl
    if (!isValidRequestBody({longUrl})) {
        return res.status(400).send({status:false , msg:" please enter longUrl details"})
    }    
    if (!validUrl.isUri(longUrl)) {
        return res.status(400).send({status:false,msg:'Invalid long URL'})
    }
    if(!validUrl.isUri(baseUrl)){
        return res.status(400).send({status:false, msg:'The base URL is invalid'})
    }
    //checking url in cache server memory
    const dataCache = await GET_ASYNC(`${longUrl}`)
    if(dataCache){
        return res.status(200).send({status: true, data: JSON.parse(dataCache)})
    }
    else{

         // db call
    const islongUrl= await urlModel.findOne({longUrl}).select({_id:0, longUrl:1, shortUrl:1, urlCode:1 })
    if(islongUrl){

        await SET_ASYNC(`${longUrl}`, JSON.stringify(islongUrl))
        return res.status(200).send({status:true, message:"get from DB", data:islongUrl})
    }

    // Generate :urlCode
    const urlCode = shortid.generate(longUrl)
    
    let isUrlCode = await urlModel.findOne({urlCode:urlCode})
    if(isUrlCode){
        return res.status(400).send({status:false,message:"already exist"})
    }
// create: short URL
    const shortUrl = baseUrl + '/' + urlCode
// create: doc for database including(urlCode, shortUrl, longUrl)
    const data= {
      longUrl: longUrl,
      shortUrl: shortUrl,
      urlCode: urlCode, 
    }
    // creating: document
    const createUrl=await urlModel.create(data)

    await SET_ASYNC(`${longUrl}`, JSON.stringify(data))
    await SET_ASYNC(`${longUrl}`, JSON.stringify(data.longUrl))

    return res.status(201).send({msg:"you already created shortUrl for this longUrl", data:createUrl})
}
} catch (err){
    res.status(500).send({status:false, msg:err.massage})
}
}

//**********************************************// getlink //**************************************************** */

const getShortUrl= async function (req,res){
    try{
    let urlCode=req.params.urlCode.trim()

    if (!isValidRequestBody(urlCode)) {
        return res.status(400).send({status:false, msg:'Please enter urlCode in the path params'})
    }
    //checking url in cache server memory
    let getDataFromCache = await GET_ASYNC(`$(req.params.urlCode)`)
    if(getDataFromCache){

    const data = JSON.parse(getDataFromCache)
       res.status(302).redirect(data.longUrl)
       return
    }
    else {
        // db call
      const url = await urlModel.findOne({urlCode:urlCode}).select({_id:0, urlCode:1, shortUrl:1, longUrl:1})
  
    if(!url) return res.status(404).send({status:false,message:"urlcode not found"})

    const getlongUrl = url.longUrl

     await SET_ASYNC(`${urlCode}`, JSON.stringify(`${getlongUrl}`))
     
     return res.status(302).redirect(getlongUrl) // 302 stand for successful redirection
    
    }
    
} catch(err) {   
    console.log(err);
    res.status(500).send({status:false, msg:err.massage})
}

}

module.exports= {shortUrl, getShortUrl }

