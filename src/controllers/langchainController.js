const { getAIModel } = require("../models/model");
const argv = require("minimist")(process.argv.slice(2));

const initializeLLM = () => {
  const aiModel = argv.model || process.env.AI_MODEL || "GPT-4";
  const apiKey = argv.apikey || process.env.AI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Please provide a valid API key");
  }

  return getAIModel(aiModel, apiKey);
};

const generateSQLQuery = async (dbMeta, databaseName, prompt, llm, dbType) => {
  const selectedDatabase = dbMeta.find((db) => db.name === databaseName);
  if (!selectedDatabase) {
    throw new Error(`Database "${databaseName}" not found.`);
  }

  // Extract table name from the prompt, if specified
  const promptMatch = prompt.match(/for (\w+) table/i);
  const requestedTable = promptMatch ? promptMatch[1] : null;

  let systemPrompt;

  if (requestedTable) {
    // Handle prompts targeting a specific table
    const selectedTable = selectedDatabase.tables.find(
      (table) => table.name === requestedTable
    );

    if (!selectedTable) {
      throw new Error(
        `Table "${requestedTable}" does not exist in database "${databaseName}".`
      );
    }

    const tableColumns = selectedTable.columns
      .map((col) => col.column_name)
      .join(", ");

    systemPrompt = `
You are an AI expert in generating ${dbType} SQL queries. You must generate a single-line SQL query based on the user's request, using the provided schema. Follow these rules strictly:
- Output only the SQL query as plain text, with no explanations, comments, quotes, or additional text.
- Ensure the query is valid for ${dbType}, using correct syntax (e.g., no double quotes for identifiers unless required by ${dbType}).
- Use table aliases for joins and subqueries to avoid ambiguity.
- Avoid duplicate column names by using unique aliases with AS.
- Handle joins, subqueries, conditional logic, nulls, and aggregation as needed.
- Ensure the query can be used as a subquery for paginated results, with uniquely named columns.
- Do not include line breaks or formatting; the query must be a single line.

Database Schema:
Database Type: ${dbType}
Database: ${databaseName}
Table: ${requestedTable}
Columns: ${tableColumns}

Example:
Database: test
Table: employees
Columns: id, name, age, position
Prompt: Select all employees whose age is greater than 30
Output: SELECT id AS emp_id, name AS emp_name, age, position FROM employees WHERE age > 30

User Request: ${prompt}
Output only the SQL query.
`;
  } else {
    // Handle prompts involving multiple tables or no specific table
    const schemaString = selectedDatabase.tables
      .filter((table) => table.columns && table.columns.length > 0)
      .map((table) => {
        const columns = table.columns.map((col) => col.column_name).join(", ");
        return `Table: ${table.name}, Columns: [${columns}]`;
      })
      .join("\n");

    if (!schemaString) {
      throw new Error(
        `No tables with valid columns found in database "${databaseName}".`
      );
    }

    systemPrompt = `
You are an AI expert in generating ${dbType} SQL queries. You must generate a single-line SQL query based on the user's request, using the provided schema. Follow these rules strictly:
- Output only the SQL query as plain text, with no explanations, comments, quotes, or additional text.
- Ensure the query is valid for ${dbType}, using correct syntax (e.g., no double quotes for identifiers unless required by ${dbType}).
- Use table aliases for joins and subqueries to avoid ambiguity.
- Avoid duplicate column names by using unique aliases with AS.
- Handle joins, subqueries, conditional logic, nulls, and aggregation as needed.
- Ensure the query can be used as a subquery for paginated results, with uniquely named columns.
- Do not include line breaks or formatting; the query must be a single line.

Database Schema:
Database Type: ${dbType}
Database: ${databaseName}
${schemaString}

Example:
Database: test
Tables:
Table: employees, Columns: [id, name, age, dept_id]
Table: departments, Columns: [dept_id, dept_name]
Prompt: Join employees and departments to get employee names and department names
Output: SELECT e.id AS emp_id, e.name AS emp_name, d.dept_name AS dept_name FROM employees e JOIN departments d ON e.dept_id = d.dept_id

User Request: ${prompt}
Output only the SQL query.
`;
  }

  // Call the LLM with the system prompt
  const result = await llm.call([
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ]);

  // Clean the output to ensure it's a single-line SQL query
  const cleanedQuery = result.text
    .trim()
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/\s+/g, " ") // Replace multiple spaces/newlines with a single space
    .replace(/;{2,}/g, ";") // Ensure only one semicolon
    .replace(/[\r\n]+/g, ""); // Remove any line breaks

  if (!cleanedQuery) {
    throw new Error("Generated query is empty or invalid.");
  }

  return cleanedQuery;
};

const executePrompt = async (req, res) => {
  try {
    const { dbMeta, databaseName, prompt } = req.body;
    const dbType = req.headers["x-db-type"] || req.headers["X-DB-Type"];

    if (!dbMeta || !databaseName || !prompt) {
      return res
        .status(400)
        .json({ error: "Database metadata, name, and prompt are required" });
    }

    if (!dbType) {
      return res
        .status(400)
        .json({ error: "Database type (x-db-type) must be specified in headers" });
    }

    const llm = initializeLLM();

    // Generate the SQL query
    const query = await generateSQLQuery(dbMeta, databaseName, prompt, llm, dbType);

    res.status(200).json({ query });
  } catch (err) {
    console.error("Error generating query:", err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  executePrompt,
};