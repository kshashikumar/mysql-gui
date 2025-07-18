const path = require("path");
const fs = require("fs").promises;
exports.fs = fs;

const readConnectionsFromFile = async () => {
    const filePath = path.join(__dirname, "..", "config", "dbConnections.json");
    try {
        const data = await fs.readFile(filePath, "utf8");
        return JSON.parse(data).map((conn) => ({
            id: conn.id,
            username: conn.username,
            password: conn.password,
            host: conn.host,
            port: conn.port,
            dbType: conn.dbType,
            database: conn.database,
            status: conn.status || "Available",
        }));
    } catch (fileErr) {
        return [];
    }
};

// Helper function to save connections (reused by multiple functions)
const writeConnectionsToFile = async (connections) => {
    const filePath = path.join(__dirname, "..", "config", "dbConnections.json");
    await fs.writeFile(filePath, JSON.stringify(connections, null, 2), "utf8");
};


const getConnections = async (req, res) => {
    try {
        console.log("Fetching connections...");
        const connections = await readConnectionsFromFile();
        return res.status(200).json({ connections });
    } catch (err) {
        console.error("Error fetching connections:", err);
        return res.status(500).json({ error: "Error fetching connections" });
    }
};

const addConnection = async (req, res) => {
    try {
        const newConnection = req.body;

        if (!newConnection || !newConnection.username || !newConnection.host || !newConnection.dbType) {
            return res.status(400).json({ error: "Missing required connection details (username, host, dbType)" });
        }

        let connections = await readConnectionsFromFile();

        const isDuplicate = connections.some(conn =>
            conn.host === newConnection.host &&
            conn.port === newConnection.port &&
            conn.database === newConnection.database &&
            conn.username === newConnection.username
        );

        if (isDuplicate) {
            return res.status(409).json({ error: "Connection with these details already exists." });
        }

        connections.push({ ...newConnection, status: newConnection.status || "Available" });
        await writeConnectionsToFile(connections);

        console.log("Connection added:", newConnection);
        return res.status(201).json({ message: "Connection added successfully", connection: newConnection });
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
        connections[index] = { ...connections[index], ...updatedConnection };
        await writeConnectionsToFile(connections);

        console.log("Connection updated:", connections[index]);
        return res.status(200).json({ message: "Connection updated successfully", connection: connections[index] });
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

        console.log(idToDelete);
        console.log("Initial connections length:", initialLength);
        connections = connections.filter(conn => conn.id !== idToDelete);
        console.log("Filtered connections:", connections);

        if (connections.length === initialLength) {
            return res.status(404).json({ error: "Connection not found." });
        }

        await writeConnectionsToFile(connections);

        console.log("Connection deleted with ID:", id);
        return res.status(200).json({ message: "Connection deleted successfully" });
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

        await writeConnectionsToFile(connectionsToSave);

        console.log("Connections saved to file.");
        return res.status(200).json({ message: "Connections saved successfully" });
    } catch (err) {
        console.error("Error saving connections to file:", err);
        return res.status(500).json({ error: "Error saving connections" });
    }
};

module.exports = {
    getConnections,
    addConnection,
    editConnection,
    deleteConnection,
    saveConnections
};