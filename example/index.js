import   util  from './util.js'; 
import  { account,form, upload,wipay,product,order,events } from "backend-api"
import feature from './feature/index.js';
//Util
new util().then( async(util)=>{
  
//services 
new account(util);
new form(util)
new upload(util)
new wipay(util)
new product(util)
new order(util)
new events()?.route(util)

//Feature
new feature(util)


try {
  await util.fastify.listen({ port: 5000, host: '0.0.0.0'  })
} catch (err) {
  util.fastify.log.error(err)
  process.exit(1)
}
} )