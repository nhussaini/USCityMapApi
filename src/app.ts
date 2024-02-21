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
  try {
    const client = await pool.connect();
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
  }
});
//apis to get stat data
app.get('/state', async (req: Request, res: Response) => {
  try {
    const client = await pool.connect();
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
    const finalResult = uniqueStates
      .map((item) => {
        return {
          id: item.state_id,
          state: item.state_name,
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    res.status(200).json(finalResult);
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).send('Internal Server Error');
  }
});

export default app;
