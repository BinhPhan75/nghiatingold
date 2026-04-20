import { GoogleGenAI, Type } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

// Initialize Gemini on the frontend as per system instructions
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

export interface CCCDAnalysisResult extends CCCDInfo {
  cardType: 'OLD' | 'NEW' | 'ELECTRONIC';
  side: 'FRONT' | 'BACK' | 'ALL';
}

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDAnalysisResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp thẻ Căn cước công dân (CCCD) Việt Nam hoặc Căn cước điện tử (VNeID).

PHÂN LOẠI THẺ VÀ QUY TRÌNH:
1. "OLD": (CCCD mã vạch/ko chip) - Đọc mọi chữ trên mặt trước.
2. "NEW": (Căn cước từ 7/2024) - Mặt trước có Tên/ID. MẶT SAU có Mã QR chứa 100% dữ liệu. Ưu tiên đọc QR bằng mọi giá.
3. "ELECTRONIC": (VNeID) - Đọc mọi chữ trên màn hình.

QUY TẮC TRÍCH XUẤT QR (BẮT BUỘC):
Nếu thấy mã QR, hãy cố gắng giải mã chuỗi text bên trong. Định dạng chuẩn là:
[ID_12_SỐ]|[Số_CMND_Cũ]|[HỌ_TÊN_VIẾT_HOA]|[Ngày_Sinh_DDMMYYYY]|[Giới_Tính]|[Địa_Chỉ]|[Ngày_Cấp_DDMMYYYY]
=> Ví dụ: 012345678912|123456789|NGUYỄN VĂN A|01011990|Nam|Hà Nội|01012024

KIỂM TRA DỮ LIỆU (VALIDATION):
   - id: Luôn là 12 chữ số.
   - name: Luôn viết hoa có dấu.
   - dob: Định dạng DD/MM/YYYY.
   - address: Phải bao gồm đầy đủ số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố nếu có.
   - cardType: Phân loại đúng dựa trên tiêu đề thẻ.
   - side: FRONT/BACK/ALL.

TRẢ VỀ JSON: Chỉ trả về JSON duy nhất. KHÔNG GIẢI THÍCH.`
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
            cardType: { 
              type: Type.STRING, 
              enum: ["OLD", "NEW", "ELECTRONIC"] 
            },
            side: { 
              type: Type.STRING, 
              enum: ["FRONT", "BACK", "ALL"] 
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) return null;

    const result = JSON.parse(resultText.trim());
    console.log("AI Analysis Result:", result);

    return {
      id: (result.id || '').replace(/\s/g, ''),
      name: (result.name || '').toUpperCase(),
      dob: result.dob || '',
      gender: result.gender || '',
      address: result.address || '',
      cardType: result.cardType || 'OLD',
      side: result.side || 'FRONT'
    };
  } catch (error: any) {
    console.error("AI Analysis Error (Client):", error);
    throw error;
  }
};
