# AcmeDB API Reference

## Connecting to AcmeDB

To connect to an AcmeDB instance, use the following method:

```javascript
acmedb.connect({
  host: 'localhost',
  port: 5432,
  auth: { user: 'admin', password: 'secret' }
});
```

## Creating Collections

Collections in AcmeDB are akin to tables in traditional databases. Create a collection with:

```javascript
db.createCollection('users', {
  name: 'string',
  age: 'number',
  email: 'string'
});
```

## CRUD Operations

- **Insert**:
  ```javascript
  db.users.insert({ name: 'John Doe', age: 30, email: 'john@example.com' });
  ```

- **Find**:
  ```javascript
  db.users.find({ age: { $gt: 25 } });
  ```

- **Update**:
  ```javascript
  db.users.update({ name: 'John Doe' }, { $set: { age: 31 } });
  ```

- **Delete**:
  ```javascript
  db.users.delete({ age: { $lt: 20 } });
  ```

## Indexing

Improve query performance by creating indexes:

```javascript
db.createIndex('users', ['email']);
```

## Transactions

AcmeDB supports transactions for atomic operations:

```javascript
db.transaction(async (tx) => {
  await tx.users.insert({ name: 'Alice' });
  await tx.users.update({ name: 'Alice' }, { $set: { age: 28 } });
});
```