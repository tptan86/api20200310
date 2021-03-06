const { join } = require('path');
const fs = require('fs');

const preconditions = require('express-preconditions')
const cors = require('cors');
const range = require('express-range')
const compression = require('compression')

const { Validator, ValidationError } = require('express-json-validator-middleware')
const  OpenAPIValidator  = require('express-openapi-validator').OpenApiValidator;

const schemaValidator = new Validator({ allErrors: true, verbose: true });

const express = require('express')

const data = require('./zips')
const CitiesDB = require('./zipsdb')

//Load application keys
const db = CitiesDB(data);

const app = express();
app.set('etag', false)

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Start of workshop

// TODO 1/2 Load schemans
new OpenAPIValidator({
    apiSpec: join(__dirname, 'schema', 'zips.yaml')
}).install(app)
.then(() =>  {
    // Start of workshop

    // Mandatory workshop
    // TODO GET /api/states
    app.get('/api/states',
        (req, resp) => { //handler
            console.log('in api states')
            const result = db.findAllStates();
            //status code
            resp.status(200)
            //set Content-Type
            //resp.set('Cache-Control', 'public, max-age=300')
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.json(result)
        }
    )

    const options = {
        stateAsync: (req) => {
            const state = req.params.state
            const limit = parseInt(req.query.limit) || 10;
            const offset = parseInt(req.query.offset) || 0;
            
            return Promise.resolve({
                etag: `"$(state)_$(offset)_$(limit)"`
            })
        }
    }

    // TODO GET /api/state/:state
    app.get('/api/state/:state',
        preconditions(options),
        (req, resp) => { //handler
            const limit = parseInt(req.query.limit) || 10;
            const offset = parseInt(req.query.offset) || 0;
            const result = db.findCitiesByState(req.params.state, {offset, limit});
            //status code
            resp.status(200)
            //set Content-Type
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.set("ETag", `"$(state)_$(offset)_$(limit)"`)
            resp.json(result)
        }
    )

    // TODO GET /api/city/:cityId
    app.get('/api/city/:cityID',
        (req, resp) => { //handler
            const result = db.findCityById(req.params.cityID);
            //status code
            resp.status(200)
            //set Content-Type
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.json(result)
        }
    ) 

    // TODO POST /api/city
    app.post('/api/city',
        (req, resp) => { //handler
            const body = req.body
/*             if (!db.validateForm(body)) //fail validation
            {
                resp.status(400)
                resp.type('application/json')
                resp.json({ 'message': 'incomplete form', 'city': 'not sure' })
                return
            }  */

            //if pass, insert into DB
            db.insertCity(body)
            resp.status(201)
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.json({'message': 'created'})
        }
    )

    // Optional workshop
    // TODO HEAD /api/state/:state
    // IMPORTANT: HEAD must be place before GET for the
    // same resource. Otherwise the GET handler will be invoked


    // TODO GET /state/:state/count
    app.get('/api/state/:state/count',
        (req, resp) => { //handler
            const count = db.countCitiesInState(req.params.state);
            const result = {
                state: req.params.state,
                numOfCities: count,
                timestamp: new Date().toDateString()
            }
            //status code
            resp.status(200)
            //set Content-Type
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.json(result)
        }
    )

    // TODO GET /api/city/:name
    app.get('/api/city/:name',
        (req, resp) => { //handler
            const result = db.findCitiesByName(req.params.name);
            //status code
            resp.status(200)
            //set Content-Type
            resp.type('application/json')
            resp.set('X-Generated-On', (new Date()).toDateString())
            resp.json(result)
        }
    )
    // End of workshop

})
.catch(error => { 
    console.error()
})

app.use('/schema', express.static(join(__dirname, 'schema')));

app.use((error, req, resp, next) => {

    if (error instanceof ValidationError) {
  		console.error('Schema validation error: ', error)
  		return resp.status(400).type('application/json').json({ error: error });
    }

    else if (error.status) {
  		console.error('OpenAPI specification error: ', error)
  		return resp.status(400).type('application/json').json({ error: error });
    }

    console.error('Error: ', error);
    resp.status(400).type('application/json').json({ error: error });

});

const PORT = parseInt(process.argv[2] || process.env.APP_PORT) || 3000;
app.listen(PORT, () => {
    console.info(`Application started on port ${PORT} at ${new Date()}`);
});
