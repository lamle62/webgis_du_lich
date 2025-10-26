const pool = require('./db');

const Place = {
  getAll: async () => {
    console.log('Fetching all places');
    try {
      const result = await pool.query(`
        SELECT id, name, type, province, description, 
               ST_AsGeoJSON(geom)::json AS geometry
        FROM places
      `);
      console.log('Places fetched:', result.rows);
      return result.rows;
    } catch (error) {
      console.error('Error fetching places:', error);
      throw error;
    }
  },

  filter: async (type, province) => {
    console.log('Filtering places:', { type, province });
    try {
      let query = `
        SELECT id, name, type, province, description,
               ST_AsGeoJSON(geom)::json AS geometry
        FROM places WHERE 1=1
      `;
      const values = [];
      if (type) {
        values.push(type.trim().toLowerCase());
        query += ` AND LOWER(type) = $${values.length}`;
      }
      if (province) {
        values.push(`%${normalizeProvince(province)}%`);
        query += ` AND province ILIKE $${values.length}`;
      }
      const result = await pool.query(query, values);
      console.log('Filtered places:', result.rows);
      return result.rows;
    } catch (error) {
      console.error('Error filtering places:', error);
      throw error;
    }
  },

  getByIds: async (ids) => {
    console.log('Fetching places by IDs:', ids);
    try {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        console.log('No valid place IDs provided');
        return [];
      }
      const result = await pool.query(
        `
        SELECT id, name, type, province, description,
               ST_X(geom) AS lng, ST_Y(geom) AS lat
        FROM places WHERE id = ANY($1)
        `,
        [ids]
      );
      const places = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        province: row.province,
        description: row.description,
        lng: row.lng,
        lat: row.lat
      }));
      console.log('Places fetched by IDs:', places);
      return places;
    } catch (error) {
      console.error('Error fetching places by IDs:', error);
      throw error;
    }
  },

  getGeoJSON: async () => {
    console.log('Fetching places for GeoJSON');
    try {
      const result = await pool.query(
        `
        SELECT id, name, type, province, description,
               ST_X(geom) AS lng, ST_Y(geom) AS lat
        FROM places
        `
      );
      const features = result.rows.map(row => ({
        type: 'Feature',
        properties: {
          id: row.id,
          name: row.name,
          type: row.type,
          province: row.province,
          description: row.description
        },
        geometry: {
          type: 'Point',
          coordinates: [row.lng, row.lat]
        }
      }));
      console.log('GeoJSON features:', features);
      return {
        type: 'FeatureCollection',
        features
      };
    } catch (error) {
      console.error('Error fetching GeoJSON:', error);
      throw error;
    }
  }
};

module.exports = Place;