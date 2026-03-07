# AcmeDB FAQ

## What is the maximum data size AcmeDB can handle?

AcmeDB supports unlimited data size through its sharding capabilities. This allows you to distribute data across multiple nodes, ensuring scalability and performance.

## What data types does AcmeDB support?

AcmeDB supports a variety of data types including:
- String
- Number
- Boolean
- Date
- Array
- Object
- Binary

## How can I back up my AcmeDB data?

You can back up your data using the following command:

```bash
acmedb backup --output file.bak
```

This will create a backup file that you can restore later.

## How can I tune AcmeDB for better performance?

Performance tuning can be achieved by adjusting the following configurations in your `config.yml`:
- `cache_size`: Increase this to allow more data to be cached in memory.
- `worker_threads`: Adjust the number of worker threads to optimize CPU usage.

## How does AcmeDB compare to PostgreSQL?

AcmeDB is designed for high performance and scalability, similar to PostgreSQL. However, AcmeDB offers more flexible sharding and indexing options, making it ideal for large-scale applications. Additionally, AcmeDB's API is designed to be more intuitive for developers familiar with JavaScript.