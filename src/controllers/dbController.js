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

      const tables = await DBConnector.GetDB().raw(
        `
            SELECT 
              TABLE_NAME AS table_name
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = ?
          `,
        [dbName]
      );

      const views = await DBConnector.GetDB().raw(
        `
            SELECT 
              TABLE_NAME AS view_name
            FROM INFORMATION_SCHEMA.VIEWS
            WHERE TABLE_SCHEMA = ?
          `,
        [dbName]
      );

      const tablesData = [];

      for (let table of tables[0]) {
        tablesData.push({
          name: table.table_name,
        });
      }

      const viewsData = [];

      for (let view of views[0]) {
        viewsData.push({
          name: view.view_name,
        });
      }

      databaseStats.push({
        name: dbName,
        sizeOnDisk: sizeOnDisk,
        tables: tablesData,
        views: viewsData,
      });
    }
    res.status(200).json({
      databases: databaseStats,
    });
  } catch (err) {
    console.error("Error fetching database stats:", err);
    res.status(500).json({ error: "Error fetching database stats" });
  }
};

const getTableInfo = async (req, res) => {
  const dbName = req.params.dbName;
  const table = req.params.table;

  try {
    const columns = await DBConnector.GetDB().raw(
      `
              SELECT 
                COLUMN_NAME AS column_name,
                COLUMN_KEY AS column_key,
                DATA_TYPE AS data_type,
                COLUMN_TYPE AS column_type,
                IS_NULLABLE AS is_nullable,
                COLUMN_DEFAULT AS column_default,
                EXTRA AS extra,
                ORDINAL_POSITION AS ordinal_position,
                CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
                NUMERIC_PRECISION AS numeric_precision,
                NUMERIC_SCALE AS numeric_scale
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION
            `,
      [dbName, table]
    );

    const indexes = await DBConnector.GetDB().raw(
      `
                SELECT 
                  INDEX_NAME AS index_name,
                  COLUMN_NAME AS column_name,
                  SEQ_IN_INDEX AS seq_in_index,
                  NON_UNIQUE AS non_unique
                FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY INDEX_NAME, SEQ_IN_INDEX
              `,
      [dbName, table]
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
      [dbName, table]
    );

    const triggers = await DBConnector.GetDB().raw(
      `
                SELECT 
                  TRIGGER_NAME AS trigger_name
                FROM INFORMATION_SCHEMA.TRIGGERS
                WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?
              `,
      [dbName, table]
    );

    const tableInfo = {
      db_name: dbName,
      table_name: table,
      columns: columns[0],
      indexes: indexes[0],
      foreign_keys: foreignKeys[0],
      triggers: triggers[0],
    };
    res.status(200).json(tableInfo);
  } catch (err) {
    console.error("Error fetching table stats:", err);
    res.status(500).json({ error: "Error fetching table stats" });
  }
};

const getMultipleTablesInfo = async (req, res) => {
  const dbName = req.params.dbName;
  const { tables } = req.body;

  if (!dbName || !tables || !Array.isArray(tables) || tables.length === 0) {
    return res
      .status(400)
      .json({ error: "Database name and tables array are required." });
  }

  try {
    const tableDetails = [];

    for (const table of tables) {
      // Fetch columns
      const columns = await DBConnector.GetDB().raw(
        `
        SELECT 
          COLUMN_NAME AS column_name,
          COLUMN_KEY AS column_key,
          DATA_TYPE AS data_type,
          COLUMN_TYPE AS column_type,
          IS_NULLABLE AS is_nullable,
          COLUMN_DEFAULT AS column_default,
          EXTRA AS extra,
          ORDINAL_POSITION AS ordinal_position,
          CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
          NUMERIC_PRECISION AS numeric_precision,
          NUMERIC_SCALE AS numeric_scale
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
        `,
        [dbName, table]
      );

      // Fetch indexes
      const indexes = await DBConnector.GetDB().raw(
        `
        SELECT 
          INDEX_NAME AS index_name,
          COLUMN_NAME AS column_name,
          SEQ_IN_INDEX AS seq_in_index,
          NON_UNIQUE AS non_unique
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `,
        [dbName, table]
      );

      // Fetch foreign keys
      const foreignKeys = await DBConnector.GetDB().raw(
        `
        SELECT 
          kcu.CONSTRAINT_NAME AS fk_name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc 
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
        `,
        [dbName, table]
      );

      // Fetch triggers
      const triggers = await DBConnector.GetDB().raw(
        `
        SELECT 
          TRIGGER_NAME AS trigger_name
        FROM INFORMATION_SCHEMA.TRIGGERS
        WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?
        `,
        [dbName, table]
      );

      // Aggregate table information
      tableDetails.push({
        table_name: table,
        columns: columns[0],
        indexes: indexes[0],
        foreign_keys: foreignKeys[0],
        triggers: triggers[0],
      });
    }

    res.status(200).json({ tables: tableDetails });
  } catch (err) {
    console.error("Error fetching multiple table stats:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching table information." });
  }
};

const getTables = async (req, res) => {
  const dbName = req.params.dbName;
  try {
    // Connect to the specified database
    await DBConnector.ConnectToDb(dbName);

    // Fetch the tables
    const tables = await DBConnector.GetDB().raw("SHOW TABLES");
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
    // Connect to the specified database
    await DBConnector.ConnectToDb(dbName);

    // Split multiple queries and filter out empty ones
    const queries = query
      .split(";")
      .map((q) => q.trim())
      .filter((q) => q);

    let result = [];
    let totalRows = null;
    let messages = [];

    for (const singleQuery of queries) {
      // Check query type using regex
      const isSelectQuery = /^SELECT\s/i.test(singleQuery);
      const isShowCommand = /^SHOW\s/i.test(singleQuery);
      const isDescribeCommand = /^DESCRIBE\s/i.test(singleQuery);
      const isInsertCommand = /^INSERT\s/i.test(singleQuery);
      const isUpdateCommand = /^UPDATE\s/i.test(singleQuery);
      const isDeleteCommand = /^DELETE\s/i.test(singleQuery);
      const isCreateCommand = /^CREATE\s/i.test(singleQuery);
      const isDropCommand = /^DROP\s/i.test(singleQuery);
      const isAlterCommand = /^ALTER\s/i.test(singleQuery);
      const isGrantCommand = /^GRANT\s/i.test(singleQuery);
      const isRevokeCommand = /^REVOKE\s/i.test(singleQuery);
      const isTransactionCommand =
        /^BEGIN\s/i.test(singleQuery) ||
        /^COMMIT\s/i.test(singleQuery) ||
        /^ROLLBACK\s/i.test(singleQuery);

      if (isSelectQuery) {
        // Handle SELECT queries with pagination
        let paginatedQuery = singleQuery;

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
      } else if (isShowCommand || isDescribeCommand) {
        const queryInfo = await DBConnector.GetDB().raw(singleQuery);
        result.push(...queryInfo[0]);

        messages.push({
          query: singleQuery,
          message: "Database command executed successfully",
        });
      } else if (
        isInsertCommand ||
        isUpdateCommand ||
        isDeleteCommand ||
        isCreateCommand ||
        isDropCommand ||
        isAlterCommand
      ) {
        // Handle DML and DDL commands
        const response = await DBConnector.GetDB().raw(singleQuery);
        const affectedRows = response[0]?.affectedRows || 0;

        messages.push({
          query: singleQuery,
          message: "Command executed successfully",
          affectedRows: affectedRows,
        });
      } else if (isGrantCommand || isRevokeCommand) {
        // Handle GRANT and REVOKE commands
        await DBConnector.GetDB().raw(singleQuery);
        messages.push({
          query: singleQuery,
          message: "Permission command executed successfully",
        });
      } else if (isTransactionCommand) {
        // Handle Transaction commands
        await DBConnector.GetDB().raw(singleQuery);
        messages.push({
          query: singleQuery,
          message: "Transaction command executed successfully",
        });
      } else {
        // Handle unsupported or unknown commands
        messages.push({
          query: singleQuery,
          message: "Command not recognized or unsupported",
        });
      }
    }

    // Return results and messages
    res.status(200).json({ rows: result, totalRows, messages });
  } catch (err) {
    console.error("Error fetching queryInfo:", err);

    if (err.code === "ER_PARSE_ERROR" || err.sqlState === "42000") {
      res
        .status(400)
        .json({ error: "SQL syntax error. Please check your query." });
    } else {
      res.status(500).json({ error: "Error executing query." });
    }
  }
};

module.exports = {
  getDatabases,
  getTables,
  getTableInfo,
  executeQuery,
  getMultipleTablesInfo,
};
