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
              text: `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp MẶT TRƯỚC thẻ Căn cước công dân (CCCD) Việt Nam.
LƯU Ý QUAN TRỌNG:
1. BỎ QUA HOÀN TOÀN mã QR và mã vạch. Chỉ đọc thông tin bằng chữ và số in trên mặt thẻ.
2. TRƯỜNG DỮ LIỆU:
   - id: Số thẻ (12 chữ số).
   - name: Họ tên (Viết hoa toàn bộ, ví dụ: NGUYỄN VĂN A).
   - dob: Ngày tháng năm sinh (Định dạng: DD/MM/YYYY).
   - gender: Giới tính (Nam hoặc Nữ).
   - address: Nơi thường trú (Đầy đủ địa chỉ ghi trên thẻ).
3. TRẢ VỀ JSON: Chỉ trả về JSON duy nhất, không giải thích thêm. Nếu không thấy trường nào, hãy để trống "".`
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
          }
        }
      }
    });

    const rawText = response.text || '{}';
    let jsonStr = rawText;
    
    if (rawText.includes('```')) {
      const match = rawText.match(/```json\n([\s\S]*?)\n```/) || rawText.match(/```\n([\s\S]*?)\n```/);
      if (match) jsonStr = match[1];
    }

    const result = JSON.parse(jsonStr.trim());
    console.log("AI Result:", result);

    // If we have at least ID or Name, we consider it a success
    if (result.id || result.name) {
      return {
        id: (result.id || '').replace(/\s/g, ''), // Clean IDs
        name: (result.name || '').toUpperCase(),   // Standardize names
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
