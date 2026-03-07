# AcmeDB API Reference

## Connecting to AcmeDB

To connect to an AcmeDB instance, use the following method:

```javascript
acmedb.connect({ host: 'localhost', port: 5432, auth: { user: 'admin', password: 'secret' } });
```

## Creating Collections

To create a new collection in the database, use:

```javascript
db.createCollection('users', { name: 'string', age: 'number' });
```

## CRUD Operations

### Insert

```javascript
db.collection('users').insert({ name: 'John Doe', age: 30 });
```

### Find

```javascript
db.collection('users').find({ age: { $gt: 25 } });
```

### Update

```javascript
db.collection('users').update({ name: 'John Doe' }, { $set: { age: 31 } });
```

### Delete

```javascript
db.collection('users').delete({ name: 'John Doe' });
```

## Indexing

To create an index on a collection:

```javascript
db.createIndex('users', { age: 1 });
```

## Transactions

AcmeDB supports transactions. Here's an example:

```javascript
db.transaction(async (tx) => {
  await tx.collection('users').insert({ name: 'Jane Doe', age: 28 });
  await tx.collection('users').update({ name: 'Jane Doe' }, { $set: { age: 29 } });
});
```