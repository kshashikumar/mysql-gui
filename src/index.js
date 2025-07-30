const express = require("express");
const cors = require("cors");
const argv = require("minimist")(process.argv.slice(2));
const authMiddleware = require("./middleware/authentication");
const dbRouter = require("./routes/dbRoutes");
const langchainRouter = require("./routes/langchainRoutes");
const gZipper = require("connect-gzip-static");
const bodyParser = require("body-parser");
const authRouter = require("./routes/authRoutes");
const connectionRouter = require("./routes/connectionRoutes");
const configRouter = require("./routes/configRoutes");

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST','PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization','X-DB-Type', 'X-Db-Type', 'x-db-type'],
    credentials: true
}));

app.use(express.static("public/dbfuse-ai-client"));
app.use(gZipper(__dirname + "/public/dbfuse-ai-client"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: process.env.BODY_SIZE || "50mb" }));
app.get("/", (req, res) =>
  res.sendFile(__dirname + "/public/dbfuse-ai-client/index.html")
);



app.use(authMiddleware.authentication);


app.use("/api/auth", authRouter);
app.use("/api/sql", dbRouter);
app.use("/api/connections", connectionRouter);
app.use("/api/openai", langchainRouter);
app.use("/api/config", configRouter);



const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`> Access DBFuse AI at http://localhost:${port}`);
});

// error handler
app.use((err, req, res, next) => {
  console.log(err);
  const error = {
    errmsg: err.errmsg,
    name: err.name,
  };
  return res.status(500).send(error);
});
