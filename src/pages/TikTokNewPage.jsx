import { useEffect, useRef, useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert } from '../components/common/Form';
import DynamicForm, { initialValues, validateValues } from '../components/template/DynamicForm';
import CategoryStrip from '../components/home/CategoryStrip';
import HashtagStrip from '../components/home/HashtagStrip';
import A51ImagePicker from '../components/tiktok/A51ImagePicker';
import { creativeApi } from '../api/services';
import { useInfiniteCreatives } from '../hooks/queries';
import { formatVnd } from '../utils/format';
import { hashtagSlug } from '../utils/hashtag';
import { PHOTO_MAX_COUNT, createPostFromCreatives, createPostFromImages, newIdempotencyKey } from '../api/tiktok';

// Mỗi mẫu tạo một ảnh; giới hạn số mẫu cho một bài để chi phí không quá lớn
const MAX_CREATIVES = 10;

/*
 * Khoá chống tạo trùng cho mỗi lần bấm "Tạo bài đăng". Lỗi mạng (không có status) thì giữ khoá để bấm lại không
 * tạo bài thứ hai; máy chủ đã trả lỗi (422, 402...) thì bài chưa được tạo -> lần sau dùng khoá mới.
 */
function useIdempotencyKey() {
  const key = useRef(newIdempotencyKey());
  const renew = () => {
    key.current = newIdempotencyKey();
  };
  return { key, renew, renewAfter: (err) => err?.status && renew() };
}

const SOURCES = [
  {
    value: 'new',
    icon: 'auto_awesome',
    title: 'Tạo ảnh mới',
    description: 'Chọn mẫu AI Creative, nhập thông tin cho từng mẫu, AI tạo ảnh rồi viết nội dung',
  },
  {
    value: 'existing',
    icon: 'photo_library',
    title: 'Dùng ảnh đã có',
    description: 'Chọn trong các ảnh bạn đã tạo trên A51, AI viết nội dung',
  },
];

/** Thanh dưới cùng: mobile dính đáy màn hình (che tab dưới), desktop dính đáy vùng nội dung. */
function ActionBar({ summary, error, disabled, loading, onSubmit, label = 'Tạo bài đăng', icon = 'post_add' }) {
  // Mobile: z-[55] để nằm trên tab dưới (BottomNav z-50 render sau nên sẽ che thanh này nếu cùng z-index);
  // khoảng trống phía trên để nội dung cuối trang không bị thanh che
  return (
    <>
      <div aria-hidden="true" className="h-8 lg:hidden" />
      <div className="fixed bottom-0 left-0 right-0 z-[55] mx-auto max-w-[640px] border-t border-surface-container bg-surface-container-lowest p-3 lg:sticky lg:max-w-none lg:rounded-t-2xl lg:border lg:px-4">
        {error && (
          <div className="mb-2">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-on-surface-variant">{summary}</div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || loading}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary-container px-5 text-sm font-bold text-on-primary shadow-md shadow-primary-container/25 hover:bg-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon name={loading ? 'progress_activity' : icon} className={`text-lg ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Đang tạo...' : label}
          </button>
        </div>
      </div>
    </>
  );
}

function SourceChooser({ onPick }) {
  return (
    <section className="grid gap-3 p-4 sm:grid-cols-2 lg:mx-auto lg:w-full lg:max-w-[800px] lg:gap-4 lg:py-8">
      {SOURCES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onPick(s.value)}
          className="group flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 text-left transition-all hover:border-primary-container active:scale-[0.98] sm:flex-col sm:items-start sm:p-5"
        >
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-container text-primary transition-colors group-hover:bg-primary-container group-hover:text-on-primary">
            <Icon name={s.icon} className="text-3xl" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-on-surface">{s.title}</span>
            <span className="mt-1 block text-xs leading-snug text-on-surface-variant">{s.description}</span>
          </span>
          <Icon name="chevron_right" className="text-outline sm:hidden" />
        </button>
      ))}
    </section>
  );
}

/** Dùng ảnh đã có: chọn ảnh rồi tạo bài, AI viết nội dung. */
function ExistingSource() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idem = useIdempotencyKey();
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const post = await createPostFromImages(selected, idem.key.current);
      idem.renew();
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
      navigate(`/tiktok/post/${post.id}`, { replace: true });
    } catch (err) {
      idem.renewAfter(err);
      setError(err?.message || 'Không tạo được bài đăng, vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <>
      <section className="space-y-3 p-4 lg:py-6">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Chọn ảnh cho bài đăng</h2>
          <p className="text-xs text-on-surface-variant">
            Tối đa {PHOTO_MAX_COUNT} ảnh, ảnh chọn đầu tiên làm ảnh bìa. Chỉ dùng được ảnh đã tạo trên A51.
          </p>
        </div>
        <A51ImagePicker selected={selected} onChange={setSelected} max={PHOTO_MAX_COUNT} />
      </section>
      <ActionBar
        summary={
          selected.length ? (
            <>
              Đã chọn <b className="text-on-surface">{selected.length}</b>/{PHOTO_MAX_COUNT} ảnh
            </>
          ) : (
            'Chưa chọn ảnh nào'
          )
        }
        error={error}
        disabled={!selected.length}
        loading={loading}
        onSubmit={submit}
      />
    </>
  );
}

/** Bước chọn mẫu: tìm theo tên / ngành hàng / hashtag, chọn một hoặc nhiều mẫu. */
function CreativePicker({ picked, onToggle }) {
  // Bộ lọc mẫu: tên mẫu (q), ngành hàng (category), hashtag. Gõ "#abc" vào ô tìm kiếm = lọc hashtag abc
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [hashtag, setHashtag] = useState({ slug: '', name: '' });

  // Gõ xong 300ms mới tìm
  useEffect(() => {
    const t = setTimeout(() => {
      const text = input.trim();
      if (text.startsWith('#')) {
        const slug = hashtagSlug(text);
        setQ('');
        setHashtag(slug ? { slug, name: text.replace(/^#+/, '') } : { slug: '', name: '' });
      } else {
        setQ(text);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const pickHashtag = (slug, name) => {
    setHashtag({ slug, name: slug ? name : '' });
    // Đang gõ #hashtag trong ô tìm kiếm thì đồng bộ theo dải hashtag
    if (input.trim().startsWith('#')) setInput(slug ? `#${name}` : '');
  };

  const hasFilter = Boolean(input.trim() || category || hashtag.slug);
  const clearFilters = () => {
    setInput('');
    setQ('');
    setCategory('');
    setHashtag({ slug: '', name: '' });
  };

  const {
    data,
    isLoading,
    isFetching,
    error: listError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteCreatives({ q: q || undefined, category: category || undefined, hashtag: hashtag.slug || undefined, limit: 20 });
  const creatives = data?.pages.flatMap((p) => p.items) ?? [];

  const isPicked = (c) => picked.some((p) => p.id === c.id);
  const full = picked.length >= MAX_CREATIVES;

  return (
    <div className="p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8 lg:py-6">
      {/* Phải (desktop) / trên (mobile): các mẫu đã chọn */}
      <aside className="space-y-2 lg:order-2 lg:sticky lg:top-[136px]">
        <h2 className="flex items-center justify-between text-sm font-bold text-on-surface">
          Mẫu đã chọn
          <span className="text-xs font-normal text-outline">
            {picked.length}/{MAX_CREATIVES}
          </span>
        </h2>
        {picked.length ? (
          <ul className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {picked.map((c) => (
              <li key={c.id} className="flex w-48 shrink-0 items-center gap-2 rounded-xl border border-outline-variant/40 p-1.5 lg:w-auto">
                <CoverImage src={c.imageUrl} alt="" className="size-10 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-on-surface">{c.title}</span>
                  <span className="block text-[11px] text-outline">{c.price > 0 ? formatVnd(c.price) : 'Miễn phí'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onToggle(c)}
                  aria-label={`Bỏ chọn ${c.title}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container"
                >
                  <Icon name="close" className="text-base" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-on-surface-variant">Chọn một hoặc nhiều mẫu, mỗi mẫu tạo một ảnh.</p>
        )}
      </aside>

      {/* Trái (desktop) / dưới (mobile): tìm và chọn mẫu */}
      <section className="mt-6 space-y-3 lg:order-1 lg:mt-0">
        <h2 className="text-sm font-bold text-on-surface">Chọn mẫu AI Creative</h2>
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl bg-surface-container-low px-3 focus-within:ring-2 focus-within:ring-primary-container/30">
            <Icon name={input.trim().startsWith('#') ? 'tag' : 'search'} className="mr-2 text-[22px] text-outline" />
            <input
              type="search"
              maxLength={100}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tìm theo tên mẫu hoặc #hashtag"
              aria-label="Tìm AI Creative theo tên hoặc hashtag"
              className="w-full border-none bg-transparent p-0 text-sm font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
            />
            {isFetching && !isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-lg text-outline" />}
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-xs font-bold text-primary hover:bg-surface-container"
            >
              <Icon name="filter_alt_off" className="text-lg" />
              Xoá lọc
            </button>
          )}
        </div>

        {/* Dải ngành hàng và hashtag có sẵn lề ngang 16px: kéo ra sát mép để cuộn hết chiều rộng */}
        <div className="-mx-4">
          <p className="px-4 pt-1 text-xs font-semibold text-on-surface-variant">Ngành hàng</p>
          <div className="-mt-2">
            <CategoryStrip active={category} onSelect={setCategory} />
          </div>
          <p className="px-4 pb-2 text-xs font-semibold text-on-surface-variant">Hashtag phổ biến</p>
          <HashtagStrip active={hashtag.slug} activeName={hashtag.name} onSelect={pickHashtag} />
        </div>

        {listError ? (
          <ErrorState error={listError} onRetry={refetch} />
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5]" />
            ))}
          </div>
        ) : !creatives.length ? (
          <EmptyState message="Không tìm thấy mẫu phù hợp." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {creatives.map((c) => {
                const on = isPicked(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onToggle(c)}
                    disabled={!on && full}
                    aria-pressed={on}
                    className={`flex flex-col overflow-hidden rounded-2xl border text-left transition-all disabled:opacity-40 ${
                      on
                        ? 'border-primary-container ring-2 ring-primary-container'
                        : 'border-outline-variant/40 hover:border-primary-container'
                    }`}
                  >
                    <span className="relative block aspect-square w-full bg-surface-container">
                      <CoverImage src={c.imageUrl} alt={c.title} className="size-full" />
                      <span
                        className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 ${
                          on ? 'border-primary-container bg-primary-container text-on-primary' : 'border-white bg-black/20'
                        }`}
                      >
                        {on && <Icon name="check" className="text-sm" />}
                      </span>
                    </span>
                    <span className="block p-2">
                      <span className="block truncate text-xs font-bold text-on-surface">{c.title}</span>
                      <span className="block text-[11px] font-semibold text-primary">
                        {c.price > 0 ? `${formatVnd(c.price)}/ảnh` : 'Miễn phí'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hasNextPage && (
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="mx-auto flex h-9 items-center gap-1 rounded-lg px-4 text-sm font-bold text-primary hover:bg-surface-container disabled:opacity-60"
              >
                {isFetchingNextPage && <Icon name="progress_activity" className="animate-spin text-base" />}
                Xem thêm mẫu
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** Thông tin nhập cho một mẫu (form theo input_schema của mẫu đó), thu gọn / mở rộng được. */
function CreativeInputCard({ creative, detail, values, errors, missing, open, onToggleOpen, onChange, onRemove }) {
  const { data: c, isLoading, error, refetch } = detail;
  const ready = !!c?.inputSchema;
  return (
    <li id={`creative-input-${creative.id}`} className="scroll-mt-[136px] overflow-hidden rounded-2xl border border-outline-variant/40">
      <div className="flex items-center gap-3 p-3">
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CoverImage src={creative.imageUrl} alt="" className="size-12 shrink-0 rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-on-surface">{creative.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] text-outline">{creative.price > 0 ? formatVnd(creative.price) : 'Miễn phí'}</span>
              {isLoading ? (
                <span className="text-[11px] text-outline">Đang tải...</span>
              ) : !ready ? null : missing ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Icon name="error" className="text-xs" />
                  Thiếu {missing} thông tin
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <Icon name="check_circle" fill className="text-xs" />
                  Đủ thông tin
                </span>
              )}
            </span>
          </span>
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-outline" />
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Bỏ mẫu ${creative.title}`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-outline hover:bg-surface-container hover:text-error"
          >
            <Icon name="delete" className="text-lg" />
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-surface-container p-4">
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : !ready ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <DynamicForm
              compact
              fields={c.inputSchema}
              values={values}
              errors={errors}
              aspectRatios={c.options?.aspect_ratios ?? []}
              onChange={onChange}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Tạo ảnh mới, 2 bước (?step=inputs là bước 2, nút quay lại của trình duyệt về bước 1):
 * 1. chọn mẫu; 2. nhập thông tin riêng cho từng mẫu theo form của mẫu đó. Xong thì tạo bài ngay,
 * ảnh và nội dung được tạo ở nền (bài ở trạng thái "Đang tạo nội dung").
 */
function NewSource() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idem = useIdempotencyKey();
  const [params, setParams] = useSearchParams();
  const [picked, setPicked] = useState([]);
  // Giá trị nhập theo mẫu: { [slug]: values }; chưa có thì lấy giá trị mặc định của form
  const [inputs, setInputs] = useState({});
  const [open, setOpen] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Lỗi theo trường do máy chủ trả về: { [slug]: { [key]: msg } } (errors["items.1.inputs.product_image"])
  const [serverErrors, setServerErrors] = useState({});

  const step = params.get('step') === 'inputs' && picked.length ? 'inputs' : 'pick';

  // Chi tiết từng mẫu (danh sách mẫu không kèm form nhập liệu); dùng chung cache với trang chi tiết mẫu
  const details = useQueries({
    queries: picked.map((c) => ({ queryKey: ['creative', c.id], queryFn: () => creativeApi.getById(c.id), enabled: step === 'inputs' })),
  });

  const full = picked.length >= MAX_CREATIVES;
  const toggle = (c) =>
    setPicked((prev) => (prev.some((p) => p.id === c.id) ? prev.filter((p) => p.id !== c.id) : full ? prev : [...prev, c]));
  const total = picked.reduce((sum, c) => sum + (c.price ?? 0), 0);

  const rows = picked.map((c, i) => {
    const schema = details[i]?.data?.inputSchema ?? null;
    const values = inputs[c.id] ?? (schema ? initialValues(schema) : {});
    const allErrors = schema ? validateValues(schema, values) : {};
    return { creative: c, detail: details[i] ?? {}, schema, values, allErrors, missing: Object.keys(allErrors).length };
  });
  const loadingDetails = rows.some((r) => !r.schema);
  const incomplete = rows.filter((r) => r.schema && r.missing);

  const goInputs = () => {
    setSubmitted(false);
    setOpen(picked.slice(0, 1).map((c) => c.id));
    setParams({ source: 'new', step: 'inputs' });
  };

  const toggleOpen = (id) => setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
    if (incomplete.length) {
      // Mở các mẫu còn thiếu và cuộn tới mẫu đầu tiên
      setSubmitted(true);
      setOpen((ids) => [...new Set([...ids, ...incomplete.map((r) => r.creative.id)])]);
      requestAnimationFrame(() =>
        document.getElementById(`creative-input-${incomplete[0].creative.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      return;
    }
    setLoading(true);
    setServerErrors({});
    try {
      const post = await createPostFromCreatives(
        rows.map((r) => ({ creativeId: r.detail.data?.creativeId ?? r.creative.creativeId, schema: r.schema, values: r.values })),
        idem.key.current,
      );
      idem.renew();
      // Đã trừ tiền -> tải lại số dư
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok', 'posts'] });
      navigate(`/tiktok/post/${post.id}`, { replace: true });
    } catch (err) {
      idem.renewAfter(err);
      const byRow = {};
      Object.entries(err?.errors ?? {}).forEach(([field, msg]) => {
        const m = field.match(/^items\.(\d+)\.inputs\.([^.]+)/);
        const row = m && rows[Number(m[1])];
        if (row) byRow[row.creative.id] = { ...byRow[row.creative.id], [m[2]]: msg };
      });
      if (Object.keys(byRow).length) {
        setServerErrors(byRow);
        setOpen((ids) => [...new Set([...ids, ...Object.keys(byRow)])]);
      }
      setError(err?.message || 'Không tạo được bài đăng, vui lòng thử lại.');
      setLoading(false);
    }
  };

  if (step === 'pick') {
    return (
      <>
        <CreativePicker picked={picked} onToggle={toggle} />
        <ActionBar
          summary={
            picked.length ? (
              <>
                <b className="text-on-surface">{picked.length}</b> mẫu · {picked.length} ảnh ·{' '}
                <b className="text-on-surface">{total > 0 ? formatVnd(total) : 'Miễn phí'}</b>
              </>
            ) : (
              'Chưa chọn mẫu nào'
            )
          }
          label="Tiếp tục"
          icon="arrow_forward"
          disabled={!picked.length}
          onSubmit={goInputs}
        />
      </>
    );
  }

  return (
    <>
      <section className="space-y-3 p-4 lg:mx-auto lg:w-full lg:max-w-[800px] lg:py-6">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Nhập thông tin cho từng mẫu</h2>
          <p className="text-xs text-on-surface-variant">
            Mỗi mẫu cần thông tin riêng (ảnh sản phẩm, ảnh tham chiếu, tuỳ chọn...). Mỗi mẫu tạo một ảnh.
          </p>
        </div>
        <ul className="space-y-3">
          {rows.map((r) => (
            <CreativeInputCard
              key={r.creative.id}
              creative={r.creative}
              detail={r.detail}
              values={r.values}
              errors={{ ...serverErrors[r.creative.id], ...(submitted ? r.allErrors : {}) }}
              missing={r.missing}
              open={open.includes(r.creative.id)}
              onToggleOpen={() => toggleOpen(r.creative.id)}
              onChange={(key, v) => {
                setInputs((prev) => ({ ...prev, [r.creative.id]: { ...r.values, [key]: v } }));
                setServerErrors((prev) => ({ ...prev, [r.creative.id]: { ...prev[r.creative.id], [key]: undefined } }));
              }}
              // Bước này luôn giữ ít nhất 1 mẫu; muốn đổi hết thì quay lại bước chọn mẫu
              onRemove={rows.length > 1 ? () => toggle(r.creative) : null}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-outline-variant text-sm font-bold text-primary hover:bg-surface-container"
        >
          <Icon name="add" className="text-lg" />
          Chọn thêm mẫu
        </button>
      </section>
      <ActionBar
        summary={
          <>
            <b className="text-on-surface">{picked.length}</b> ảnh ·{' '}
            <b className="text-on-surface">{total > 0 ? formatVnd(total) : 'Miễn phí'}</b>
            {loadingDetails ? (
              <span className="block">Đang tải thông tin mẫu...</span>
            ) : incomplete.length ? (
              <span className="block text-amber-700">Còn {incomplete.length} mẫu thiếu thông tin</span>
            ) : (
              <span className="block text-emerald-700">Đã đủ thông tin</span>
            )}
          </>
        }
        error={error}
        disabled={loadingDetails}
        loading={loading}
        onSubmit={submit}
      />
    </>
  );
}

/** /tiktok/new: bước 2 của quy trình, chọn nguồn ảnh (?source=new | existing) rồi tạo bài đăng. */
export default function TikTokNewPage() {
  useSeo({ title: 'Tạo bài đăng TikTok', noindex: true });
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const source = SOURCES.some((s) => s.value === params.get('source')) ? params.get('source') : null;
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tiktok', { replace: true }));

  const title =
    source === 'new'
      ? params.get('step') === 'inputs'
        ? 'Nhập thông tin tạo ảnh'
        : 'Tạo ảnh mới'
      : source === 'existing'
        ? 'Dùng ảnh đã có'
        : 'Tạo bài đăng';

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-on-surface">{title}</h1>
          {!source && <p className="text-xs text-on-surface-variant">Chọn nguồn ảnh cho bài đăng</p>}
        </div>
      </header>

      {source === 'new' ? (
        <NewSource />
      ) : source === 'existing' ? (
        <ExistingSource />
      ) : (
        <SourceChooser onPick={(value) => setParams({ source: value })} />
      )}
    </>
  );
}
