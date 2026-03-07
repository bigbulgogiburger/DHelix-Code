# AcmeDB Installation Guide

## System Requirements
- **Operating Systems**: Linux, macOS
- **Memory**: Minimum 4GB RAM
- **Node.js**: Version 18 or higher

## Installation via npm
To install AcmeDB globally on your system, use the following command:
```bash
npm install -g acmedb
```

## Configuration File
The configuration file for AcmeDB is located at `~/.acmedb/config.yml`. Ensure this file is properly set up before starting the server.

## First-Time Setup
1. Install AcmeDB using npm.
2. Configure your settings in `~/.acmedb/config.yml`.
3. Initialize the database with the following command:
   ```bash
   acmedb init
   ```

## Starting the Server
To start the AcmeDB server, run:
```bash
acmedb start --port 5432
```
This will start the server on port 5432. You can change the port by modifying the command.