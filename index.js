const express = require('express');
const BaseRouter=require("./routes/index")
const app = express();
const cors = require("cors");

app.use(cors());
app.use(express.json());
app.use("/api/v1",BaseRouter)

app.listen(3000);