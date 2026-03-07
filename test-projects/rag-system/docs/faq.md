# AcmeDB FAQ

## What is the maximum data size AcmeDB can handle?
AcmeDB supports unlimited data size through its sharding capabilities, allowing horizontal scaling across multiple nodes.

## What data types does AcmeDB support?
AcmeDB supports a variety of data types including string, number, boolean, date, array, object, and binary.

## How can I back up my AcmeDB data?
Use the following command to back up your data:
```bash
acmedb backup --output file.bak
```
This will create a backup file named `file.bak`.

## How can I tune AcmeDB for better performance?
Performance can be improved by adjusting the `cache_size` and `worker_threads` settings in the configuration file.

## How does AcmeDB compare to PostgreSQL?
While both are powerful databases, AcmeDB is designed for high-performance and scalability with a focus on ease of use and modern features, whereas PostgreSQL is a well-established, feature-rich relational database.