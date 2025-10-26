const pool = require('./db');

class Itinerary {
  static async create({ name, places, userId }) {
    try {
      console.log('Creating itinerary in DB:', { name, places, userId });
      const result = await pool.query(
        'INSERT INTO itineraries (name, places, user_id) VALUES ($1, $2, $3) RETURNING *',
        [name, places, userId]
      );
      const itinerary = result.rows[0];
      console.log('Itinerary saved to DB:', itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error saving itinerary to DB:', error.message);
      throw error;
    }
  }

  static async getById(id, userId) {
    try {
      console.log('Fetching itinerary from DB:', { id, userId });
      const result = await pool.query(
        'SELECT * FROM itineraries WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (result.rows.length === 0) {
        console.log('No itinerary found for:', { id, userId });
        return null;
      }
      const itinerary = result.rows[0];
      if (itinerary.places && itinerary.places.length > 0) {
        const placesResult = await pool.query(
          'SELECT id, name, type, province, description, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM places WHERE id = ANY($1)',
          [itinerary.places]
        );
        itinerary.places = placesResult.rows;
      } else {
        itinerary.places = [];
      }
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
      const result = await pool.query(
        'SELECT * FROM itineraries WHERE user_id = $1',
        [userId]
      );
      const itineraries = result.rows;
      for (let itinerary of itineraries) {
        if (itinerary.places && itinerary.places.length > 0) {
          const placesResult = await pool.query(
            'SELECT id, name, type, province, description, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM places WHERE id = ANY($1)',
            [itinerary.places]
          );
          itinerary.places = placesResult.rows;
        } else {
          itinerary.places = [];
        }
      }
      console.log('Itineraries fetched for user:', itineraries);
      return itineraries;
    } catch (error) {
      console.error('Error fetching itineraries from DB:', error.message);
      throw error;
    }
  }

  static async update(id, { name, places }, userId) {
    try {
      console.log('Updating itinerary in DB:', { id, name, places, userId });
      const result = await pool.query(
        'UPDATE itineraries SET name = $1, places = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
        [name, places, id, userId]
      );
      if (result.rows.length === 0) {
        console.log('No itinerary found for update:', { id, userId });
        return null;
      }
      const itinerary = result.rows[0];
      if (itinerary.places && itinerary.places.length > 0) {
        const placesResult = await pool.query(
          'SELECT id, name, type, province, description, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM places WHERE id = ANY($1)',
          [itinerary.places]
        );
        itinerary.places = placesResult.rows;
      } else {
        itinerary.places = [];
      }
      console.log('Itinerary updated in DB:', itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error updating itinerary in DB:', error.message);
      throw error;
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
      const result = await pool.query(
        'UPDATE itineraries SET places = array_remove(places, $1) WHERE id = $2 AND user_id = $3 RETURNING *',
        [placeId, id, userId]
      );
      if (result.rows.length === 0) {
        console.log('No itinerary found for removing place:', { id, userId });
        return null;
      }
      const itinerary = result.rows[0];
      if (itinerary.places && itinerary.places.length > 0) {
        const placesResult = await pool.query(
          'SELECT id, name, type, province, description, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM places WHERE id = ANY($1)',
          [itinerary.places]
        );
        itinerary.places = placesResult.rows;
      } else {
        itinerary.places = [];
      }
      console.log('Place removed from itinerary:', itinerary);
      return itinerary;
    } catch (error) {
      console.error('Error removing place from itinerary:', error.message);
      throw error;
    }
  }
}

module.exports = Itinerary;