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
              text: "Bạn là hệ thống nhận diện Căn cước Công dân / Thẻ Căn cước Việt Nam. Hãy bốc tách dữ liệu từ ảnh (thẻ vật lý hoặc app VNeID). \n\n" +
                    "Yêu cầu TRẢ VỀ JSON theo schema sau:\n" +
                    "{\n" +
                    "  \"id\": \"Số định danh 12 chữ số\",\n" +
                    "  \"name\": \"Họ và tên\",\n" +
                    "  \"dob\": \"Ngày sinh (DD/MM/YYYY)\",\n" +
                    "  \"gender\": \"Giới tính (Nam/Nữ)\",\n" +
                    "  \"address\": \"Địa chỉ thường trú (BẮT BUỘC nếu là mặt sau hoặc app VNeID)\",\n" +
                    "  \"cardType\": \"'NEW' nếu là mẫu 2024 hoặc VNeID, 'OLD' nếu là mẫu cũ\"\n" +
                    "}\n\n" +
                    "Lưu ý: Đối với VNeID, địa chỉ nằm ở danh mục văn bản phí dưới hình thẻ ảo. Nếu không thấy địa chỉ, hãy để trống trường address. CHỈ TRẢ VỀ JSON."
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

    console.log("AI Raw Response Text:", response.text);
    
    // Robust JSON cleaning
    let text = response.text || '{}';
    if (text.includes('```json')) {
      text = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      text = text.split('```')[1].split('```')[0].trim();
    }
    
    const result = JSON.parse(text);
    
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
