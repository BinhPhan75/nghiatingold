import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
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
              text: "Đọc và bốc tách TOÀN BỘ thông tin từ mặt trước/sau thẻ CCCD Việt Nam hoặc VNeID. " +
                    "KHÔNG tìm mã QR, chỉ đọc chữ in trên thẻ. " +
                    "JSON: {id, name, dob, gender, address, cardType: 'OLD'|'NEW'}. " +
                    "VNeID: lấy địa chỉ bên dưới hình thẻ ảo. " +
                    "CHỈ TRẢ VỀ JSON."
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
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
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
