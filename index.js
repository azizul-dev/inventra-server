const express = require("express");
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



async function run() {
  try {
    await client.connect();


    const db = client.db("inventory");
    const inventoryCollection = db.collection("inventor");


    app.get('/inventory', async(req, res) =>{
      const result = await inventoryCollection.find().toArray();

      res.json(result);
    });

    app.post('/addInventory', async (req, res) =>{
        const inventoryData = req.body;
        console.log(inventoryData);
        const result = await inventoryCollection.insertOne(inventoryData);

        res.json(result);
    })







    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
});
