const path = require("path");
const fs = require("fs").promises;
exports.fs = fs;

const readConnectionsFromFile = async () => {
    const filePath = path.join(__dirname, "..", "config", "dbConnections.json");
    try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data).map((conn) => ({
            id: conn.id || Date.now() + Math.random(), // Generate ID if missing
            username: conn.username,
            password: conn.password,
            host: conn.host,
            port: conn.port,
            dbType: conn.dbType,
            database: conn.database || "",
            socketPath: conn.socketPath || "",
            ssl: conn.ssl || false,
            connectionTimeout: conn.connectionTimeout || 60000,
            poolSize: conn.poolSize || 10,
            status: conn.status || "Available",
            createdAt: conn.createdAt || new Date().toISOString(),
            lastUsed: conn.lastUsed || null
        }));
    } catch (fileErr) {
        console.log("No connections file found, returning empty array");
        return [];
    }
};

const writeConnectionsToFile = async (connections) => {
    const filePath = path.join(__dirname, "..", "config", "dbConnections.json");
    // Ensure each connection has required fields and clean structure
    const cleanConnections = connections.map(conn => ({
        id: conn.id || Date.now() + Math.random(),
        username: conn.username,
        password: conn.password,
        host: conn.host,
        port: conn.port,
        dbType: conn.dbType,
        database: conn.database || "",
        socketPath: conn.socketPath || "",
        ssl: conn.ssl || false,
        connectionTimeout: conn.connectionTimeout || 60000,
        poolSize: conn.poolSize || 10,
        status: conn.status || "Available",
        createdAt: conn.createdAt || new Date().toISOString(),
        lastUsed: conn.lastUsed || null
    }));
    
    await fs.writeFile(filePath, JSON.stringify(cleanConnections, null, 2), "utf8");
};

const getConnections = async (req, res) => {
    try {
        console.log("Fetching connections...");
        const connections = await readConnectionsFromFile();
        return res.status(200).json({ 
            connections,
            count: connections.length,
            retrievedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching connections:", err);
        return res.status(500).json({ error: "Error fetching connections" });
    }
};

const addConnection = async (req, res) => {
    try {
        const newConnection = req.body;

        // Enhanced validation
        const requiredFields = ['username', 'host', 'port', 'dbType'];
        const missingFields = requiredFields.filter(field => !newConnection[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: `Missing required fields: ${missingFields.join(', ')}` 
            });
        }

        // Validate dbType
        const validDbTypes = ['mysql2', 'pg', 'sqlite3', 'mssql', 'oracledb'];
        if (!validDbTypes.includes(newConnection.dbType)) {
            return res.status(400).json({ 
                error: `Invalid dbType. Must be one of: ${validDbTypes.join(', ')}` 
            });
        }

        let connections = await readConnectionsFromFile();

        // Check for duplicates with more specific matching
        const isDuplicate = connections.some(conn =>
            conn.host === newConnection.host &&
            conn.port === parseInt(newConnection.port) &&
            conn.database === (newConnection.database || "") &&
            conn.username === newConnection.username &&
            conn.dbType === newConnection.dbType
        );

        if (isDuplicate) {
            return res.status(409).json({ error: "Connection with these details already exists." });
        }

        // Generate unique ID
        const newId = connections.length > 0 ? Math.max(...connections.map(c => c.id || 0)) + 1 : 1;
        
        const connectionToAdd = {
            id: newId,
            username: newConnection.username,
            password: newConnection.password,
            host: newConnection.host,
            port: parseInt(newConnection.port),
            dbType: newConnection.dbType,
            database: newConnection.database || "",
            socketPath: newConnection.socketPath || "",
            ssl: newConnection.ssl || false,
            connectionTimeout: parseInt(newConnection.connectionTimeout) || 60000,
            poolSize: parseInt(newConnection.poolSize) || 10,
            status: "Available",
            createdAt: new Date().toISOString(),
            lastUsed: null
        };

        connections.push(connectionToAdd);
        await writeConnectionsToFile(connections);

        console.log("Connection added:", connectionToAdd);
        return res.status(201).json({ 
            message: "Connection added successfully", 
            connection: connectionToAdd 
        });
    } catch (err) {
        console.error("Error adding connection:", err);
        return res.status(500).json({ error: "Error adding connection" });
    }
};

const editConnection = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedConnection = req.body;

        if (!id) {
            return res.status(400).json({ error: "Connection ID is required for editing." });
        }
        if (!updatedConnection || Object.keys(updatedConnection).length === 0) {
            return res.status(400).json({ error: "No update data provided." });
        }

        const idToEdit = parseInt(id, 10);
        if (isNaN(idToEdit)) {
            return res.status(400).json({ error: "Invalid Connection ID provided." });
        }

        let connections = await readConnectionsFromFile();
        const index = connections.findIndex(conn => conn.id === idToEdit);

        if (index === -1) {
            return res.status(404).json({ error: "Connection not found." });
        }

        // Preserve certain fields and validate updates
        const updatedFields = {
            ...updatedConnection,
            id: connections[index].id, // Keep original ID
            createdAt: connections[index].createdAt, // Keep creation date
            lastUsed: connections[index].lastUsed, // Keep last used
            port: updatedConnection.port ? parseInt(updatedConnection.port) : connections[index].port,
            connectionTimeout: updatedConnection.connectionTimeout ? 
                parseInt(updatedConnection.connectionTimeout) : connections[index].connectionTimeout,
            poolSize: updatedConnection.poolSize ? 
                parseInt(updatedConnection.poolSize) : connections[index].poolSize,
            ssl: updatedConnection.hasOwnProperty('ssl') ? updatedConnection.ssl : connections[index].ssl
        };

        connections[index] = { ...connections[index], ...updatedFields };
        await writeConnectionsToFile(connections);

        console.log("Connection updated:", connections[index]);
        return res.status(200).json({ 
            message: "Connection updated successfully", 
            connection: connections[index] 
        });
    } catch (err) {
        console.error("Error editing connection:", err);
        return res.status(500).json({ error: "Error editing connection" });
    }
};

const deleteConnection = async (req, res) => {
    try {
        console.log("Delete connection endpoint hit");
        const { id } = req.params;
        console.log("Deleting connection with ID:", id);

        if (!id) {
            return res.status(400).json({ error: "Connection ID is required for deletion." });
        }

        const idToDelete = parseInt(id, 10);
        if (isNaN(idToDelete)) {
            return res.status(400).json({ error: "Invalid Connection ID provided." });
        }

        let connections = await readConnectionsFromFile();
        const initialLength = connections.length;

        console.log("Initial connections length:", initialLength);
        connections = connections.filter(conn => conn.id !== idToDelete);
        console.log("Connections after filter:", connections.length);

        if (connections.length === initialLength) {
            return res.status(404).json({ error: "Connection not found." });
        }

        await writeConnectionsToFile(connections);

        console.log("Connection deleted with ID:", id);
        return res.status(200).json({ 
            message: "Connection deleted successfully",
            deletedId: idToDelete,
            deletedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error deleting connection:", err);
        return res.status(500).json({ error: "Error deleting connection" });
    }
};

const saveConnections = async (req, res) => {
    try {
        const connectionsToSave = req.body.connections;

        if (!connectionsToSave || !Array.isArray(connectionsToSave)) {
            return res.status(400).json({ error: "Invalid data provided. Expected an array of connections." });
        }

        // Validate each connection has required fields
        const invalidConnections = connectionsToSave.filter(conn => 
            !conn.username || !conn.host || !conn.port || !conn.dbType
        );

        if (invalidConnections.length > 0) {
            return res.status(400).json({ 
                error: `${invalidConnections.length} connections are missing required fields (username, host, port, dbType)` 
            });
        }

        await writeConnectionsToFile(connectionsToSave);

        console.log("Connections saved to file.");
        return res.status(200).json({ 
            message: "Connections saved successfully",
            count: connectionsToSave.length,
            savedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error saving connections to file:", err);
        return res.status(500).json({ error: "Error saving connections" });
    }
};

// New endpoint to test connection
const testConnection = async (req, res) => {
    try {
        const { id } = req.params;
        const idToTest = parseInt(id, 10);
        
        if (isNaN(idToTest)) {
            return res.status(400).json({ error: "Invalid Connection ID provided." });
        }

        const connections = await readConnectionsFromFile();
        const connection = connections.find(conn => conn.id === idToTest);

        if (!connection) {
            return res.status(404).json({ error: "Connection not found." });
        }

        // Update last used timestamp
        connection.lastUsed = new Date().toISOString();
        await writeConnectionsToFile(connections);

        return res.status(200).json({ 
            message: "Connection test initiated",
            connection: {
                id: connection.id,
                host: connection.host,
                port: connection.port,
                dbType: connection.dbType,
                database: connection.database
            },
            testedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error testing connection:", err);
        return res.status(500).json({ error: "Error testing connection" });
    }
};

module.exports = {
    getConnections,
    addConnection,
    editConnection,
    deleteConnection,
    saveConnections,
    testConnection
};