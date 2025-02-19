// Import the framework and instantiate it
import Fastify from 'fastify'
import * as path from 'path';
import * as ejs from 'ejs'
import fastifyCron from 'fastify-cron'
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import mongoose from 'mongoose';

export default class util {

  constructor() {
    return this.util(Fastify({
      logger: true
    }));
  }


  async util(fastify) {

    await fastify.register(import('@fastify/cors'), (instance) => {
      return (req, callback) => {
        const corsOptions = {
          // This is NOT recommended for production as it enables reflection exploits
          origin: true
        };
    
        // do not include CORS headers for requests from localhost
        if (/^localhost$/m.test(req.headers.origin)) {
          corsOptions.origin = false
        }
    
        // callback expects two parameters: error and options
        callback(null, corsOptions)
      }
    })
    

    await fastify.register(import('@fastify/swagger'), {
      openapi: {
        info: {
          title: 'Feaure Example API Platform',
          description: 'Testing Feaure Example API Platform',
          version: '0.1.0'
        },
        components: {
          securitySchemes: {
            apiauth: {
              type: 'http',
              scheme: 'bearer',
              in: 'header'
            }
          }
        },
      }
    })

    await fastify.register(import('@fastify/swagger-ui'), {
      routePrefix: '/',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      },
      uiHooks: {
        onRequest: function (request, reply, next) { next() },
        preHandler: function (request, reply, next) { next() }
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject, request, reply) => { return swaggerObject },
      transformSpecificationClone: true,

    })

    await fastify.register(import("@fastify/view"), {
      engine: {
        "ejs": ejs,
      },
    });


    await fastify.register(import('@fastify/static'), {

      root: path.join(__dirname, 'upload/'),
      prefix: '/upload/', // optional: default '/'
      index: false,
      list: true
    })

    await fastify.register(import('@fastify/multipart'), {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 100,     // Max field value size in bytes
      fields: 10,         // Max number of non-file fields
      fileSize: 1000000,  // For multipart forms, the max file size in bytes
      files: 1,           // Max number of file fields
      headerPairs: 2000,  // Max number of header key=>value pairs
      parts: 1000         // For multipart forms, the max number of parts (fields + files)
    })


    const dbName = 'default'
    const mongo = 'mongodb://root:secret@localhost:32769/' //local
    const ORM = await mongoose.connect(mongo, { dbName: dbName})
    await fastify.register(import('@fastify/mongodb'), {
      forceClose: true,
      url: mongo
    })
    const DB = await fastify.mongo.client.db(dbName)

    await fastify.register(import('@fastify/auth')).decorate('authenticate', function (request, reply, done) {
      if (request.headers.authorization) {
        const collection = DB.collection('account');
        collection.findOne({ "authkey": request.headers?.authorization.split(" ")[1] }, { projection: { _id:1, roles: 1, profile: 1 } }).then(result => {
          if (result) {
            request.auth = result;
            done();

          } else {
            reply.status(400).send({
              message: "Authentication Failed"
            });
          }

        });

        // return done(Error('not anonymous'))
      } else {
        reply.status(400).send({
          message: "Authentication Failed, No Auth key"
        });
      }

    })



    await fastify.register(import('fastify-mailer'), {
      defaults: {
        // set the default sender email address to jane.doe@example.tld
        from: 'No Reply <noreply@example.com>',
        // set the default email subject to 'default example'
        subject: 'Default Example',
      },
      transport: {
        host: 'smtp.example.org',
        port: 465,
        secure: true, // use TLS
        auth: {
          user: 'noreply@example.com',
          pass: 'password'
        }
      }
    })

    let util = {
      "fastify": fastify,
      "db": DB,
      "orm": ORM,
    }

    await fastify.register(fastifyCron, {
      jobs: [
        {
          cronTime: '* * * * *',
          onTick: ()=>{this.mailer(util)},
          start: true // Start job immediately
        }
      ]
    })


    return util;
  }


  async mailer(util) {

    const collection = util.db.collection('events')
    const schema = { "email": true, "log.status": "pending", 'log.status': { '$ne': "complete" } }

    let pending = await collection.find(schema).toArray();

    pending.forEach(async data => {

      util.fastify.mailer.verify(async (error, success) => {
        if (error) {
          this.log(util, { "mail": "failed", "error": error })
          collection.updateOne(
            { "_id": data._id },
            { $push: { log: { "status": "failed", "errors": error , "updated": new Date() } } })

        } else {
          let mail = {
            to: data.details.email,
            subject: await util.fastify.view(data.details.subject, data.details),
            html: await util.fastify.view(data.details.message, data.details)
          }
          util.fastify.mailer.sendMail(mail, (errors, info) => {

            if (errors) {

              this.log(util, { "mail": "failed", "errors": errors })
              //update event log
              collection.updateOne(
                { "_id": data._id },
                { $push: { log: { "status": "failed", "errors": errors, "updated": new Date() } } })

            } else {

              //update event log
              collection.updateOne(
                { "_id": data._id },
                { $push: { log: { "status": "complete", ...info, "updated": new Date() } } })

            }

          })

        }
      });

    })

  }


  async notification(util) {

    const collection = util.db.collection('events')
    const schema = { "notification": true, "log.status": "pending", 'log.status': { '$ne': "complete" } }

    let pending = await collection.find(schema).toArray();

    pending.forEach(async data => {

      let notification = {
        to: data.details.email,
        subject: await util.fastify.view(data.details.subject, data.details),
        html: await util.fastify.view(data.details.message, data.details)
      }




    });


  }

};


