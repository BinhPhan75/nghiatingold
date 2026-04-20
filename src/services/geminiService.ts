import { GoogleGenAI, Type } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDInfo | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: "Trích xuất thông tin từ thẻ Căn cước Việt Nam hoặc giao diện Căn cước điện tử (VNeID). Lưu ý: Với Căn cước điện tử, số ID và Họ tên nằm trên hình thẻ, nhưng 'Nơi thường trú' (địa chỉ) thường nằm ở danh sách văn bản phía dưới hình thẻ. Hãy đọc toàn bộ hình ảnh để lấy đủ: id (số thẻ), name (họ tên), dob (ngày sinh), gender (giới tính), address (địa chỉ/nơi thường trú), cardType ('OLD' hoặc 'NEW'). Trả về JSON."
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
            cardType: { type: Type.STRING, enum: ["OLD", "NEW", "UNKNOWN"] }
          },
          required: ["id", "name", "cardType"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    if (result.id && result.name) {
      return {
        id: result.id,
        name: result.name,
        dob: result.dob || '',
        gender: result.gender || '',
        address: result.address || '',
        cardType: result.cardType
      };
    }
    return null;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};
