const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
var admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 5000;


/// firebase admin initialization

var serviceAccount = require('./ema-website-firebase-firebase-adminsdk-4bu5s-808f499db4.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

//Middleware import
app.use(cors());
app.use(express.json());

//Connect mongoDB server
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tuofi.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

/// email secure token verification

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const idToken = req.headers.authorization.split('Bearer ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(idToken);
            req.decodedUserEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}


///////////////////////////////////////
async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        const database = client.db("online_shop");
        const productCollection = database.collection("products");
        const orderCollection = database.collection("orders");

        //get api use find products
        app.get('/products', async (req, res) => {
            const cursor = productCollection.find({});
            const page = req.query.page;
            const size = parseInt(req.query.size);
            let products;
            const count = await cursor.count();
            if (page) {
                products = await cursor.skip(page * size).limit(size).toArray();
            } else {
                products = await cursor.toArray();
            }
            res.send({
                count,
                products
            });
        });

        //Use post to get data by keys
        app.post('/products/byKeys', async (req, res) => {
            const keys = req.body;
            const query = { key: { $in: keys } }
            const products = await productCollection.find(query).toArray();
            res.json(products);
        })

        // order post api
        app.get('/orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            console.log(req.decodedUserEmail)
            if (req.decodedUserEmail === email) {
                const query = { email: email };
                const cursor = orderCollection.find(query);
                const orders = await cursor.toArray();
                res.json(orders);
            }
            else {
                res.status(401).json({ message: 'User not authorized' })
            }

        });

        app.post('/orders', async (req, res) => {
            const order = req.body;
            order.createdAt = new Date();
            const result = await orderCollection.insertOne(order);
            res.json(result);
        })

    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Ema jhon is running');
})



app.listen(port, () => {
    console.log('Server running at port', port)
})