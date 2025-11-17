const pool = require("./db");
const bcrypt = require("bcryptjs");

exports.createUser = async (
  username,
  password,
  email,
  phone,
  role = "user"
) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, password, email, phone, role) 
     VALUES ($1, $2, $3, $4, $5)`,
    [username, hashedPassword, email, phone, role]
  );
};

exports.findUserByUsername = async (username) => {
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  return result.rows[0];
};

exports.findUserByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0];
};
