const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'du_lich_1',
  password: '06022003',
  port: 5432
});

module.exports = pool;
