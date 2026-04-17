import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CCCDInfo {
  id: string;
  fullName: string;
  dob: string;
  address: string;
}

export async function scanCCCD(base64Image: string): Promise<CCCDInfo | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg",
            },
          },
          {
            text: "Đây là ảnh thẻ căn cước công dân Việt Nam (CCCD). Hãy trích xuất các thông tin sau: Số CCCD, Họ và tên, Ngày sinh, Quê quán/Địa chỉ thường trú. Trả về dưới dạng JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "Số căn cước công dân" },
            fullName: { type: Type.STRING, description: "Họ và tên đầy đủ" },
            dob: { type: Type.STRING, description: "Ngày tháng năm sinh" },
            address: { type: Type.STRING, description: "Địa chỉ thường trú hoặc quê quán" },
          },
          required: ["id", "fullName", "dob", "address"],
        },
      },
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text) as CCCDInfo;
    }
    return null;
  } catch (error) {
    console.error("Error scanning CCCD:", error);
    return null;
  }
}
