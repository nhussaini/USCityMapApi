import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import { parse } from 'pg-connection-string';
import dotenv from 'dotenv';
dotenv.config();

interface City {
  id: number;
  name: string;
}
interface ApiCity {
  id: number;
  city: string;
  state_id: string;
  state_name: string;
  lat: string;
  lng: string;
  population: number;
  timezone: string;
}
interface DbState {
  state_id: string;
  state_name: string;
}

// Parse connection string
const connectionString = process.env.DB_CONNECTION_STRING;
const config = parse(connectionString);

const pool = new Pool({
  ...config,
  port: parseInt(config.port as string), // Convert port to a number
  ssl: typeof config.ssl === 'string' ? true : config.ssl, // Set ssl to true if it's a string
});

const app = express();
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Welcome to SkillReactor!!!');
});

app.get('/city', async (req: Request, res: Response) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM uscitymapapi_us_cities_nasrullah'
    );
    const cities = result.rows
      .map((city: ApiCity) => {
        return { id: city.id, city: city.city };
      })
      .sort((a: { city: string }, b: { city: string }) =>
        a.city.localeCompare(b.city)
      );
    if (req.query.state_id) {
      const stateId = req.query.state_id;
      const filteredCities = result.rows
        .filter((city: ApiCity) => city.state_id === stateId)
        .map((city: ApiCity) => {
          return { id: city.id, city: city.city };
        });

      res.status(200).json(filteredCities);
    }
    if (req.query.page_num && req.query.page_size) {
      const page = parseInt(req.query.page_num) || 1;
      const limit = parseInt(req.query.page_size) || 10;
      const start = (page - 1) * limit;
      const end = start + limit;
      res.status(200).json(cities.slice(start, end));
    } else if (req.query.id) {
      const cityId = parseInt(req.query.id);
      const city = cities.filter((city: City) => city.id === cityId);
      res.status(200).json(city);
    } else {
      res.status(200).json(cities);
    }
    client.release();
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).send('Internal Server Error');
  } finally {
    if (client) {
      // Ensure the client is released back to the pool even if an error occurs
      client.release();
    }
  }
});
//apis to get stat data
app.get('/state', async (req: Request, res: Response) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'SELECT state_id, state_name FROM uscitymapapi_us_cities_nasrullah'
    );

    //keep one state from duplicates
    const uniqueStates: DbState[] = [];
    const stateIdSet = new Set();
    result.rows.forEach((item: DbState) => {
      if (!stateIdSet.has(item.state_id)) {
        uniqueStates.push(item);
        stateIdSet.add(item.state_id);
      }
    });
    //change state format and sort them based on id
    const sortedAndMappedStates = uniqueStates
      .map((item) => {
        return {
          id: item.state_id,
          state: item.state_name,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    //accept query params
    if (req.query.page_num && req.query.page_size) {
      const page = parseInt(req.query.page_num);
      const limit = parseInt(req.query.page_size);
      const start = (page - 1) * limit;
      const end = start + limit;
      return res.status(200).json(sortedAndMappedStates.slice(start, end));
    }
    //accepts id as query param
    if (req.query.id) {
      const id = req.query.id;
      const state = sortedAndMappedStates.filter((state) => state.id === id);
      return res.status(200).json(state);
    }
    return res.status(200).json(sortedAndMappedStates);
  } catch (err) {
    console.error('Error executing query', err);
    return res.status(500).send('Internal Server Error');
  } finally {
    if (client) {
      client.release();
    }
  }
});
//api to find nearest city
app.get('/city/find', async (req: Request, res: Response) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM uscitymapapi_us_cities_nasrullah'
    );
    if (req.query.lat && req.query.lng) {
      const lat = parseInt(req.query.lat);
      const lng = parseInt(req.query.lng);
      const city = result.rows.find(
        (city: ApiCity) =>
          parseInt(city.lat) === lat && parseInt(city.lng) === lng
      );
      if (!city) {
        return res.status(404).json({ error: 'City not found' });
      }
      let minDistance = Number.POSITIVE_INFINITY;
      let nearestCity: string;
      let nearstCityId: number;
      result.rows.forEach((dbCity: ApiCity) => {
        if (dbCity.id !== city.id) {
          const dx = city.lat - Number(dbCity.lat);
          const dy = city.lng - Number(dbCity.lng);
          // const dx = city.lat - parseFloat(dbCity.lat);
          // const dy = city.lng - parseFloat(dbCity.lng);
          const eucDistance = Math.sqrt(dx * dx + dy * dy);
          if (eucDistance < minDistance) {
            minDistance = eucDistance;
            nearestCity = dbCity.city;
            nearstCityId = dbCity.id;
          }
        }
      });
      const resultCity: City = {
        id: nearstCityId,
        name: nearestCity,
      };
      return res.status(200).json({ city: resultCity, distance: minDistance });
    }
  } catch (err) {
    console.error('Error executing query', err);
    return res.status(500).send('Internal Server Error');
  } finally {
    if (client) {
      client.release();
    }
  }
});

export default app;
