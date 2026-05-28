const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

// Override DNS resolution for MongoDB Atlas SRV reliability on serverless start
try {
  const dns = require("node:dns");
  if (dns && typeof dns.setServers === "function") {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  }
} catch (e) {
  console.warn("Could not override DNS servers programmatically:", e);
}

dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Leverage MongoDB implicit connection pooling (driver connects automatically on first query)
const db = client.db("inventory");
const inventoryCollection = db.collection("inventor");
const billingCollection = db.collection("billing");

// Dynamically create JWKS so that a missing or invalid CLIENT_URL on start does not trigger a crash
let JWKS;
const getJWKS = () => {
  if (!JWKS) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
  }
  return JWKS;
};

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  try {
    const jwks = getJWKS();
    await jwtVerify(token, jwks);
    next();
  } catch (error) {
    console.log(error);

    return res.status(403).json({
      message: "Forbidden",
    });
  }
};

// GET ALL INVENTORY
app.get("/inventory", verifyToken, async (req, res) => {
  try {
    const result = await inventoryCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to fetch inventory",
    });
  }
});

// ADD INVENTORY
app.post("/addInventory", verifyToken, async (req, res) => {
  try {
    const data = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await inventoryCollection.insertOne(data);
    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to add inventory",
    });
  }
});

// UPDATE INVENTORY
app.patch("/inventoryUpdate/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        error: "Invalid ID",
      });
    }
    const updatedData = {
      ...req.body,
      updatedAt: new Date(),
    };
    const result = await inventoryCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to update inventory",
    });
  }
});

// DELETE INVENTORY
app.delete("/deleteProduct/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        error: "Invalid ID",
      });
    }
    const result = await inventoryCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to delete product",
    });
  }
});

// ADD BILLING
app.post("/addBilling", verifyToken, async (req, res) => {
  try {
    console.log("🔥 ADD BILLING API HIT");
    const { customerName, customerAddress, customerPhone, status, items, total, paidAmount, dueAmount } = req.body;

    // VALIDATION
    if (
      !customerName ||
      !status ||
      !items ||
      items.length === 0 ||
      total === undefined
    ) {
      return res.status(400).send({
        error: "Missing required fields",
      });
    }

    // ITEMS VALIDATION
    const validItems = items.every(
      (item) =>
        item.productName &&
        item.quantity > 0 &&
        item.unit &&
        item.sellPrice >= 0
    );

    if (!validItems) {
      return res.status(400).send({
        error: "Invalid item structure",
      });
    }

    const billingData = {
      customerName: customerName.trim(),
      customerAddress: customerAddress ? customerAddress.trim() : "",
      customerPhone: customerPhone ? customerPhone.trim() : "",
      status,
      items: items.map((item) => ({
        productName: item.productName,
        quantity: Number(item.quantity),
        unit: item.unit,
        sellPrice: Number(item.sellPrice),
      })),
      total: Number(total),
      paidAmount: paidAmount !== undefined ? Number(paidAmount) : Number(total),
      dueAmount: dueAmount !== undefined ? Number(dueAmount) : 0,
      createdAt: new Date(),
    };

    console.log("📦 DATA READY");
    const result = await billingCollection.insertOne(billingData);
    console.log("✅ BILLING SAVED");

    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.log("❌ ADD BILLING ERROR");
    console.log(error);
    res.status(500).send({
      error: "Failed to add billing",
    });
  }
});

// GET ALL BILLING
app.get("/billing", verifyToken, async (req, res) => {
  try {
    const result = await billingCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to fetch billing",
    });
  }
});

// GET SINGLE BILLING
app.get("/billing/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        error: "Invalid ID",
      });
    }
    const result = await billingCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!result) {
      return res.status(404).send({
        error: "Billing not found",
      });
    }
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to fetch billing",
    });
  }
});

// DELETE BILLING
app.delete("/billing/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        error: "Invalid ID",
      });
    }
    const result = await billingCollection.deleteOne({
      _id: new ObjectId(id),
    });
    res.send({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to delete billing",
    });
  }
});

// UPDATE BILLING
app.patch("/billing/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        error: " Invalid ID",
      });
    }
    const updatedData = {
      ...req.body,
      updatedAt: new Date(),
    };
    const result = await billingCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );
    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: "Failed to update billing",
    });
  }
});

app.get("/", (req, res) => {
  res.send({
    message: "🚀 Server Running Fine",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server Running On Port ${PORT}`);
});

module.exports = app;