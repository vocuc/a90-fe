import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import useSeo from '../hooks/useSeo';
import { useMe } from '../hooks/queries';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SubmitButton, TextArea, TextField } from '../components/common/Form';
import HashtagInput from '../components/template/HashtagInput';
import { hashtagSlug } from '../utils/hashtag';
import { formatVnd } from '../utils/format';
import { getAiContentSettings, saveAiContentSettings } from '../api/social';

export const AI_CONTENT_KEY = ['creator', 'ai-content'];

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <div>
        <h2 className="text-base font-bold text-on-surface">{title}</h2>
        {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/** Ô nhập số ký tự tối đa: chỉ nhận chữ số, kiểm tra khoảng min..max khi lưu. */
function LimitField({ label, value, onChange, range, error, hint }) {
  return (
    <TextField
      label={label}
      icon="text_fields"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      error={error}
      hint={hint ?? `Từ ${range.min} đến ${range.max} ký tự.`}
    />
  );
}

/**
 * /seller/ai-content: cài đặt AI viết nội dung bài đăng của shop (note/ai-viet-noi-dung-bai-dang.txt), chỉ chủ shop sửa;
 * nhân viên dùng chung. AI dựa vào đây để viết tiêu đề, nội dung và chọn hashtag:
 * - Kho hashtag: AI chọn tối đa 5 hashtag hợp với ảnh, kho rỗng thì bài không có hashtag.
 * - Bài viết mẫu: AI học giọng văn, cách trình bày, không chép nguyên.
 * - Số ký tự tối đa của tiêu đề / nội dung.
 */
export default function AiContentPage() {
  useSeo({ title: 'AI viết nội dung', noindex: true });
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: AI_CONTENT_KEY,
    queryFn: getAiContentSettings,
    enabled: !!me?.creatorProfile,
  });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && form === null) setForm(toForm(data));
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: saveAiContentSettings,
    onSuccess: (d) => {
      queryClient.setQueryData(AI_CONTENT_KEY, d);
      setForm(toForm(d));
      setSaved(true);
    },
    onError: (err) => setErrors(errorsFrom(err?.errors)),
  });

  const header = (
    <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
      <Link to="/account" aria-label="Quay lại" className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container">
        <Icon name="arrow_back" />
      </Link>
      <h1 className="text-base font-bold text-on-surface">AI viết nội dung</h1>
    </header>
  );

  if (me && !me.creatorProfile) {
    return (
      <>
        {header}
        <div className="space-y-3 p-4 text-center text-sm text-on-surface-variant">
          <p>{me.staffOf ? 'Chỉ chủ shop cài đặt được AI viết nội dung. Bài bạn tạo dùng cài đặt của shop.' : 'Bạn cần tạo cửa hàng trước.'}</p>
          {!me.staffOf && (
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          )}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <div className="p-4">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  if (isLoading || !me || !form) {
    return (
      <>
        {header}
        <div className="space-y-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  const { limits } = data;
  const change = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
    mutation.reset();
  };
  const setSample = (i, patch) => change({ samples: form.samples.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  const taken = new Set(form.hashtags.map(hashtagSlug));
  const fromProducts = data.productHashtags.filter((t) => !taken.has(hashtagSlug(t)));

  const validate = () => {
    const e = {};
    const inRange = (v, r) => v !== '' && Number(v) >= r.min && Number(v) <= r.max;
    if (!inRange(form.titleMax, limits.titleMax)) e.titleMax = `Từ ${limits.titleMax.min} đến ${limits.titleMax.max} ký tự.`;
    if (!inRange(form.contentMax, limits.contentMax))
      e.contentMax = `Từ ${limits.contentMax.min} đến ${limits.contentMax.max} ký tự.`;
    form.samples.forEach((s, i) => {
      if (!s.content.trim()) e[`samples.${i}.content`] = 'Bài viết mẫu cần có nội dung.';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      hashtags: form.hashtags,
      samples: form.samples.map((s) => ({ title: s.title.trim(), content: s.content.trim() })),
      titleMax: Number(form.titleMax),
      contentMax: Number(form.contentMax),
    });
  };

  const generalError = mutation.error && !mutation.error.errors ? mutation.error.message : null;

  return (
    <>
      {header}
      <form onSubmit={onSubmit} noValidate className="space-y-4 p-4">
        <p className="flex items-start gap-2 rounded-xl bg-primary-fixed/40 px-3 py-2 text-xs leading-relaxed text-primary">
          <Icon name="auto_awesome" className="text-base" />
          <span>
            Khi tạo bài có bật <b>AI viết nội dung</b> hoặc bấm <b>Viết lại bằng AI</b>
            {me.socialAi?.price ? ` (${formatVnd(me.socialAi.price)} / lần)` : ''}, AI xem ảnh của bài rồi viết theo cài đặt
            dưới đây. Nhân viên của shop dùng chung cài đặt này.
          </span>
        </p>

        <Section title="Độ dài" subtitle="AI viết không vượt quá số ký tự này (tính cả dấu cách, xuống dòng, emoji).">
          <div className="grid grid-cols-2 gap-3">
            <LimitField
              label="Tiêu đề tối đa"
              value={form.titleMax}
              onChange={(v) => change({ titleMax: v })}
              range={limits.titleMax}
              error={errors.titleMax}
            />
            <LimitField
              label="Nội dung tối đa"
              value={form.contentMax}
              onChange={(v) => change({ contentMax: v })}
              range={limits.contentMax}
              error={errors.contentMax}
            />
          </div>
        </Section>

        <Section
          title="Bài viết mẫu"
          subtitle={`AI học giọng văn, cách xưng hô, cách trình bày của các bài này (không chép nguyên). Tối đa ${limits.samples} bài.`}
        >
          {form.samples.length === 0 && (
            <p className="text-xs text-on-surface-variant">Chưa có bài mẫu: AI viết 2-5 câu theo giọng bán hàng thông thường.</p>
          )}
          {form.samples.map((s, i) => (
            <div key={s.key} className="space-y-2 rounded-xl bg-surface-container-low p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface">Bài mẫu {i + 1}</span>
                <button
                  type="button"
                  onClick={() => change({ samples: form.samples.filter((_, j) => j !== i) })}
                  className="flex items-center gap-0.5 text-xs font-bold text-error hover:underline"
                >
                  <Icon name="delete" className="text-base" />
                  Xoá
                </button>
              </div>
              <TextField
                label="Tiêu đề"
                placeholder="Không bắt buộc"
                maxLength={limits.sampleTitle}
                value={s.title}
                onChange={(e) => setSample(i, { title: e.target.value })}
              />
              <TextArea
                label="Nội dung *"
                placeholder="Dán một bài đăng bạn thấy hay của shop"
                maxLength={limits.sampleContent}
                rows={5}
                value={s.content}
                error={errors[`samples.${i}.content`]}
                onChange={(e) => {
                  setSample(i, { content: e.target.value });
                  setErrors((er) => ({ ...er, [`samples.${i}.content`]: undefined }));
                }}
              />
            </div>
          ))}
          {form.samples.length < limits.samples && (
            <button
              type="button"
              onClick={() => change({ samples: [...form.samples, newSample()] })}
              className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-primary hover:bg-surface-container"
            >
              <Icon name="add" className="text-lg" />
              Thêm bài mẫu
            </button>
          )}
          {errors.samples && <p className="text-xs text-error">{errors.samples}</p>}
        </Section>

        <Section
          title="Kho hashtag"
          subtitle={`AI chọn tối đa ${limits.aiHashtags} hashtag hợp với ảnh trong danh sách này. Để trống thì bài không có hashtag.`}
        >
          <HashtagInput
            value={form.hashtags}
            onChange={(next) => change({ hashtags: next })}
            max={limits.hashtags}
            error={errors.hashtags}
            hint="Đặt tên rõ nghĩa (vd: giaythethao, aothunnu) để AI chọn đúng. Nhấn Enter hoặc dấu phẩy để thêm."
          />
          {fromProducts.length > 0 && (
            <button
              type="button"
              onClick={() => change({ hashtags: [...form.hashtags, ...fromProducts].slice(0, limits.hashtags) })}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              <Icon name="playlist_add" className="text-base" />
              Lấy {fromProducts.length} hashtag từ sản phẩm
            </button>
          )}
        </Section>

        {generalError && <FormAlert>{generalError}</FormAlert>}
        {Object.keys(errors).length > 0 && !generalError && <FormAlert>Vui lòng kiểm tra lại các ô báo lỗi.</FormAlert>}
        {saved && !mutation.isPending && (
          <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <Icon name="check_circle" fill className="text-base" />
            Đã lưu cài đặt.
          </p>
        )}
        <SubmitButton loading={mutation.isPending} loadingText="Đang lưu...">
          Lưu cài đặt
        </SubmitButton>
      </form>
    </>
  );
}

let sampleSeq = 0;
const newSample = (s = {}) => ({ key: `s${++sampleSeq}`, title: s.title ?? '', content: s.content ?? '' });

const toForm = (d) => ({
  hashtags: d.hashtags,
  samples: d.samples.map(newSample),
  titleMax: String(d.titleMax),
  contentMax: String(d.contentMax),
});

// Lỗi 422 của backend: title_max -> titleMax, hashtags.3 -> hashtags, samples.1.content giữ nguyên
const errorsFrom = (errs) => {
  if (!errs) return {};
  const e = {};
  Object.entries(errs).forEach(([key, msgs]) => {
    const msg = Array.isArray(msgs) ? msgs[0] : msgs;
    const field = key === 'title_max' ? 'titleMax' : key === 'content_max' ? 'contentMax' : key.startsWith('hashtags') ? 'hashtags' : key;
    e[field] ??= msg;
  });
  return e;
};
