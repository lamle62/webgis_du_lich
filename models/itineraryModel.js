const pool = require('./db');

class Itinerary {
  static async create({ name, places, userId }) {
    try {
      console.log('Creating itinerary in DB:', { name, places, userId });
      // places giờ là mảng [{id: number, time: string}]
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Tạo lịch trình mới
        const itineraryResult = await client.query(
          'INSERT INTO itineraries (name, user_id) VALUES ($1, $2) RETURNING *',
          [name, userId]
        );
        const itinerary = itineraryResult.rows[0];

        // Thêm các địa điểm và thời gian vào itinerary_places
        if (places && places.length > 0) {
          for (const place of places) {
            await client.query(
              'INSERT INTO itinerary_places (itinerary_id, place_id, visit_time) VALUES ($1, $2, $3)',
              [itinerary.id, place.id, place.time || null]
            );
          }
        }

        await client.query('COMMIT');
        console.log('Itinerary saved to DB:', itinerary);
        return itinerary;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error saving itinerary to DB:', error.message);
      throw error;
    }
  }

  static async getById(id, userId) {
  try {
    console.log('Fetching itinerary from DB:', { id, userId });
    const itineraryResult = await pool.query(
      'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (itineraryResult.rows.length === 0) {
      console.log('No itinerary found for:', { id, userId });
      return null;
    }
    const itinerary = itineraryResult.rows[0];

    const placesResult = await pool.query(
      `
      SELECT p.id, p.name, p.type, p.province, p.description, 
             ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat, ip.visit_time
      FROM itinerary_places ip
      JOIN places p ON ip.place_id = p.id
      WHERE ip.itinerary_id = $1
      ORDER BY ip.visit_time ASC
      `,
      [id]
    );
    itinerary.places = placesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type,
      province: row.province,
      description: row.description,
      lng: row.lng,
      lat: row.lat,
      time: row.visit_time ? row.visit_time.toISOString() : null
    }));
    
    console.log('Itinerary fetched from DB:', itinerary);
    return itinerary;
  } catch (error) {
    console.error('Error fetching itinerary from DB:', error.message);
    throw error;
  }
}

  static async getAllByUser(userId) {
    try {
      console.log('Fetching all itineraries for user:', userId);
      const itineraryResult = await pool.query(
        'SELECT * FROM itineraries WHERE user_id = $1',
        [userId]
      );
      const itineraries = itineraryResult.rows;

      for (let itinerary of itineraries) {
        const placesResult = await pool.query(
          `
          SELECT p.id, p.name, p.type, p.province, p.description, 
                 ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat, ip.visit_time
          FROM itinerary_places ip
          JOIN places p ON ip.place_id = p.id
          WHERE ip.itinerary_id = $1
          `,
          [itinerary.id]
        );
        itinerary.places = placesResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          province: row.province,
          description: row.description,
          lng: row.lng,
          lat: row.lat,
          time: row.visit_time ? row.visit_time.toISOString() : null
        }));
      }
      console.log('Itineraries fetched for user:', itineraries);
      return itineraries;
    } catch (error) {
      console.error('Error fetching itineraries from DB:', error.message);
      throw error;
    }
  }

  static async update(id, { name, places }, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Cập nhật tên
    const itineraryResult = await client.query(
      'UPDATE itineraries SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name, id, userId]
    );
    if (itineraryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // LẤY DANH SÁCH ĐỊA ĐIỂM HIỆN TẠI TRƯỚC KHI XÓA
    const currentPlaces = await client.query(
      'SELECT place_id FROM itinerary_places WHERE itinerary_id = $1',
      [id]
    );
    const currentIds = currentPlaces.rows.map(row => row.place_id);

    // LẤY DANH SÁCH ĐỊA ĐIỂM MỚI TỪ FORM
    const newIds = places ? places.map(p => p.id) : [];

    // XÓA NHỮNG ĐỊA ĐIỂM KHÔNG CÒN TRONG DANH SÁCH MỚI
    const toDelete = currentIds.filter(id => !newIds.includes(id));
    if (toDelete.length > 0) {
      await client.query(
        'DELETE FROM itinerary_places WHERE itinerary_id = $1 AND place_id = ANY($2)',
        [id, toDelete]
      );
    }

    // THÊM NHỮNG ĐỊA ĐIỂM MỚI (HOẶC CẬP NHẬT THỜI GIAN)
    for (const place of places || []) {
      const existing = await client.query(
        'SELECT 1 FROM itinerary_places WHERE itinerary_id = $1 AND place_id = $2',
        [id, place.id]
      );

      if (existing.rows.length === 0) {
        // Thêm mới
        await client.query(
          'INSERT INTO itinerary_places (itinerary_id, place_id, visit_time) VALUES ($1, $2, $3)',
          [id, place.id, place.time || null]
        );
      } else {
        // Cập nhật thời gian (nếu có)
        await client.query(
          'UPDATE itinerary_places SET visit_time = $1 WHERE itinerary_id = $2 AND place_id = $3',
          [place.time || null, id, place.id]
        );
      }
    }

    await client.query('COMMIT');
    return itineraryResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in update:', error);
    throw error;
  } finally {
    client.release();
  }
}

  static async delete(id, userId) {
    try {
      console.log('Deleting itinerary from DB:', { id, userId });
      const result = await pool.query(
        'DELETE FROM itineraries WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, userId]
      );
      const success = result.rowCount > 0;
      console.log('Delete result:', { success, deleted: result.rows[0] });
      return success;
    } catch (error) {
      console.error('Error deleting itinerary from DB:', error.message);
      throw error;
    }
  }

  static async removePlace(id, placeId, userId) {
    try {
      console.log('Removing place from itinerary:', { id, placeId, userId });
      const itineraryResult = await pool.query(
        'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (itineraryResult.rows.length === 0) {
        console.log('No itinerary found for removing place:', { id, userId });
        return null;
      }
      const result = await pool.query(
        'DELETE FROM itinerary_places WHERE itinerary_id = $1 AND place_id = $2 RETURNING *',
        [id, placeId]
      );
      if (result.rowCount === 0) {
        console.log('No place found to remove:', { id, placeId });
        return null;
      }
      const placesResult = await pool.query(
        `
        SELECT p.id, p.name, p.type, p.province, p.description, 
               ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat, ip.visit_time
        FROM itinerary_places ip
        JOIN places p ON ip.place_id = p.id
        WHERE ip.itinerary_id = $1
        `,
        [id]
      );
      const itinerary = itineraryResult.rows[0];
      itinerary.places = placesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        province: row.province,
        description: row.description,
        lng: row.lng,
        lat: row.lat,
        time: row.visit_time ? row.visit_time.toISOString() : null
      }));
      console.log('Place removed from itinerary:', itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error removing place from itinerary:', error.message);
      throw error;
    }
  }
}

module.exports = Itinerary;