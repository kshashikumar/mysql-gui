<img src="assets/dbfuse-ai-logo.png" width=75 height=75 align=left />

# DBFuse

[![npm version](https://img.shields.io/npm/v/dbfuse-ai.svg?color=success)](https://www.npmjs.com/package/dbfuse-ai)
[![Known Vulnerabilities](https://snyk.io/test/github/kshashikumar/dbfuse-ai/badge.svg)](https://snyk.io/test/github/kshashikumar/dbfuse-ai)
[![GitHub stars](https://img.shields.io/github/stars/kshashikumar/dbfuse-ai.svg?style=social)](https://github.com/kshashikumar/dbfuse-ai/stargazers)


**DBFuse** is a web-based Graphical User Interface designed to streamline database management and accelerate development workflows for MySQL, with planned future support for all major relational databases. This tool enhances user interaction with databases, allowing developers to manage data more efficiently.

## Features

- **Connect to Local/Remote Databases**  
  Easily connect to databases on your local machine or remote servers.
- **CRUD Operations**  
  Perform Create, Read, Update, and Delete actions on databases and tables.

- **Multi-Tab Support**  
  Work across multiple databases or queries simultaneously, with a smooth and responsive interface.

- **Query Editor with Autocompletion**  
  Write queries faster with intelligent autocompletion and syntax highlighting.

- **Improved Pagination**  
  Navigate large datasets with optimized pagination.

- **Rich User Interface**  
  A dynamic and user-friendly interface designed to enhance productivity.

- **Dynamic Result Grid**  
  Visualize query results with a responsive, grid-based layout.

- **Basic Authentication**  
  Optional authentication for added security when running on remote servers.

- **Clipboard Copy**  
  Quickly copy cell data with a single click.

- **AI Integration**  
  Leverage OpenAI and Google Gemini for generating intelligent SQL queries. Talk to your selected Database

## Prerequisites

- **Node.js 16.0.0 or above**  
  Install Node.js from the [official downloads page](https://nodejs.org/). Alternatively, manage versions dynamically with tools like nvm on macOS, Linux, or WSL.

- **npm 8.0.0 or above**  
  npm is bundled with Node.js. To upgrade, use:
  ```bash
  npm i -g npm
  ```
- **MYSQL Server**
  A running MySQL server instance

## Installation

DBFuse AI can be installed in multiple ways:

### From npm

1. Install globally:
   ```bash
   npm install -g dbfuse-ai
   ```
2. Run the application:
   ```bash
   dbfuse-ai
   ```

### From npm

1. Clone the repository:
   ```bash
   git clone https://github.com/kshashikumar/dbfuse-ai.git
   ```
2. Navigate into the directory:
   ```bash
   cd dbfuse-ai
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm run start
   ```

### From Docker Hub

You can run DBFuse AI using Docker for easy setup and deployment. Follow the steps below to get started:

### Running with Docker Compose

To run DBFuse AI with Docker Compose, use the following `docker-compose.yml` file:

```yaml
version: "3"

services:
  dbfuse-ai:
    container_name: "dbfuse-ai"
    image: shashikumarkasturi/dbfuse-ai
    restart: always
    ports:
      - "5000:5000"
    environment:
      - MYSQL_URL=mysql://root:root@host.docker.internal:3306
      - AI_MODEL=<Model Name> #gpt-4, gpt-3.5-turbo, text-davinci-003, gemini-1.5-flash, gemini-pro, gemini-lite
      - AI_API_KEY=<API Key>
```

### Steps to Run

1. Create a `docker-compose.yml` file in your project directory and paste the configuration above.
2. Start the container using the following command:

```bash
docker-compose up -d
```

This command will start DBFuse AI in detached mode, running in the background. 3. Once the container is running, open your browser and navigate to <http://localhost:5000> to use DBFuse. 4. To stop the container, run:

```bash
docker-compose down
```

## AI Integration

DBFuse AI integrates OpenAI and Google Gemini to generate intelligent SQL queries with the following features:

### Setting Up AI Integration

To enable AI-powered prompt querying, you need to set up the API keys for OpenAI or Google Gemini:

1. **Obtain an API Key**
   - For OpenAI: Visit OpenAI's platform and generate an API key.
   - For Google Gemini: Follow Google's platform to obtain an API key (free tier provides 15 requests per minute).
2. **Add the API Key to Your Environment Variables**
   In the root directory of your project, create a .env file (or update it if it exists) and add the following lines:

```bash
AI_MODEL=<MODEL_NAME>  # e.g., gpt-4 or gemini-1.5-flash
AI_API_KEY=<YOUR_API_KEY>
```

3. **Restart DBFuse**
   Restart the application to activate AI integration.

### Using AI Prompt Querying

- Enable AI from the user interface using the AI toggle button.
- Write a natural language query in the input box and click on AI Prompt button, AI will generate the corresponding SQL query.
- The AI can join tables, generate aggregated queries, and suggest optimal SQL syntax based on the database you selected.

**Example Workflow:**

1. Write a query prompt:
   `Find the average salary of employees in each department.`
2. The AI generates the SQL:

```bash
SELECT Department, AVG(Salary) AS AvgSalary FROM employeerecords GROUP BY Department;
```

## Security Note

- Confidentiality: Never expose your .env file containing the API key.
- **Secure Connections**: Ensure your MySQL connections and API keys are used securely, especially in production.

### Environment Variables

- **MYSQL_URL**: Replace `mysql://root:root@host.docker.internal:3306` with the URL of your MySQL database if it's hosted elsewhere or has different credentials.

## Usage

By default, DBFuse AI launches with the following configuration:

- **Database URL (-u)**: `mysql://root:root@localhost:3306`
- **Port (-p)**: `5000`

The app will be accessible at `http://localhost:5000`.

### Options

- **-u**: Specify the database URL to connect to a MySQL instance.
- **-p**: Port number for DBFuse AI to listen on
- **--model**: Specify the AI model to be used
  `(supporting model: gpt-4, gpt-3.5-turbo, text-davinci-003, gemini-1.5-flash, gemini-pro, gemini-lite)`
- **--apikey**: Specify the API key for the chosen AI model.

## Basic Authentication (Optional)

Protect data with basic authentication when running on remote servers.

1. Create a `.env` file in the root directory.
2. Add the following variables

```bash
USERNAME=<your_username>
PASSWORD=<your_password>
```

3. Restart the server.

To disable authentication, comment out or remove these variables from `.env` and restart the server.

## Upcoming Features

- **Multi-Relational DB Support**: PostgreSQL, MariaDB, SQLite3, Oracle, Amazon Redshift, and more.
- **Dynamic Filtering**: Filter data directly within result grids.
- **Result Limit Options**: Control the number of records displayed.
- **Enhanced AI Integration**: Leverage AI for complex query generation and analysis.

## Contributions

DBFuse AI is open for **contributions**! If you have ideas for features, improvements, or bug fixes, feel free to submit a pull request or open an issue.

## Demo

![dbfuse-ai](assets/dbfuse-gif.gif)
![dbfuse-ai](assets/dbfuse-ai-ai-gif.gif)

## License

DBFuse AI is distributed under the [MIT License](LICENSE). This license permits commercial use, modification, distribution, and private use, with the requirement to include the original copyright and license notice.
