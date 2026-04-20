import { GoogleGenAI, Type } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

// Initialize Gemini on the frontend as per system instructions
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface CCCDAnalysisResult extends CCCDInfo {
  cardType: 'OLD' | 'NEW' | 'ELECTRONIC';
  side: 'FRONT' | 'BACK' | 'ALL';
}

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDAnalysisResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp thẻ Căn cước công dân (CCCD) Việt Nam hoặc Căn cước điện tử (VNeID).

PHÂN LOẠI THẺ:
1. "OLD": Thẻ ghi "CĂN CƯỚC CÔNG DÂN" (Mẫu cũ). Mọi thông tin ở mặt trước.
2. "NEW": Thẻ ghi "CĂN CƯỚC" (Mẫu mới sau 1/7/2024). Mặt trước chỉ có Tên, Số ID. Mặt sau mới có Địa chỉ.
3. "ELECTRONIC": Ứng dụng VNeID (ghi "CĂN CƯỚC ĐIỆN TỬ"). Có đầy đủ thông tin trên 1 màn hình.

LƯU Ý QUAN TRỌNG:
1. BỎ QUA HOÀN TOÀN mã QR và mã vạch.
2. TRƯỜNG DỮ LIỆU:
   - id: Số định danh (12 chữ số).
   - name: Họ tên (Viết hoa, ví dụ: NGUYỄN VĂN A).
   - dob: Ngày sinh (DD/MM/YYYY).
   - gender: Giới tính (Nam/Nữ).
   - address: Nơi thường trú.
   - cardType: Phân loại ("OLD", "NEW", "ELECTRONIC").
   - side: Mặt thẻ ("FRONT", "BACK", "ALL"). Nếu là VNeID thì là "ALL".

3. TRẢ VỀ JSON: Chỉ trả về JSON duy nhất. Nếu không thấy trường nào, hãy để trống "".`
            },
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
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            dob: { type: Type.STRING },
            gender: { type: Type.STRING },
            address: { type: Type.STRING },
            cardType: { 
              type: Type.STRING, 
              enum: ["OLD", "NEW", "ELECTRONIC"] 
            },
            side: { 
              type: Type.STRING, 
              enum: ["FRONT", "BACK", "ALL"] 
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return null;

    const result = JSON.parse(resultText.trim());
    console.log("AI Analysis Result:", result);

    return {
      id: (result.id || '').replace(/\s/g, ''),
      name: (result.name || '').toUpperCase(),
      dob: result.dob || '',
      gender: result.gender || '',
      address: result.address || '',
      cardType: result.cardType || 'OLD',
      side: result.side || 'FRONT'
    };
  } catch (error: any) {
    console.error("AI Analysis Error (Client):", error);
    throw error;
  }
};
