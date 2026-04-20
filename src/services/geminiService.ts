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
              text: "Trích xuất thông tin từ ảnh chụp thẻ Căn cước công dân (CCCD) hoặc Thẻ Căn cước của Việt Nam. Hệ thống hỗ trợ xử lý cả các mẫu thẻ gắn chip và mẫu mới nhất. Hãy tập trung trích xuất văn bản từ mặt trước của thẻ, bỏ qua mã QR. Cần các thông tin: id (số CCCD/Căn cước - 12 chữ số), name (họ tên - thường viết hoa), dob (ngày sinh), gender (giới tính), address (địa chỉ/nơi thường trú). Trả về kết quả dạng JSON chính xác. Chú ý: độ chính xác của Số thẻ và Họ tên là quan trọng nhất."
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
