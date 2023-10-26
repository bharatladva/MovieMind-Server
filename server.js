const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { MongoClient } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

// bharat
// const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { User } = require("./userSchema");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let data = { message: "Hello from the server!" };

app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

const uri =
	// "mongodb+srv://rajbha:rajbha8383@firstcluster.ayrsmsq.mongodb.net/main?retryWrites=true&w=majority"
	process.env.MONGODB_CONNECT_URI
  ;
const client = new MongoClient(uri, {});
// await client.connect();

let collection; // Define a global variable to store the MongoDB collection
// Define a global variable to store the MongoDB collection

// Function to refresh the session by executing a low-impact operation
async function refreshSession(session) {
  try {
    // Check if a transaction is already in progress
    if (session.inTransaction()) {
      // If a transaction is in progress, simply perform a read operation
      await collection.find({}).toArray();
    } else {
      // Start a new transaction and perform a read operation
      await session.withTransaction(async () => {
        await collection.find({}).toArray();
      });
    }
  } catch (error) {
    console.error("Error refreshing session:", error);
  }
}

// Define the refresh interval (e.g., every 30 minutes)
const refreshInterval = 3 * 60 * 1000; // 3 minutes in milliseconds

// Periodically refresh the session
setInterval(() => {
  const session = client.startSession();

  session.startTransaction();
  refreshSession(session)
    .then(() => session.commitTransaction())
    .catch((error) => {
      session.abortTransaction();
      console.error("Error refreshing session:", error);
    })
    .finally(() => session.endSession());
}, refreshInterval);

async function setupChangeStream() {
  const changeStream = collection.watch();

  changeStream.on("change", async (change) => {
    // When a change is detected, update the 'data' variable

    try {
      const query = {}; // You can specify a query here if needed
      const result = await collection.find(query).toArray();
      data = result; // Assign the retrieved data to the 'data' variable
      notifyClients(); // Notify WebSocket clients about the data change
    } catch (error) {
      console.error("Error updating data from MongoDB:", error);
    }
  });
}

async function connectMongoDB(client) {
  await client.connect();
  const database = client.db("main");
  collection = database.collection("communities");
  data = await collection.find({}).toArray();
  notifyClients();
}

async function fetchDataFromMongoDB() {
  try {
    await connectMongoDB(client);
    await setupChangeStream();
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

fetchDataFromMongoDB().catch(console.error);

async function notifyClients() {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

app.post("/update-data", (req, res) => {
  const newData = req.body;

  // Update the data with the received data
  data = newData;

  // Broadcast the updated data to all connected clients
  notifyClients();

  res.json({ message: "Data updated successfully" });
});

async function addDataToArray(data) {
  const client = new MongoClient(uri, {});

  try {
    // await client.connect();
    // const database = client.db("main");
    const collectionName = data.collectionName;
    // const collection = database.collection("communities");

    const newData = {
      msg: data.msg,
      uid: data.uid,
      name: data.name,
      time: data.time,
    };

    console.log(newData);

    // Find the document with the name matching collectionName and push newData to its msgs array
    await collection.updateOne(
      { name: collectionName },
      { $push: { msgs: newData } }
    );
  } finally {
    await client.close();
  }
}

// Express route to handle POST requests
app.post("/add-to-array", async (req, res) => {
  try {
    const newData = req.body; // Assuming req.body is an object with msg, uid, name, time, and collectionName

    // Add the data to the document with the matching name in the collection
    await addDataToArray(newData);

    res.json({ message: "Data added to array successfully" });
  } catch (error) {
    console.error("Error adding data to array:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

wss.on("connection", (socket) => {
  // Send the current data when a client connects
  socket.send(JSON.stringify(data));
});

// bharats code

// ----------------------------------------------------------------------------------------------------------------

app.post("/createUser", async (req, res) => {
  try {
    // Extract user data from the request body
    const { name, email, uid } = req.body;
    console.log(name, email, uid);
    mongoose.connect(uri, {
      useNewUrlParser: true,
    });

    // Create a new user document in MongoDB
    const newUser = new User({
      username: name,
      email,
      fireBaseUid: uid,
      favorites: [],
      watchList: [],
      ratings: [],
    });

    // Save the user document to the database
    await newUser.save();

    res.status(201).json({ name: name, message: "User created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/add-to-favorites", async (req, res) => {
  try {
    const { fireBaseUid, itemToAdd, isFavorite } = req.body;
    console.log(fireBaseUid, itemToAdd);
    await client.connect();
    const database = client.db("main");
    let userCollection = database.collection("users");

    const updateOperation = isFavorite
      ? { $pull: { favorites: itemToAdd } } // Remove item
      : { $push: { favorites: itemToAdd } }; // Add item

    const result = await userCollection.updateOne(
      { fireBaseUid: fireBaseUid },
      updateOperation
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ isAdded: false, message: "User not found" });
    }

    res.status(200).json({ isAdded: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ isAdded: false });
  }
});

app.post("/add-to-watchlist", async (req, res) => {
  try {
    const { fireBaseUid, itemToAdd, isWatchListed } = req.body;
    // console.log(fireBaseUid, itemToAdd);
    await client.connect();
    const database = client.db("main");
    let userCollection = database.collection("users");

    const updateOperation = isWatchListed
      ? { $pull: { watchList: itemToAdd } } // Remove item
      : { $push: { watchList: itemToAdd } }; // Add item

    const result = await userCollection.updateOne(
      { fireBaseUid: fireBaseUid },
      updateOperation
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ isAdded: false, message: "User not found" });
    }

    res.status(200).json({ isAdded: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ isAdded: false });
  }
});

app.post("/rate-media", async (req, res) => {
  try {
    const { fireBaseUid, itemToAdd } = req.body;

    await client.connect();
    const database = client.db("main");
    const userCollection = database.collection("users");

    // Find the user document with the given fireBaseUid
    const user = await userCollection.findOne({ fireBaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the index of the existing rating for the same {id, type} if it exists
    const existingRatingIndex = user.ratings.findIndex(
      (rating) => rating.id === itemToAdd.id && rating.type === itemToAdd.type
    );

    // If the item already exists, update it; otherwise, add a new one
    if (existingRatingIndex !== -1) {
      // Update the existing rating
      user.ratings[existingRatingIndex].rating = itemToAdd.selectedRating;
    } else {
      // Add a new rating
      user.ratings.push({
        id: itemToAdd.id,
        type: itemToAdd.type,
        rating: itemToAdd.selectedRating,
      });
    }

    // Update the user document in the database
    await userCollection.updateOne({ fireBaseUid }, { $set: user });

    res.status(200).json({
      updatedTo: itemToAdd.selectedRating,
      message: "Rating updated or added successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ updatedTo: 0, message: "Server error" });
  }
});

app.get("/search-media-data", async (req, res) => {
  try {
    const { fireBaseUid, id, type } = req.query;

    await client.connect();
    const database = client.db("main");
    const userCollection = database.collection("users");

    const user = await userCollection.findOne({ fireBaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const itemToSearch = { id, type };

    const watchlisted = user.watchList.some(
      (item) => item.id === itemToSearch.id && item.type === itemToSearch.type
    );
    const favorited = user.favorites.some(
      (item) => item.id === itemToSearch.id && item.type === itemToSearch.type
    );
    const ratedItem = user.ratings.find(
      (item) => item.id === itemToSearch.id && item.type === itemToSearch.type
    );
    const rated = ratedItem ? ratedItem.rating : 0;

    res.status(200).json({ watchlisted, favorited, rated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/get-user-data-list", async (req, res) => {
  try {
    const { fireBaseUid, dataType } = req.query;

    await client.connect();
    const database = client.db("main");
    const userCollection = database.collection("users");

    const user = await userCollection.findOne({ fireBaseUid });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Use the dataType to determine which array to retrieve
    let arrayData;
    if (dataType === "favorites") {
      arrayData = user.favorites;
    } else if (dataType === "watchList") {
      arrayData = user.watchList;
    } else if (dataType === "ratings") {
      arrayData = user.ratings;
    } else {
      return res.status(400).json({ message: "Invalid array name" });
    }

    res.status(200).json({ arrayData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/:type/:id", async (req, res) => {
  const { itemId, itemType, userId } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          favorites: {
            itemId: itemId,
            itemType: itemType,
          },
        },
      },
      { new: true }
    );

    res.json(user);
  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;

server.listen(5000, () => {
  console.log("Server is running on port 5000");
});
