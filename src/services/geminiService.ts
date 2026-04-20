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
              text: "Trích xuất thông tin từ thẻ Căn cước Việt Nam. Hãy xác định loại thẻ: 'OLD' (nếu thẻ ghi 'Căn cước công dân') hoặc 'NEW' (nếu thẻ ghi 'Căn cước' - mẫu 2024). Trả về JSON với các trường: id (số thẻ), name (họ tên), dob (ngày sinh), gender (giới tính), address (địa chỉ/nơi cư trú), cardType ('OLD' hoặc 'NEW'). Nếu không thấy địa chỉ (thường gặp ở mặt trước thẻ 'NEW'), hãy để trống trường address. Chỉ trả về JSON."
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
        address: result.address || ''
      };
    }
    return null;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};
