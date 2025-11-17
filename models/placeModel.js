const pool = require("./db");

const Place = {};

// ==========================
// ⭐ 1. Lấy chi tiết 1 địa điểm
// ==========================
Place.getById = async (id) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, type, province, image_url,
             address, description, rating, price, parking,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM places
      WHERE id = $1
      LIMIT 1
    `,
      [id]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("❌ Error getById:", error);
    throw error;
  }
};

// ==========================
// ⭐ 2. Nearby – địa điểm gần đó (meters)
// ==========================
Place.getNearby = async (id, distanceMeters = 3000) => {
  try {
    const center = await pool.query(`SELECT geom FROM places WHERE id = $1`, [
      id,
    ]);

    if (center.rows.length === 0) return [];

    const result = await pool.query(
      `
      SELECT id, name, type, province, address, image_url,
             ST_AsGeoJSON(geom)::json AS geometry,
             ST_DistanceSphere(geom, $1) AS distance
      FROM places
      WHERE id != $2
        AND ST_DistanceSphere(geom, $1) < $3
      ORDER BY distance ASC
      LIMIT 15
    `,
      [center.rows[0].geom, id, distanceMeters]
    );

    return result.rows;
  } catch (error) {
    console.error("❌ Error getNearby:", error);
    throw error;
  }
};

// ==========================
// ⭐ 3. Bộ lọc nâng cao
// ==========================
Place.filter = async ({
  type,
  province,
  district,
  ward,
  minRating,
  maxPrice,
  parking,
}) => {
  try {
    let query = `
      SELECT id, name, type, province,
             address, description, rating, price, parking,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM places
      WHERE 1 = 1
    `;

    const values = [];
    let i = 1;

    if (type) {
      query += ` AND LOWER(type) = LOWER($${i++})`;
      values.push(type);
    }

    if (province) {
      query += ` AND province ILIKE $${i++}`;
      values.push(`%${province}%`);
    }

    if (district) {
      query += ` AND district ILIKE $${i++}`;
      values.push(`%${district}%`);
    }

    if (ward) {
      query += ` AND ward ILIKE $${i++}`;
      values.push(`%${ward}%`);
    }

    if (minRating) {
      query += ` AND rating >= $${i++}`;
      values.push(minRating);
    }

    if (maxPrice) {
      query += ` AND price <= $${i++}`;
      values.push(maxPrice);
    }

    if (parking === "true") {
      query += ` AND parking = TRUE`;
    }

    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error("❌ Error filter advanced:", error);
    throw error;
  }
};

// ==========================
// ⭐ 4. Lấy tất cả địa điểm
// ==========================
Place.getAll = async () => {
  try {
    const result = await pool.query(`
      SELECT id, name, type, province, image_url,
             address, description, rating, price, parking,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM places
      ORDER BY id ASC
    `);
    return result.rows;
  } catch (error) {
    console.error("❌ Error getAll:", error);
    throw error;
  }
};

// ==========================
// ⭐ 5. Trả GeoJSON
// ==========================
Place.getGeoJSON = async () => {
  try {
    const result = await pool.query(`
      SELECT id, name, type, province,
             address, description, rating, price, parking,
             ST_AsGeoJSON(geom)::json AS geometry
      FROM places
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map((r) => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          id: r.id,
          name: r.name,
          type: r.type,
          province: r.province,
          address: r.address,
          description: r.description,
          rating: r.rating,
          price: r.price,
          parking: r.parking,
        },
      })),
    };

    return geojson;
  } catch (error) {
    console.error("❌ Error getGeoJSON:", error);
    throw error;
  }
};

module.exports = Place;
