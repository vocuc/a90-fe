import { useState } from 'react';
import { Switch } from '../template/inputs';
import { useMe } from '../../hooks/queries';
import { formatVnd } from '../../utils/format';
import { loadAiContentPref, saveAiContentPref } from '../../api/social';

/**
 * Công tắc "AI viết nội dung" khi tạo bài (note/ai-viet-noi-dung-bai-dang.txt): mặc định bật, nhớ lựa chọn lần trước.
 * available: backend bật tính năng (social_ai.enabled của /auth/me); tắt thì không hiện công tắc và luôn gửi false.
 */
export function useAiContentToggle() {
  const { data: me } = useMe();
  const [on, setOn] = useState(loadAiContentPref);
  const available = !!me?.socialAi?.enabled;
  const change = (next) => {
    setOn(next);
    saveAiContentPref(next);
  };
  return { available, on: available && on, setOn: change, price: me?.socialAi?.price ?? 0 };
}

export default function AiContentSwitch({ toggle }) {
  if (!toggle.available) return null;
  return (
    <Switch
      label={`AI viết tiêu đề, nội dung, hashtag (${formatVnd(toggle.price)})`}
      hint="AI viết theo cài đặt ở trang AI viết nội dung của shop. AI lỗi thì được hoàn tiền."
      checked={toggle.on}
      onChange={toggle.setOn}
    />
  );
}
