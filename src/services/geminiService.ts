import { GoogleGenAI, Type } from "@google/genai";
import { CCCDInfo } from "../lib/utils";

// Lazy initialize to avoid potential crashes at module load if env vars are missing
let aiInstance: any = null;

const getAI = () => {
  if (aiInstance) return aiInstance;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
  }
  
  aiInstance = new GoogleGenAI({ 
    apiKey: apiKey || '' 
  });
  return aiInstance;
};

export interface CCCDAnalysisResult extends CCCDInfo {
  cardType: 'OLD' | 'NEW' | 'ELECTRONIC';
  side: 'FRONT' | 'BACK' | 'ALL';
}

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDAnalysisResult | null> => {
  try {
    const genAI = getAI();
    // Use the standard model initialization to be safe
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const result = await model.generateContent([
      {
        text: `NHIỆM VỤ: Trích xuất thông tin CỰC KỲ CHÍNH XÁC từ ảnh chụp thẻ Căn cước công dân (CCCD) Việt Nam hoặc Căn cước điện tử (VNeID).

PHÂN LOẠI THẺ VÀ QUY TRÌNH:
1. "OLD": (CCCD mã vạch/ko chip) - Ưu tiên OCR (nhận diện chữ) mặt trước. Trích xuất: ID (12 số), Họ tên, Ngày sinh, Quê quán, Địa chỉ thường trú.
2. "NEW": (Căn cước từ 7/2024) - Mặt trước có Tên/ID. MẶT SAU có Mã QR chứa 100% dữ liệu. Ưu tiên giải mã chuỗi Text từ QR nếu thấy.
3. "ELECTRONIC": (VNeID) - Đọc mọi thông tin trên màn hình ứng dụng.

QUY TẮC TRÍCH XUẤT QR (KHI CÓ):
Dữ liệu chuẩn: [ID]|[Số_cũ]|[HỌ_TÊN]|[Ngày_sinh]|[Giới_tính]|[Địa_chỉ]|[Ngày_cấp]
=> Nếu là mặt sau thẻ NEW, hãy tìm mã QR để có dữ liệu chính xác nhất.

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
    ]);

    const resultText = result.response.text();
    if (!resultText) return null;

    const parsed = JSON.parse(resultText.trim());
    console.log("AI Analysis Result:", parsed);

    return {
      id: (parsed.id || '').replace(/\s/g, ''),
      name: (parsed.name || '').toUpperCase(),
      dob: parsed.dob || '',
      gender: parsed.gender || '',
      address: parsed.address || '',
      cardType: parsed.cardType || 'OLD',
      side: parsed.side || 'FRONT'
    };
  } catch (error: any) {
    console.error("AI Analysis Error (Client):", error);
    throw error;
  }
};
