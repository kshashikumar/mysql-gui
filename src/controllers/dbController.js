const DBConnector = require("../config/dbConnector");
const {
  escapeIdentifier,
  escapeQualified,
} = require("../utils/sqlIdentifier");

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

// ----------------------------------------------------------------------------
// Row CRUD helpers (Phase 1)
// ----------------------------------------------------------------------------

// Returns the primary-key column names for a table, in ordinal order.
// Queries INFORMATION_SCHEMA with explicit TABLE_SCHEMA, so no `USE` needed.
async function getPrimaryKeyColumns(dbName, table) {
  const rows = await DBConnector.GetDB().raw(
    `
        SELECT COLUMN_NAME AS column_name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI'
        ORDER BY ORDINAL_POSITION
      `,
    [dbName, table]
  );
  return rows[0].map((r) => r.column_name);
}

// Ensures the client-supplied identity columns are exactly the table's PK.
function assertPrimaryKeyMatch(actualPk, clientPk) {
  if (actualPk.length === 0) {
    const err = new Error("NO_IDENTITY");
    err.code = "NO_IDENTITY";
    return err;
  }
  const sameSet =
    actualPk.length === clientPk.length &&
    actualPk.every((c) => clientPk.includes(c));
  if (!sameSet) {
    const err = new Error(
      "Provided pkColumns do not match the table's primary key."
    );
    err.code = "PK_MISMATCH";
    err.actualPk = actualPk;
    return err;
  }
  return null;
}

// POST /api/mysql/database/:dbName/row/insert
// body: { table: string, rows: Array<object> }
// resp: { affectedRows: number, insertId: number|null }
const insertRow = async (req, res) => {
  const dbName = req.params.dbName;
  const { table, rows } = req.body;

  if (!table || !Array.isArray(rows) || rows.length === 0) {
    return res
      .status(400)
      .json({ error: "table and a non-empty rows array are required." });
  }

  try {
    await DBConnector.ConnectToDb(dbName);
    const tbl = escapeQualified([table]);
    let totalAffected = 0;
    let lastInsertId = null;

    for (const row of rows) {
      const cols = Object.keys(row);
      if (cols.length === 0) continue;
      const colList = cols.map((c) => escapeIdentifier(c)).join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      const sql = `INSERT INTO ${tbl} (${colList}) VALUES (${placeholders})`;
      const result = await DBConnector.GetDB().raw(sql, Object.values(row));
      totalAffected += result[0]?.affectedRows || 0;
      if (result[0]?.insertId) lastInsertId = result[0].insertId;
    }

    res.status(200).json({ affectedRows: totalAffected, insertId: lastInsertId });
  } catch (err) {
    console.error("Error inserting row:", err);
    res.status(500).json({ error: "Error inserting row.", detail: err.message });
  }
};

// PUT /api/mysql/database/:dbName/row/update
// body: { table, pkColumns: string[], pkValues: any[], values: object }
// resp: { affectedRows: number }
const updateRow = async (req, res) => {
  const dbName = req.params.dbName;
  const { table, pkColumns, pkValues, values } = req.body;

  if (
    !table ||
    !Array.isArray(pkColumns) ||
    !Array.isArray(pkValues) ||
    !values ||
    typeof values !== "object"
  ) {
    return res.status(400).json({
      error: "table, pkColumns[], pkValues[], and values{} are required.",
    });
  }

  try {
    await DBConnector.ConnectToDb(dbName);
    const actualPk = await getPrimaryKeyColumns(dbName, table);
    const identityErr = assertPrimaryKeyMatch(actualPk, pkColumns);
    if (identityErr) {
      return res.status(400).json({
        error: identityErr.message,
        code: identityErr.code,
        actualPk: identityErr.actualPk,
      });
    }
    if (pkColumns.length !== pkValues.length) {
      return res
        .status(400)
        .json({ error: "pkColumns and pkValues length mismatch." });
    }

    const setCols = Object.keys(values);
    if (setCols.length === 0) {
      return res.status(200).json({ affectedRows: 0 });
    }

    const tbl = escapeQualified([table]);
    const setClause = setCols
      .map((c) => `${escapeIdentifier(c)} = ?`)
      .join(", ");
    const whereClause = pkColumns
      .map((c) => `${escapeIdentifier(c)} = ?`)
      .join(" AND ");
    const sql = `UPDATE ${tbl} SET ${setClause} WHERE ${whereClause}`;
    const bindings = [...setCols.map((c) => values[c]), ...pkValues];

    const result = await DBConnector.GetDB().raw(sql, bindings);
    res.status(200).json({ affectedRows: result[0]?.affectedRows || 0 });
  } catch (err) {
    console.error("Error updating row:", err);
    res.status(500).json({ error: "Error updating row.", detail: err.message });
  }
};

// DELETE /api/mysql/database/:dbName/row/delete
// body: { table, pkColumns: string[], pkValues: any[] }
// resp: { affectedRows: number }
const deleteRow = async (req, res) => {
  const dbName = req.params.dbName;
  const { table, pkColumns, pkValues } = req.body;

  if (!table || !Array.isArray(pkColumns) || !Array.isArray(pkValues)) {
    return res
      .status(400)
      .json({ error: "table, pkColumns[], and pkValues[] are required." });
  }

  try {
    await DBConnector.ConnectToDb(dbName);
    const actualPk = await getPrimaryKeyColumns(dbName, table);
    const identityErr = assertPrimaryKeyMatch(actualPk, pkColumns);
    if (identityErr) {
      return res.status(400).json({
        error: identityErr.message,
        code: identityErr.code,
        actualPk: identityErr.actualPk,
      });
    }
    if (pkColumns.length !== pkValues.length) {
      return res
        .status(400)
        .json({ error: "pkColumns and pkValues length mismatch." });
    }

    const tbl = escapeQualified([table]);
    const whereClause = pkColumns
      .map((c) => `${escapeIdentifier(c)} = ?`)
      .join(" AND ");
    const sql = `DELETE FROM ${tbl} WHERE ${whereClause}`;

    const result = await DBConnector.GetDB().raw(sql, pkValues);
    res.status(200).json({ affectedRows: result[0]?.affectedRows || 0 });
  } catch (err) {
    console.error("Error deleting row:", err);
    res.status(500).json({ error: "Error deleting row.", detail: err.message });
  }
};

module.exports = {
  getDatabases,
  getTables,
  getTableInfo,
  executeQuery,
  getMultipleTablesInfo,
  insertRow,
  updateRow,
  deleteRow,
};
