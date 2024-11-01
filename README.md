[![npm version](https://img.shields.io/npm/v/mysql-gui.svg?color=success)](https://www.npmjs.com/package/mysql-gui)
[![GitHub stars](https://img.shields.io/github/stars/kshashikumar/mysql-gui.svg?style=social)](https://github.com/kshashikumar/mysql-gui/stargazers)

# MYSQL GUI

**MYSQL GUI** is a web-based Graphical User Interface designed to streamline database management and accelerate development workflows for MySQL, with planned future support for all major relational databases. This tool enhances user interaction with databases, allowing developers to manage data more efficiently.

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

## Prerequisites

- **Node.js 8.0.0 or above**  
  Install Node.js from the [official downloads page](https://nodejs.org/). Alternatively, manage versions dynamically with tools like nvm on macOS, Linux, or WSL.

- **npm 5.0.0 or above**  
  npm is bundled with Node.js. To upgrade, use:
  ```bash
  npm i -g npm
  ```
- **MYSQL Server**
  A running MySQL server instance

## Installation

MYSQL GUI can be installed in multiple ways:

### From npm

1. Install globally:
   ```bash
   npm install -g mysql-gui
   ```
2. Run the application:
   ```bash
   mysql-gui
   ```

### From npm

1. Clone the repository:
   ```bash
   git clone https://github.com/kshashikumar/mysql-gui.git
   ```
2. Navigate into the directory:
   ```bash
   cd mysql-gui
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

You can run MYSQL GUI using Docker for easy setup and deployment. Follow the steps below to get started:

### Running with Docker Compose

To run MYSQL GUI with Docker Compose, use the following `docker-compose.yml` file:

```yaml
version: "3"

services:
  mysql-gui:
    container_name: "mysql-gui"
    image: shashikumarkasturi/mysql-gui
    restart: always
    ports:
      - "5000:5000"
    environment:
      - MYSQL_URL=mysql://root:root@host.docker.internal:3306
```

### Steps to Run

1. Create a `docker-compose.yml` file in your project directory and paste the configuration above.
2. Start the container using the following command:

```bash
docker-compose up -d
```

This command will start MYSQL GUI in detached mode, running in the background. 3. Once the container is running, open your browser and navigate to <http://localhost:5000> to use MYSQL GUI. 4. To stop the container, run:

```bash
docker-compose down
```

### Environment Variables

- **MYSQL_URL**: Replace mysql://root:root@host.docker.internal:3306 with the URL of your MySQL database if it's hosted elsewhere or has different credentials.

## Usage

By default, MYSQL GUI launches with the following configuration:

- **Database URL (-u)**: `mysql://root:root@localhost:3306`
- **Port (-p)**: `5000`

The app will be accessible at `http://localhost:5000`.

To connect to a different MySQL server, specify the database URL as follows:

```bash
mysql-gui -u mysql://<username>:<password>@<host>:<dbport>
```

### Options

- **-u**: Specify the database URL to connect to a MySQL instance.
- **-p**: Port number for MYSQL GUI to listen on

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
- **Backend Modularization**: Improved architecture for easier maintenance and scaling.
- **Dynamic Filtering**: Filter data directly within result grids.
- **Result Limit Options**: Control the number of records displayed.

## Contributions

MYSQL GUI is open for **contributions**! If you have ideas for features, improvements, or bug fixes, feel free to submit a pull request or open an issue.

## Demo

![MYSQL-GUI](assets/mysql-gui-gif.gif)

## License

MYSQL GUI is distributed under the [MIT License](LICENSE). This license permits commercial use, modification, distribution, and private use, with the requirement to include the original copyright and license notice.
