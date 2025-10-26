CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password VARCHAR(200)
);

CREATE TABLE places (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    type VARCHAR(50),
    city VARCHAR(100),
    geom GEOGRAPHY(Point, 4326)
);

CREATE TABLE itineraries (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    name VARCHAR(100),
    places INT[]
);

-- Insert dữ liệu mẫu
INSERT INTO places (name, type, city, geom)
VALUES ('Hồ Hoàn Kiếm', 'tourism', 'Hà Nội', ST_GeogFromText('SRID=4326;POINT(105.8542 21.0285)'));
