import express, { Request, Response } from 'express';

import { Pool } from 'pg';

import { parse } from 'pg-connection-string';

interface City {
  id: number;
  name: string;
}

// Parse connection string
const connectionString =
  'postgres://u71d53dbc3c528a482b7a1ef991aa357e:43a91fcc6e8a@SG-SharedPostgres-3990-pgsql-master.servers.mongodirector.com/b223b0c1c7933ee0bfe3d98f63f214ea';
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
      'SELECT id,city FROM uscitymapapi_us_cities_nasrullah'
    );
    const cities = result.rows.sort(
      (a: { city: string }, b: { city: string }) => a.city.localeCompare(b.city)
    );
    if (req.query.page_num && req.query.page_size) {
      const page = parseInt(req.query.page_num) || 1;
      console.log('page=>', page);
      const limit = parseInt(req.query.page_size) || 10;
      console.log('limit=>', limit);
      // const age = parseInt(req.query.age);
      const start = (page - 1) * limit;
      const end = start + limit;
      res.status(200).json(cities.slice(start, end));
    } else if (req.query.id) {
      const cityId = parseInt(req.query.id);
      const city = result.rows.filter((city: City) => city.id === cityId);
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

export default app;
