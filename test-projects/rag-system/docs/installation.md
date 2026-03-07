# AcmeDB Installation Guide

## System Requirements

To install and run AcmeDB, ensure your system meets the following requirements:

- **Operating System**: Linux or macOS
- **Memory**: Minimum 4GB RAM
- **Node.js**: Version 18 or higher

## Installation via npm

To install AcmeDB globally using npm, run the following command:

```bash
npm install -g acmedb
```

## Configuration File

After installation, the configuration file can be found at:

```
~/.acmedb/config.yml
```

This file contains default settings that you can customize according to your needs.

## First-Time Setup

1. Open the configuration file located at `~/.acmedb/config.yml`.
2. Set your desired configurations such as `port`, `data_directory`, and `log_level`.
3. Save the changes and close the file.

## Starting the Server

To start the AcmeDB server, use the following command:

```bash
acmedb start --port 5432
```

This will start the server on port 5432. You can change the port number by modifying the command accordingly.