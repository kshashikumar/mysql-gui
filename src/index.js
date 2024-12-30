const express = require("express");
const cors = require("cors");
const argv = require("minimist")(process.argv.slice(2));
const DBConnector = require("./config/dbConnector");
const authMiddleware = require("./middleware/authentication");
const dbRouter = require("./routes/dbRoutes");
const langchainRouter = require("./routes/langchainRoutes");
const gZipper = require("connect-gzip-static");
const bodyParser = require("body-parser");

const app = express();

app.use(authMiddleware.authentication);

app.use(express.static("public/mysql-gui-client"));

app.use(gZipper(__dirname + "/public/mysql-gui-client"));

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));

app.use(bodyParser.json({ limit: process.env.BODY_SIZE || "50mb" }));

app.use("/api/mysql/", dbRouter);
app.use("/api/mysql/openai", langchainRouter);

app.get("/", (req, res) =>
  res.sendFile(__dirname + "/public/mysql-gui-client/index.html")
);

//connect to database
DBConnector.InitDB(app);

app.once("connectedToDB", () => {
  const port = argv.p || process.env.PORT || 5005;
  app.listen(port, () => {
    console.log(`> Access MySQL GUI at http://localhost:${port}`);
  });
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
