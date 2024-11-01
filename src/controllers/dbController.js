const DBConnector = require("../config/dbConnector");

const getDatabases = async (req, res) => {
  try {
    const databases = await DBConnector.GetDB().raw(`
          SELECT 
            SCHEMA_NAME AS name
          FROM INFORMATION_SCHEMA.SCHEMATA
        `);

    const databaseStats = [];

    for (let db of databases[0]) {
      const dbName = db.name;
      const sizeData = await DBConnector.GetDB().raw(
        `
            SELECT 
              SUM(DATA_LENGTH + INDEX_LENGTH) AS sizeOnDisk 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ?
          `,
        [dbName]
      );

      const sizeOnDisk = sizeData[0][0].sizeOnDisk || 0;
      const tableCount = await DBConnector.GetDB().raw(
        `
            SELECT COUNT(*) AS tableCount 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ?
          `,
        [dbName]
      );

      const isEmpty = tableCount[0][0].tableCount === 0;

      const tables = await DBConnector.GetDB().raw(
        `
            SELECT 
              TABLE_NAME AS table_name
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = ?
          `,
        [dbName]
      );

      const tablesWithData = [];

      for (let table of tables[0]) {
        const columns = await DBConnector.GetDB().raw(
          `
              SELECT 
                COLUMN_NAME AS column_name
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
            `,
          [dbName, table.table_name]
        );

        const indexes = await DBConnector.GetDB().raw(
          `
                SELECT 
                  INDEX_NAME AS index_name
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
              `,
          [dbName, table.table_name]
        );

        const foreignKeys = await DBConnector.GetDB().raw(
          `
                SELECT 
                  kcu.CONSTRAINT_NAME AS fk_name
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
                JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
                ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
                WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
              `,
          [dbName, table.table_name]
        );

        const triggers = await DBConnector.GetDB().raw(
          `
                SELECT 
                  TRIGGER_NAME AS trigger_name
                FROM INFORMATION_SCHEMA.TRIGGERS
                WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?
              `,
          [dbName, table.table_name]
        );

        tablesWithData.push({
          name: table.table_name,
          columns: columns[0],
          indexes: indexes[0],
          foreign_keys: foreignKeys[0],
          triggers: triggers[0],
        });
      }

      databaseStats.push({
        name: dbName,
        sizeOnDisk: sizeOnDisk,
        empty: isEmpty,
        tables: tablesWithData,
      });
    }

    // Return the response with the database stats
    res.status(200).json({
      databases: databaseStats,
    });
  } catch (err) {
    console.error("Error fetching database stats:", err);
    res.status(500).json({ error: "Error fetching database stats" });
  }
};

const getTables = async (req, res) => {
  const dbName = req.params.dbName;
  try {
    // Connect to the specified database
    await DBConnector.ConnectToDb(dbName);

    // Fetch the tables
    const tables = await DBConnector.GetDB().raw("SHOW TABLES");
    console.log("Tables:", tables[0]);
    res.status(200).json(tables[0]);
  } catch (err) {
    console.error("Error fetching tables:", err);
    res.status(500).json({ error: "Error fetching tables" });
  }
};

const executeQuery = async (req, res) => {
  const dbName = req.params.dbName;
  let { query, page = 1, pageSize = 10 } = req.body;

  try {
    await DBConnector.ConnectToDb(dbName);

    const queries = query
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q);

    let result = [];
    let totalRows = null;

    for (const singleQuery of queries) {
      const isSelectQuery = /^SELECT\s/i.test(singleQuery);

      let paginatedQuery = singleQuery;
      if (isSelectQuery) {
        const hasLimitOrOffset =
          /LIMIT\s+\d+/i.test(singleQuery) || /OFFSET\s+\d+/i.test(singleQuery);

        if (!hasLimitOrOffset) {
          const offset = (page - 1) * pageSize;
          paginatedQuery = `${singleQuery} LIMIT ${pageSize} OFFSET ${offset}`;
        }

        const queryInfo = await DBConnector.GetDB().raw(paginatedQuery);
        result.push(...queryInfo[0]);

        if (totalRows === null) {
          const totalRowsQuery = `SELECT COUNT(*) as count FROM (${singleQuery}) as subquery`;
          const totalRowsResult = await DBConnector.GetDB().raw(totalRowsQuery);
          totalRows = totalRowsResult[0][0].count;
        }
      } else {
        await DBConnector.GetDB().raw(singleQuery);
      }
    }

    res.status(200).json({ rows: result, totalRows });
  } catch (err) {
    console.error("Error fetching queryInfo:", err);

    if (err.code === "ER_PARSE_ERROR" || err.sqlState === "42000") {
      res
        .status(400)
        .json({ error: "SQL syntax error. Please check your query." });
    } else {
      res.status(500).json({ error: "Error fetching queryInfo" });
    }
  }
};

module.exports = {
  getDatabases,
  getTables,
  executeQuery,
};
