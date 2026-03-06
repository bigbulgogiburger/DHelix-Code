# AcmeDB FAQ

## What is the maximum data size AcmeDB can handle?

AcmeDB supports unlimited data size through its sharding capabilities. This allows you to distribute data across multiple nodes, ensuring scalability and high availability.

## What data types does AcmeDB support?

AcmeDB supports a wide range of data types, including:
- String
- Number
- Boolean
- Date
- Array
- Object
- Binary

## How can I back up my AcmeDB data?

Backing up your data is straightforward with AcmeDB. Use the following command to create a backup:

```bash
acmedb backup --output file.bak
```

This command will generate a backup file that you can store securely.

## How can I tune AcmeDB for better performance?

Performance tuning in AcmeDB can be achieved by adjusting the following configurations:
- `cache_size`: Increase this to allow more data to be cached in memory.
- `worker_threads`: Adjust the number of worker threads to optimize CPU usage.

## How does AcmeDB compare to PostgreSQL?

While both AcmeDB and PostgreSQL are powerful databases, AcmeDB offers a more flexible schema design and built-in sharding, making it ideal for distributed systems. PostgreSQL, on the other hand, is known for its robust SQL compliance and extensive feature set.