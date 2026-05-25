const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

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

    app.get("/inventory", async (req, res) => {
      const result = await inventoryCollection.find().toArray();

      res.json(result);
    });

    app.patch("/inventoryUpdate/:id", async (req, res) => {
      const { id } = req.params;

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const result = await inventoryCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updateData,
        },
      );

      res.json(result);
    });

    app.delete("/deleteProduct/:id", async (req, res) => {
      const { id } = req.params;

      const result = await inventoryCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    app.post("/addInventory", async (req, res) => {
      const inventoryData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await inventoryCollection.insertOne(inventoryData);

      res.json(result);
    });

    await client.db("admin").command({ ping: 1 });

    console.log("MongoDB Connected");
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
});
