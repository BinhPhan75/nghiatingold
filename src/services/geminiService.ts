import { CCCDInfo } from "../lib/utils";

export const analyzeCCCDImage = async (base64Image: string): Promise<CCCDInfo | null> => {
  try {
    const response = await fetch('/api/analyze-cccd', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("AI Result from Server:", result);

    if (result.id || result.name) {
      return {
        id: (result.id || '').replace(/\s/g, ''),
        name: (result.name || '').toUpperCase(),
        dob: result.dob || '',
        gender: result.gender || '',
        address: result.address || ''
      };
    }
    return null;
  } catch (error: any) {
    console.error("AI Analysis Error (Client):", error);
    // Specifically catch network errors or server unavailability
    if (error?.message?.includes('fetch') || error?.message?.includes('Network') || error?.message?.includes('Failed to fetch')) {
      throw new Error("Không thể kết nối tới máy chủ xử lý ảnh. Vui lòng kiểm tra Wifi/4G hoặc thử lại sau.");
    }
    throw error;
  }
};
