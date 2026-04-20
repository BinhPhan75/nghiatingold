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
              text: "Trích xuất thông tin định danh từ thẻ Căn cước công dân (CCCD) Việt Nam hoặc ứng dụng VNeID. " +
                    "Các trường cần lấy: " +
                    "- id: Số CCCD (12 chữ số) " +
                    "- name: Họ và tên (chữ IN HOA) " +
                    "- dob: Ngày sinh (DD/MM/YYYY) " +
                    "- gender: Giới tính " +
                    "- address: Nơi thường trú/địa chỉ (với VNeID lấy ở dòng dưới cùng dưới ảnh thẻ). " +
                    "- cardType: 'NEW' (thẻ gắn chip) hoặc 'OLD' (thẻ mã vạch/VNeID). " +
                    "Kết quả trả về định dạng JSON máy đọc được. CHỈ TRẢ VỀ JSON."
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
