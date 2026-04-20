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
              text: "Trích xuất thông tin văn bản từ BỀ MẶT THẺ Căn cước công dân (CCCD) Việt Nam. BỎ QUA việc quét mã QR ở góc thẻ (mã QR chỉ dùng cho máy quét vật lý). Hãy tập trung vào việc đọc chữ in trên mặt trước thẻ. Trích xuất các trường: id (số thẻ - 12 chữ số), name (họ tên), dob (ngày sinh), gender (giới tính), address (nơi thường trú). Trả về JSON chính xác. Nếu không thấy trường nào hãy để trống. Chú ý: Họ tên thường viết hoa đậm."
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
