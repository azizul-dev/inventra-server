const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

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

const JWKS = createRemoteJWKSet(new URL("http://localhost:3000/api/auth/jwks"));

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    await client.connect();

    const db = client.db("inventory");

    const inventoryCollection = db.collection("inventor");

    app.get("/inventory", verifyToken, async (req, res) => {
      const result = await inventoryCollection.find().toArray();

      res.json(result);
    });

    app.patch("/inventoryUpdate/:id", verifyToken, async (req, res) => {
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

    app.delete("/deleteProduct/:id", verifyToken, async (req, res) => {
      const { id } = req.params;

      const result = await inventoryCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.json(result);
    });

    app.post("/addInventory", verifyToken, async (req, res) => {
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
