const knex = require("knex"); // Importing knex, not mysqlClient
const argv = require("minimist")(process.argv.slice(2));

class DBConnector {
  constructor() {}

  // Initialize and return the knex instance
  static GetDB() {
    if (typeof DBConnector.db === "undefined") {
      DBConnector.InitDB();
    }
    return DBConnector.db;
  }

  static InitDB(app) {
    const url = argv.u || process.env.URL || "mysql://root:root@localhost:3306";

    console.log(`> Connecting to mysqlDB @ ${url}`);

    // Initialize the knex client
    DBConnector.db = knex({
      client: "mysql2",
      connection: url,
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 30000,
      },
    });

    // Test connection by running a simple query
    return DBConnector.db
      .raw("SELECT 1")
      .then((res) => {
        if (!res) {
          console.log(
            "> Failed to connect to MySQL DB - no response from server"
          );
          process.exit();
        } else {
          console.log("> Connected to MySQL DB");
          if (app) app.emit("connectedToDB"); // Emit event if app exists
        }
      })
      .catch((err) => {
        console.error(`> Failed to connect to MySQL DB - ${err}`);
        process.exit();
      });
  }

  static async ConnectToDb(dbName) {
    try {
      const db = this.GetDB();
      await db.raw(`USE ${dbName}`);
      console.log(`Switched to database: ${dbName}`);
    } catch (err) {
      console.error(`Error switching to database ${dbName}:`, err);
      throw err;
    }
  }

  static async GetConnections() {
    try {
      const db = this.GetDB();
      const connections = await db.raw(`
        SELECT SCHEMA_NAME AS name, CONCAT('mysql://root:root@localhost:3306/', SCHEMA_NAME) AS url
        FROM INFORMATION_SCHEMA.SCHEMATA
      `);
      return connections[0].map(conn => ({ name: conn.name, url: conn.url, status: 'Available' }));
    } catch (err) {
      console.error("Error fetching connections:", err);
      return [];
    }
  }

  // Disconnect the Knex instance properly
  static Disconnect() {
    if (DBConnector.db) {
      return DBConnector.db.destroy().then(() => {
        console.log("> Disconnected from MySQL DB");
      });
    }
  }
}

module.exports = DBConnector;
