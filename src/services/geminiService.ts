import { GoogleGenAI, Type } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDInfo | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            {
              text: "Bạn là chuyên gia bốc tách dữ liệu từ Căn cước Việt Nam. Hãy đọc hình ảnh (thẻ vật lý hoặc app VNeID) để trích xuất: id (số CCCD), name (Họ tên), dob (Ngày sinh), gender (Giới tính), address (Địa chỉ/Nơi thường trú), cardType ('OLD' hoặc 'NEW'). Đối với VNeID, địa chỉ nằm ở danh mục văn bản phía dưới hình thẻ. Trả về JSON."
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
            cardType: { type: Type.STRING }
          }
        }
      }
    });

    console.log("AI Raw Content:", response.text);
    const result = JSON.parse(response.text || '{}');
    
    if (result.id || result.name) {
      return {
        id: result.id || '',
        name: result.name || '',
        dob: result.dob || '',
        gender: result.gender || '',
        address: result.address || '',
        cardType: result.cardType as any
      };
    }
    return null;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return null;
  }
};
