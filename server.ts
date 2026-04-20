import express from 'express';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import * as cheerio from 'cheerio';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route to analyze CCCD using Gemini
  app.post('/api/analyze-cccd', async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: 'Image is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('GEMINI_API_KEY is not set on the server');
        return res.status(500).json({ error: 'AI Service configuration error' });
      }

      const genAI = new (GoogleGenAI as any)({ apiKey });
      const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

      const prompt = `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp MẶT TRƯỚC thẻ Căn cước công dân (CCCD) Việt Nam.
LƯU Ý QUAN TRỌNG:
1. BỎ QUA HOÀN TOÀN mã QR và mã vạch. Chỉ đọc thông tin bằng chữ và số in trên mặt thẻ.
2. TRƯỜNG DỮ LIỆU:
   - id: Số thẻ (12 chữ số).
   - name: Họ tên (Viết hoa toàn bộ, ví dụ: NGUYỄN VĂN A).
   - dob: Ngày tháng năm sinh (Định dạng: DD/MM/YYYY).
   - gender: Giới tính (Nam hoặc Nữ).
   - address: Nơi thường trú (Đầy đủ địa chỉ ghi trên thẻ).
3. TRẢ VỀ JSON: Chỉ trả về JSON duy nhất, không giải thích thêm. Nếu không thấy trường nào, hãy để trống "".`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: image.split(',')[1] || image,
            mimeType: 'image/jpeg'
          }
        }
      ]);

      const response = await result.response;
      const responseText = response.text();
      let jsonStr = responseText;
      
      if (responseText.includes('```')) {
        const match = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/```\n([\s\S]*?)\n```/);
        if (match) jsonStr = match[1];
      }

      try {
        const data = JSON.parse(jsonStr.trim());
        res.json(data);
      } catch (parseError) {
        console.error('Failed to parse AI JSON:', responseText);
        res.status(500).json({ error: 'Failed to parse AI response' });
      }
    } catch (error: any) {
      console.error('AI Analysis Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error during analysis' });
    }
  });

  // API Route to fetch SJC prices
  app.get('/api/gold-prices/sjc', async (req, res) => {
    try {
      // Primary source: SJC XML (Trying alternative paths)
      const urls = [
        'https://sjc.com.vn/xml/tygiavang.xml',
        'http://sjc.com.vn/xml/tygiavang.xml',
        'https://www.sjc.com.vn/xml/tygiavang.xml'
      ];
      
      let data: any = null;
      for (const url of urls) {
        try {
          const response = await axios.get(url, {
            timeout: 5000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Referer': 'https://sjc.com.vn/'
            }
          });
          if (response.data) {
            const parsedData = await parseStringPromise(response.data);
            const cities = parsedData.ratelist.city;
            const hcmCity = cities.find((c: any) => c.$.name === 'Hồ Chí Minh') || cities[0];
            data = {
              updatedAt: parsedData.ratelist.updated,
              items: hcmCity.item.map((i: any) => ({
                type: i.$.type,
                buy: i.$.buy,
                sell: i.$.sell
              }))
            };
            break;
          }
        } catch (e) {
          console.warn(`Failed to fetch from ${url}, trying next...`);
        }
      }

      // Final fallback: Scrape webgia.com if XML fails
      if (!data) {
        console.log('Falling back to webgia.com scraping...');
        const response = await axios.get('https://webgia.com/gia-vang/sjc/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const $ = cheerio.load(response.data);
        const items: any[] = [];
        
        // Find the main pricing table
        $('table tr').each((i, el) => {
          const cells = $(el).find('td');
          if (cells.length >= 3) {
            const type = $(cells[0]).text().trim();
            const buy = $(cells[1]).text().trim();
            const sell = $(cells[2]).text().trim();
            // Basic filter to ensure we are getting price rows
            if (buy.includes(',') || !isNaN(parseFloat(buy.replace(/\./g, '')))) {
               items.push({ type, buy, sell });
            }
          }
        });

        if (items.length > 0) {
          data = {
            updatedAt: 'Cập nhật từ webgia.com',
            items: items.slice(0, 15) // Limit to avoid noise
          };
        }
      }

      if (data) {
        res.json(data);
      } else {
        throw new Error('All gold price sources failed');
      }
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
