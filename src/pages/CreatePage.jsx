import useSeo from '../hooks/useSeo';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CoverImage from '../components/common/CoverImage';
import Icon from '../components/common/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SubmitButton } from '../components/common/Form';
import { useCreative, useMe } from '../hooks/queries';
import {
  FINAL_STATUSES,
  useCreateGeneration,
  useDownloadOutput,
  useGenerationStatus,
  useRetryGeneration,
} from '../hooks/generationQueries';
import { formatVnd } from '../utils/format';

// Khớp backend (GenerationController: input_max_size_kb = 10240)
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const RATIO_LABEL = { '1:1': 'Vuông', '4:5': 'Dọc', '3:4': 'Dọc', '2:3': 'Dọc', '9:16': 'Story', '16:9': 'Ngang', '4:3': 'Ngang', '3:2': 'Ngang', '5:4': 'Ngang', '21:9': 'Rộng' };

// Mã lỗi từng ảnh (GenerationResource) -> thông báo, ảnh lỗi đều được hoàn tiền
const OUTPUT_ERRORS = {
  CONTENT_BLOCKED: 'Ảnh hoặc nội dung vi phạm chính sách an toàn của AI.',
  NO_IMAGE_RETURNED: 'AI không tạo được ảnh.',
  TIMEOUT: 'Quá thời gian xử lý.',
  NO_USABLE_API_KEY: 'Mẫu tạm thời không tạo được ảnh (API key AI của người bán đã hết hạn mức).',
};

// Lỗi khi gửi yêu cầu tạo ảnh -> thông báo (backend còn ghi "Credit", frontend hiển thị VND)
const requestError = (err) => {
  if (err.code === 'INSUFFICIENT_CREDIT' && err.context)
    return `Số dư không đủ: cần ${formatVnd(err.context.required)}, hiện còn ${formatVnd(err.context.balance)}.`;
  if (err.code === 'CREATIVE_NOT_AVAILABLE') return 'Mẫu này không còn hoạt động.';
  if (err.code === 'CREATIVE_TEMPORARILY_UNAVAILABLE') return 'Mẫu này tạm thời không tạo được ảnh, vui lòng thử lại sau.';
  if (err.errors) return Object.values(err.errors)[0];
  return err.message;
};

// Khoá chống trừ tiền 2 lần khi bấm lại cùng một yêu cầu (mạng chập chờn)
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// "4:5" -> "4 / 5" cho CSS aspect-ratio
const cssRatio = (ratio) => (ratio ? ratio.replace(':', ' / ') : '1 / 1');

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

/** Ảnh sản phẩm người dùng tải lên làm đầu vào. */
function InputImagePicker({ image, onChange, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return setError('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
    if (file.size > MAX_INPUT_BYTES) return setError('Ảnh tối đa 10MB.');
    setError(null);
    onChange({ file, url: URL.createObjectURL(file) });
  };

  return (
    <div className="space-y-2">
      {image ? (
        <div className="relative overflow-hidden rounded-xl bg-surface-container">
          <img src={image.url} alt="Ảnh sản phẩm của bạn" className="max-h-80 w-full object-contain" />
          {!disabled && (
            <div className="absolute right-2 top-2 flex gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex h-8 items-center gap-1 rounded-full bg-surface-container-lowest/90 px-3 text-xs font-semibold text-on-surface shadow-sm hover:text-primary"
              >
                <Icon name="swap_horiz" className="text-sm" />
                Đổi ảnh
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label="Xoá ảnh"
                className="flex size-8 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface shadow-sm hover:text-error"
              >
                <Icon name="close" className="text-sm" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary"
        >
          <Icon name="add_photo_alternate" className="text-4xl" />
          <span className="text-sm font-semibold">Chọn ảnh sản phẩm</span>
          <span className="text-xs">JPG, PNG, WEBP tối đa 10MB</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onPick} />
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// Thời gian chờ ước tính cho mỗi lần tạo ảnh
const WAIT_MS = 5 * 60 * 1000;

/** Đếm ngược thời gian chờ từ lúc bấm tạo ảnh (mm:ss). */
function Countdown({ startedAt }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.ceil((startedAt + WAIT_MS - now) / 1000));
  if (left === 0) return <span className="text-[11px]">Sắp xong, vui lòng chờ thêm...</span>;

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return <span className="font-mono text-sm font-bold tabular-nums text-primary">{mm}:{ss}</span>;
}

function OutputTile({ generationId, output, ratio, startedAt }) {
  const download = useDownloadOutput();
  const pending = !FINAL_STATUSES.includes(output.status);

  return (
    <div className="space-y-1.5">
      <div className="relative overflow-hidden rounded-xl bg-surface-container" style={{ aspectRatio: cssRatio(ratio) }}>
        {output.status === 'completed' && output.image_url ? (
          <a href={output.image_url} target="_blank" rel="noreferrer" title="Xem ảnh lớn">
            <img src={output.image_url} alt={`Ảnh ${output.position}`} className="h-full w-full object-cover" />
          </a>
        ) : pending ? (
          <div className="flex h-full w-full animate-pulse flex-col items-center justify-center gap-1.5 text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-2xl text-primary" />
            <span className="text-[11px] font-medium">{output.status === 'queued' ? 'Đang chờ...' : 'Đang tạo...'}</span>
            <Countdown startedAt={startedAt} />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-error">
            <Icon name="broken_image" className="text-2xl" />
            <span className="text-[11px] leading-snug">
              {OUTPUT_ERRORS[output.error_code] ?? 'Tạo ảnh thất bại.'} Đã hoàn tiền.
            </span>
          </div>
        )}
      </div>
      {output.status === 'completed' && (
        <>
          <button
            type="button"
            onClick={() => download.mutate({ generationId, outputId: output.id })}
            disabled={download.isPending}
            className="flex h-9 w-full items-center justify-center gap-1 rounded-lg bg-primary-container text-xs font-bold text-on-primary shadow-sm shadow-primary-container/25 transition-all hover:bg-primary active:scale-[0.98] disabled:opacity-50"
          >
            <Icon
              name={download.isPending ? 'progress_activity' : 'download'}
              className={`text-sm ${download.isPending ? 'animate-spin' : ''}`}
            />
            Tải về
          </button>
          {download.error && <p className="text-[11px] text-error">{download.error.message}</p>}
        </>
      )}
    </div>
  );
}

/** Kết quả một lần tạo: tự cập nhật tới khi xong, tải ảnh, tạo lại ảnh lỗi. */
function GenerationResult({ run, price, onRetried }) {
  const { data, error, refetch } = useGenerationStatus(run.id);
  const retry = useRetryGeneration();
  const retryKey = useRef(newKey());
  const startedAt = useRef(Date.now());

  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const outputs = data?.outputs ?? Array.from({ length: run.quantity }, (_, i) => ({ id: `p${i}`, position: i + 1, status: 'queued' }));
  const done = FINAL_STATUSES.includes(data?.status);
  const failed = outputs.filter((o) => o.status === 'failed');
  const doneCount = outputs.filter((o) => FINAL_STATUSES.includes(o.status)).length;

  const onRetry = () =>
    retry.mutate(
      { id: run.id, outputIds: failed.map((o) => o.id), idempotencyKey: retryKey.current },
      {
        onSuccess: (generation) => {
          retryKey.current = newKey();
          onRetried({ id: generation.id, quantity: generation.quantity, ratio: generation.aspect_ratio, total: generation.total_charged });
        },
      },
    );

  return (
    <section className="space-y-3 rounded-2xl border border-outline-variant/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-on-surface">
            {run.retry ? 'Tạo lại' : 'Lần tạo'} #{run.id}
          </h3>
          <p className="text-xs text-on-surface-variant">
            {run.quantity} ảnh · {run.ratio} · {run.total > 0 ? formatVnd(run.total) : 'Miễn phí (mẫu của bạn)'}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            !done
              ? 'bg-surface-container text-primary'
              : failed.length
                ? 'bg-error-container text-on-error-container'
                : 'bg-primary-container text-on-primary'
          }`}
        >
          {!done ? (
            <>
              <Icon name="progress_activity" className="animate-spin text-xs" />
              {doneCount}/{outputs.length}
            </>
          ) : failed.length ? (
            `${outputs.length - failed.length}/${outputs.length} thành công`
          ) : (
            'Hoàn tất'
          )}
        </span>
      </div>

      <div className="space-y-4">
        {outputs.map((o) => (
          <OutputTile key={o.id} generationId={run.id} output={o} ratio={run.ratio} startedAt={startedAt.current} />
        ))}
      </div>

      {done && failed.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retry.isPending || retry.isSuccess}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-primary-container text-sm font-bold text-primary transition-colors hover:bg-primary-container hover:text-on-primary disabled:opacity-50"
          >
            <Icon name={retry.isPending ? 'progress_activity' : 'refresh'} className={`text-lg ${retry.isPending ? 'animate-spin' : ''}`} />
            {retry.isSuccess ? 'Đã tạo lại' : `Tạo lại ${failed.length} ảnh lỗi · ${price > 0 ? formatVnd(price * failed.length) : 'miễn phí'}`}
          </button>
          {retry.error && <FormAlert>{requestError(retry.error)}</FormAlert>}
        </div>
      )}
    </section>
  );
}

/** /create?creative=<slug>: tải ảnh sản phẩm lên, tạo ảnh theo mẫu, xem và tải kết quả. */
export default function CreatePage() {
  useSeo({ title: 'Tạo ảnh AI', noindex: true });
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const slug = params.get('creative');
  const { data: c, isLoading, error, refetch } = useCreative(slug);
  const { data: me } = useMe();
  const create = useCreateGeneration();

  const [image, setImage] = useState(null);
  const [ratio, setRatio] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [runs, setRuns] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKey = useRef(newKey());
  const resultsRef = useRef(null);

  // Giải phóng URL xem trước khi đổi ảnh hoặc rời trang
  useEffect(() => () => image && URL.revokeObjectURL(image.url), [image]);

  // Đổi dữ liệu gửi đi -> yêu cầu mới, khoá mới
  useEffect(() => {
    idempotencyKey.current = newKey();
  }, [image, ratio, quantity]);

  if (!slug) {
    return (
      <div className="p-4">
        <EmptyState icon="auto_awesome" message="Chọn một mẫu AI Creative để bắt đầu tạo ảnh.">
          <Link
            to="/explore"
            className="mt-2 flex h-10 items-center gap-1 rounded-xl bg-primary-container px-4 text-sm font-bold text-on-primary hover:bg-primary"
          >
            <Icon name="shopping_bag" className="text-lg" />
            Xem các mẫu
          </Link>
        </EmptyState>
      </div>
    );
  }

  const options = c?.options ?? {};
  const ratios = options.aspect_ratios ?? [];
  const selectedRatio = ratio ?? (ratios.includes(options.default_aspect_ratio) ? options.default_aspect_ratio : ratios[0]);
  const maxOutputs = Math.max(1, options.max_outputs ?? 1);
  // Chủ mẫu tự dùng không bị trừ tiền (GenerationType::Owner)
  const isOwner = !!me?.creatorProfile && me.creatorProfile.username === c?.author?.username;
  const total = isOwner ? 0 : (c?.price ?? 0) * quantity;
  const notEnough = !!me && total > me.credits;
  const missingImage = submitted && !image;

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!image || !selectedRatio || notEnough) return;
    create.mutate(
      { creativeId: c.creativeId, image: image.file, quantity, aspectRatio: selectedRatio, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: (generation) => {
          idempotencyKey.current = newKey();
          setRuns((list) => [
            { id: generation.id, quantity: generation.quantity, ratio: generation.aspect_ratio, total: generation.total_charged },
            ...list,
          ]);
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        },
      },
    );
  };

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          // Vào từ trang chi tiết thì lùi lịch sử, tránh đẩy thêm một trang chi tiết mới (back tiếp sẽ lại về /create)
          onClick={() =>
            location.state?.fromDetail
              ? navigate(-1)
              : navigate(`/creatives/${encodeURIComponent(slug)}`, { replace: true })
          }
          aria-label="Quay lại mẫu"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="text-base font-bold text-on-surface">Tạo ảnh</h1>
      </header>

      <div className="space-y-4 p-4 pb-8">
        {error ? (
          <ErrorState
            error={error.status === 404 ? new Error('Mẫu AI Creative không tồn tại hoặc đã bị gỡ.') : error}
            onRetry={error.status === 404 ? undefined : refetch}
          />
        ) : isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <Link
              to={`/creatives/${encodeURIComponent(slug)}`}
              className="flex items-center gap-3 rounded-2xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container"
            >
              <CoverImage src={c.imageUrl} alt={c.title} className="size-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-on-surface-variant">Mẫu đang dùng</p>
                <h2 className="truncate text-sm font-bold text-on-surface">{c.title}</h2>
                <p className="text-xs font-bold text-primary">{formatVnd(c.price)} / ảnh</p>
              </div>
            </Link>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <Section title="Ảnh sản phẩm của bạn" subtitle="AI sẽ giữ sản phẩm trong ảnh và dựng lại theo phong cách của mẫu.">
                <InputImagePicker image={image} onChange={setImage} disabled={create.isPending} />
                {missingImage && <p className="text-xs text-error">Vui lòng chọn ảnh sản phẩm.</p>}
              </Section>

              <Section title="Tuỳ chọn">
                {ratios.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-on-surface-variant">Tỉ lệ khung hình</p>
                    <div className="flex flex-wrap gap-2">
                      {ratios.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRatio(r)}
                          aria-pressed={selectedRatio === r}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            selectedRatio === r
                              ? 'border-primary-container bg-primary-container text-on-primary'
                              : 'border-outline-variant/40 text-on-surface-variant hover:border-primary-container'
                          }`}
                        >
                          <span
                            className="inline-block w-3 rounded-[2px] border-[1.5px] border-current"
                            style={{ aspectRatio: cssRatio(r) }}
                          />
                          {r}
                          {RATIO_LABEL[r] && <span className="font-normal opacity-80">· {RATIO_LABEL[r]}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-on-surface-variant">Số ảnh</p>
                    <p className="text-[11px] text-outline">Tối đa {maxOutputs} ảnh mỗi lần</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-full border border-outline-variant/40 p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="Bớt 1 ảnh"
                      className="flex size-8 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-30"
                    >
                      <Icon name="remove" className="text-lg" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-on-surface" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxOutputs, q + 1))}
                      disabled={quantity >= maxOutputs}
                      aria-label="Thêm 1 ảnh"
                      className="flex size-8 items-center justify-center rounded-full hover:bg-surface-container disabled:opacity-30"
                    >
                      <Icon name="add" className="text-lg" />
                    </button>
                  </div>
                </div>
              </Section>

              <section className="space-y-2 rounded-2xl bg-surface-container-low p-4 text-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>
                    {formatVnd(c.price)} × {quantity} ảnh
                  </span>
                  <span className={isOwner ? 'line-through' : ''}>{formatVnd(c.price * quantity)}</span>
                </div>
                {isOwner && <p className="text-xs text-primary">Mẫu của bạn: tự dùng không bị trừ tiền.</p>}
                <div className="flex justify-between border-t border-surface-container pt-2 font-bold text-on-surface">
                  <span>Tổng thanh toán</span>
                  <span className="text-primary">{formatVnd(total)}</span>
                </div>
                <div className="flex justify-between text-xs text-on-surface-variant">
                  <span>Số dư hiện tại</span>
                  <span>{formatVnd(me?.credits)}</span>
                </div>
                <p className="text-[11px] text-outline">Ảnh tạo lỗi được hoàn tiền tự động.</p>
              </section>

              {notEnough && <FormAlert>Số dư không đủ, cần thêm {formatVnd(total - me.credits)}.</FormAlert>}
              {create.error && <FormAlert>{requestError(create.error)}</FormAlert>}

              <SubmitButton loading={create.isPending} loadingText="Đang gửi ảnh..." disabled={notEnough || !selectedRatio}>
                <Icon name="auto_awesome" />
                {runs.length ? 'Tạo thêm' : 'Tạo'} {quantity} ảnh · {formatVnd(total)}
              </SubmitButton>
            </form>

            {runs.length > 0 && (
              <div ref={resultsRef} className="scroll-mt-32 space-y-3">
                <h2 className="text-base font-bold text-on-surface">Kết quả</h2>
                {runs.map((run) => (
                  <GenerationResult
                    key={run.id}
                    run={run}
                    price={isOwner ? 0 : c.price}
                    onRetried={(next) => setRuns((list) => [{ ...next, retry: true }, ...list])}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
