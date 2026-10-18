// Trạng thái Creative của creator (draft | published | paused), dùng chung cho danh sách và trang sửa

export const STATUS_BADGE = {
  published: { label: 'Đang bán', cls: 'bg-primary-container text-on-primary' },
  draft: { label: 'Nháp', cls: 'bg-surface-container text-on-surface-variant' },
  paused: { label: 'Tạm dừng', cls: 'bg-error-container text-on-error-container' },
};

// Chỉ đăng bán được Creative nháp hoặc tạm dừng (POST /creator/creatives/{id}/publish)
export const PUBLISHABLE = ['draft', 'paused'];
// Chỉ tạm dừng được Creative đang bán (POST /creator/creatives/{id}/pause)
export const PAUSABLE = ['published'];

// Chế độ hiển thị Creative (is_public): public hiện trên marketplace, private chỉ Creator thấy
export const VISIBILITY_BADGE = {
  public: { label: 'Công khai', icon: 'public', cls: 'bg-emerald-100 text-emerald-800' },
  private: { label: 'Riêng tư', icon: 'lock', cls: 'bg-surface-container-highest text-on-surface-variant' },
};
