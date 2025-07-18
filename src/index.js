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

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST','PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization','X-DB-Type', 'X-Db-Type', 'x-db-type'],
    credentials: true
}));


app.use(authMiddleware.authentication);
app.use(express.static("public/mysql-gui-client"));
app.use(gZipper(__dirname + "/public/mysql-gui-client"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json({ limit: process.env.BODY_SIZE || "50mb" }));

app.use("/api/auth", authRouter);
app.use("/api/sql", dbRouter);
app.use("/api/connections", connectionRouter);
app.use("/api/sql/openai", langchainRouter);

app.get("/", (req, res) =>
  res.sendFile(__dirname + "/public/mysql-gui-client/index.html")
);


const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`> Access MySQL GUI at http://localhost:${port}`);
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
