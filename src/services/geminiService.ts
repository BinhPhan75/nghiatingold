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
1. "OCR MODE" (CCCD Cũ/Mã vạch - Mặt trước): Tập trung đọc CHỮ in trên thẻ. Trích xuất: ID (12 số), Họ tên (VIẾT HOA), Ngày sinh, Quê quán, Nơi thường trú (lưu vào address). Đặc điểm: Thẻ này KHÔNG có chip, KHÔNG có mã QR mặt trước.
2. "QR MODE" (CCCD Gắn chip - Mặt sau): Đây là định dạng chuẩn nhất. Ưu tiên giải mã chuỗi text từ MÃ QR. 

QUY TẮC TRÍCH XUẤT OCR (THẺ CŨ - MẶT TRƯỚC):
- Số / No: -> id
- Họ và tên / Full name: -> name (Chuyển về chữ IN HOA có dấu)
- Ngày, tháng, năm sinh / Date of birth: -> dob
- Nơi thường trú / Place of residence: -> address
- Nếu ảnh mờ, hãy phân tích các nét chữ còn sót lại để đoán từ chính xác nhất (ví dụ: "Thanh Hoá", "Nghệ An"...).

QUY TẮC TRÍCH XUẤT QR:
Dữ liệu từ QR có dạng: [ID]|[Số_cũ]|[HỌ_TÊN]|[Ngày_sinh]|[Giới_tính]|[Địa_chỉ]|[Ngày_cấp]
=> Nếu nhận diện được định dạng này, bỏ qua mọi kết quả OCR khác và lấy 100% từ đây.

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

    // Robust JSON extraction from potential markdown blocks
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : resultText.trim();
    
    try {
      const parsed = JSON.parse(jsonStr);
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
    } catch (e) {
      console.error("AI returned invalid JSON:", resultText);
      throw new Error("Dữ liệu trả về từ AI không hợp lệ. Vui lòng thử lại.");
    }
  } catch (error: any) {
    console.error("AI Analysis Error (Client):", error);
    throw error;
  }
};
