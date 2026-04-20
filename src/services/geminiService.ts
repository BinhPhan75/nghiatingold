import { GoogleGenAI, Type } from "@google/genai";
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
            { text: `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp thẻ Căn cước công dân (CCCD) Việt Nam.
                     YÊU CẦU:
                     1. Phân loại "cardType": OLD (mã vạch), NEW (gắn chip), ELECTRONIC (VNeID).
                     2. Trích xuất CỰC KỲ CHÍNH XÁC: id (12 số), name (In hoa có dấu), dob (DD/MM/YYYY), address (Nơi thường trú).
                     3. QUY TẮC THẺ CŨ (OLD):
                        - "Số / No": -> id
                        - "Họ và tên / Full name": -> name
                        - "Ngày sinh / Date of birth": -> dob
                        - "Quê quán / Place of birth": -> address (Nếu địa chỉ mờ)
                        - "Nơi thường trú / Place of residence": -> address
                     4. Nếu bất kỳ trường nào mờ, hãy dùng kiến thức về địa danh Việt Nam để khôi phục (ví dụ: "Thanh Hoá", "Hà Nội").
                     5. Trả về JSON theo đúng schema.` },
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
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["id", "name", "dob", "address", "cardType", "side"],
          properties: {
            id: { type: Type.STRING, description: "ID số thẻ" },
            name: { type: Type.STRING, description: "Họ và tên viết hoa" },
            dob: { type: Type.STRING, description: "Ngày sinh DD/MM/YYYY" },
            address: { type: Type.STRING, description: "Nơi thường trú hoặc quê quán" },
            cardType: { type: Type.STRING, enum: ["OLD", "NEW", "ELECTRONIC"] },
            side: { type: Type.STRING, enum: ["FRONT", "BACK", "ALL"] },
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
