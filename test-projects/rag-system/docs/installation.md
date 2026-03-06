# AcmeDB Installation Guide

## System Requirements

To install and run AcmeDB, ensure your system meets the following requirements:

- **Operating System**: Linux or macOS
- **Memory**: Minimum 4GB RAM
- **Node.js**: Version 18 or higher

## Installation via npm

To install AcmeDB globally on your system, use the following npm command:

```bash
npm install -g acmedb
```

## Configuration File

After installation, the configuration file for AcmeDB is located at:

```
~/.acmedb/config.yml
```

You can modify this file to adjust settings such as database paths, cache sizes, and more.

## First-Time Setup

1. **Initialize the Database**: Run the following command to set up the initial database structure:
   ```bash
   acmedb init
   ```

2. **Configure Settings**: Edit the `config.yml` file to suit your environment and performance needs.

3. **Create Admin User**: Set up an admin user for managing your database:
   ```bash
   acmedb create-user --admin
   ```

## Starting the Server

To start the AcmeDB server, execute the following command:

```bash
acmedb start --port 5432
```

This will start the server on port 5432, ready to accept connections.