# AcmeDB API Reference

## Connecting to AcmeDB
To connect to AcmeDB, use the following method:
```javascript
acmedb.connect({ host: 'localhost', port: 5432, auth: { user: 'admin', password: 'secret' } });
```

## Creating Collections
Create a new collection with a specified schema:
```javascript
db.createCollection('users', { name: 'string', age: 'number' });
```

## CRUD Operations
- **Insert**: Add a new document to a collection.
  ```javascript
  db.collection('users').insert({ name: 'Alice', age: 30 });
  ```
- **Find**: Retrieve documents from a collection.
  ```javascript
  db.collection('users').find({ age: { $gt: 25 } });
  ```
- **Update**: Modify existing documents.
  ```javascript
  db.collection('users').update({ name: 'Alice' }, { $set: { age: 31 } });
  ```
- **Delete**: Remove documents from a collection.
  ```javascript
  db.collection('users').delete({ age: { $lt: 20 } });
  ```

## Indexing
Create an index on specified fields to improve query performance:
```javascript
db.createIndex('users', ['name', 'age']);
```

## Transactions
Perform multiple operations atomically:
```javascript
db.transaction(async (tx) => {
  await tx.collection('users').insert({ name: 'Bob', age: 25 });
  await tx.collection('orders').insert({ item: 'Book', quantity: 1 });
});
```