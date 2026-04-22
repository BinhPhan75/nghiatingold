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
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            { text: `Extract info from Vietnam ID Card (CCCD or older CMND). 
                     Labels mapping: 
                     - id: trích xuất từ nhãn "Số" hoặc "No." (có thể 9 hoặc 12 số)
                     - name: trích xuất từ nhãn "Họ và tên" hoặc "Full name"
                     - dob: trích xuất từ nhãn "Ngày sinh" hoặc "Date of birth"
                     - address: trích xuất từ nhãn "Nơi thường trú" (ưu tiên) hoặc "Quê quán".
                     Return JSON format: {id, name, dob, address, cardType, side}.` },
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
          required: ["id", "name"],
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            dob: { type: Type.STRING },
            address: { type: Type.STRING },
            cardType: { type: Type.STRING, enum: ["OLD", "NEW", "ELECTRONIC"], default: "OLD" },
            side: { type: Type.STRING, enum: ["FRONT", "BACK", "ALL"], default: "FRONT" }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return null;

    // Robust JSON extraction from potential markdown blocks
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : resultText.trim();
    
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        id: (parsed.id || '').replace(/\s/g, ''),
        name: (parsed.name || '').toUpperCase(),
        dob: parsed.dob || '',
        gender: parsed.gender || '',
        address: parsed.address || '',
        cardType: parsed.cardType || 'OLD',
        side: parsed.side || 'FRONT'
      };
    } catch (e) {
      console.error("AI returned invalid JSON:", resultText);
      return null;
    }
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
