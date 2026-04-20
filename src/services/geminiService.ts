import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

// Initialize AI globally but lazily
let ai: any = null;

const getAI = () => {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) console.error("GEMINI_API_KEY missing");
  ai = new GoogleGenAI({ apiKey: apiKey || '' });
  return ai;
};

export interface CCCDAnalysisResult extends CCCDInfo {
  cardType: 'OLD' | 'NEW' | 'ELECTRONIC';
  side: 'FRONT' | 'BACK' | 'ALL';
}

 export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDAnalysisResult | null> => {
  try {
    const client = getAI();
    
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: `NHIỆM VỤ: Trích xuất thông tin từ ảnh thẻ Căn cước Việt Nam.
                     YÊU CẦU:
                     - name: Họ tên In hoa có dấu.
                     - id: Số ID (12 số hoặc 9 số).
                     - dob: Ngày sinh.
                     - address: Nơi thường trú hoặc Quê quán.
                     - Trả về JSON, không giải thích.` },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(',')[1] || base64Image
              }
            }
          ]
        }
      ],
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["id", "name", "dob", "address"],
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            dob: { type: Type.STRING },
            address: { type: Type.STRING },
            cardType: { type: Type.STRING, enum: ["OLD", "NEW", "ELECTRONIC"], default: "OLD" },
            side: { type: Type.STRING, enum: ["FRONT", "BACK", "ALL"], default: "FRONT" },
            gender: { type: Type.STRING }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return null;

    const parsed = JSON.parse(resultText);
    return {
      id: (parsed.id || '').replace(/\s/g, ''),
      name: (parsed.name || '').toUpperCase(),
      dob: parsed.dob || '',
      gender: parsed.gender || '',
      address: parsed.address || '',
      cardType: parsed.cardType || 'OLD',
      side: parsed.side || 'FRONT'
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
