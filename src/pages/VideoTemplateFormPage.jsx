import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SubmitButton, TextField } from '../components/common/Form';
import { useCreatorProfile } from '../hooks/creatorQueries';
import {
  VIDEO_TEMPLATE_KEYS,
  VIDEO_TEMPLATE_IMAGE_MAX,
  VIDEO_TEMPLATE_NAME_MAX,
  createVideoTemplate,
  getVideoTemplate,
  isTikTokUrl,
  updateVideoTemplate,
} from '../api/videoTemplates';

const validate = ({ name, videoUrl, imageCount }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Nhập tên template.';
  else if (name.trim().length > VIDEO_TEMPLATE_NAME_MAX) errors.name = `Tên tối đa ${VIDEO_TEMPLATE_NAME_MAX} ký tự.`;
  if (!videoUrl.trim()) errors.video_url = 'Nhập link video TikTok mẫu.';
  else if (!isTikTokUrl(videoUrl)) errors.video_url = 'Link phải là link video TikTok (tiktok.com).';
  const n = Number(imageCount);
  if (String(imageCount).trim() === '') errors.image_count = 'Nhập số ảnh template cần.';
  else if (!Number.isInteger(n) || n < 1 || n > VIDEO_TEMPLATE_IMAGE_MAX) errors.image_count = `Số ảnh từ 1 đến ${VIDEO_TEMPLATE_IMAGE_MAX}.`;
  return errors;
};

/**
 * /seller/video-templates/new và /seller/video-templates/:id/edit (note/quan-ly-video-template.txt):
 * nhập tên + link video TikTok mẫu + số ảnh template cần, lưu xong về danh sách.
 */
export default function VideoTemplateFormPage() {
  const { id } = useParams();
  const editing = !!id;
  useSeo({ title: editing ? 'Sửa video template' : 'Thêm video template', noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasProfile, meLoaded } = useCreatorProfile();

  const existing = useQuery({
    queryKey: VIDEO_TEMPLATE_KEYS.detail(id),
    queryFn: () => getVideoTemplate(id),
    enabled: editing && hasProfile,
  });

  const [values, setValues] = useState({ name: '', videoUrl: '', imageCount: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Sửa: điền sẵn dữ liệu cũ một lần khi tải xong
  useEffect(() => {
    if (existing.data) setValues({ name: existing.data.name, videoUrl: existing.data.videoUrl, imageCount: existing.data.imageCount ?? '' });
  }, [existing.data]);

  const set = (field, errorKey) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [errorKey]: undefined }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      if (editing) await updateVideoTemplate(id, values);
      else await createVideoTemplate(values);
      await queryClient.invalidateQueries({ queryKey: VIDEO_TEMPLATE_KEYS.all });
      navigate('/seller/video-templates', { replace: true });
    } catch (err) {
      if (err?.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setFormError(err?.message || 'Không lưu được template, vui lòng thử lại.');
      setSaving(false);
    }
  };

  const title = editing ? 'Sửa video template' : 'Thêm video template';

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link
          to="/seller/video-templates"
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">{title}</h1>
      </header>

      {!meLoaded || (editing && existing.isLoading) ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !hasProfile ? (
        <div className="space-y-3 p-4 text-center text-sm text-on-surface-variant">
          <p>Bạn cần tạo cửa hàng trước.</p>
          <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
            Tạo cửa hàng
          </Link>
        </div>
      ) : editing && existing.error ? (
        <div className="p-4">
          <ErrorState error={existing.error} onRetry={existing.refetch} />
        </div>
      ) : editing && existing.data?.synced ? (
        <div className="space-y-3 p-4 text-center text-sm text-on-surface-variant">
          <p>Template "{existing.data.name}" được đồng bộ từ máy làm template, không sửa được.</p>
          <Link to="/seller/video-templates" className="text-sm font-bold text-primary hover:underline">
            Về danh sách template
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4 p-4">
          <TextField
            label="Tên template"
            icon="title"
            value={values.name}
            onChange={set('name', 'name')}
            maxLength={VIDEO_TEMPLATE_NAME_MAX}
            placeholder="VD: LensPop"
            hint="Phải trùng tên template trên máy worker (VD: StripReveal, LensPop, FlashMontage) thì worker mới dựng được video"
            error={errors.name}
            autoFocus={!editing}
          />
          <TextField
            label="Link video TikTok mẫu"
            icon="link"
            type="url"
            inputMode="url"
            value={values.videoUrl}
            onChange={set('videoUrl', 'video_url')}
            placeholder="https://www.tiktok.com/@shop/video/..."
            hint="Video TikTok làm từ template này"
            error={errors.video_url}
          />
          <TextField
            label="Số ảnh template cần"
            icon="photo_library"
            type="number"
            inputMode="numeric"
            min={1}
            max={VIDEO_TEMPLATE_IMAGE_MAX}
            value={values.imageCount}
            onChange={set('imageCount', 'image_count')}
            placeholder="VD: 3"
            hint="Bài video dùng template này sẽ lấy đúng số ảnh này"
            error={errors.image_count}
          />
          {formError && <FormAlert>{formError}</FormAlert>}
          <SubmitButton loading={saving} loadingText="Đang lưu...">
            Lưu
          </SubmitButton>
        </form>
      )}
    </>
  );
}
