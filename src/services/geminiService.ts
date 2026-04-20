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
              text: "Trích xuất thông tin từ thẻ Căn cước công dân (CCCD) hoặc Thẻ Căn cước (mẫu mới 2024) của Việt Nam. Hệ thống hiện đang hỗ trợ song song cả 2 mẫu thẻ này. Lưu ý: Mẫu mới 2024 có thể có địa chỉ và mã QR ở mặt sau. Hãy trích xuất các trường: id (số thẻ), name (họ tên), dob (ngày sinh), gender (giới tính), address (địa chỉ/nơi cư trú). Trả về JSON chính xác, không giải thích."
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
            address: { type: Type.STRING }
          },
          required: ["id", "name"]
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
