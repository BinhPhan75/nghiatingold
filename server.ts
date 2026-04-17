import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route to fetch SJC prices
  app.get('/api/gold-prices/sjc', async (req, res) => {
    try {
      const response = await axios.get('https://sjc.com.vn/xml/tygiavang.xml', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const parsedData = await parseStringPromise(response.data);
      
      // Navigate through SJC XML structure
      // Typically: ratelist -> city (e.g. HCM) -> item
      const cities = parsedData.ratelist.city;
      const hcmCity = cities.find((c: any) => c.$.name === 'Hồ Chí Minh') || cities[0];
      const items = hcmCity.item.map((i: any) => ({
        type: i.$.type,
        buy: i.$.buy,
        sell: i.$.sell
      }));

      res.json({
        updatedAt: parsedData.ratelist.updated,
        items
      });
    } catch (error) {
      console.error('Error fetching SJC prices:', error);
      res.status(500).json({ error: 'Failed to fetch SJC gold prices' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
