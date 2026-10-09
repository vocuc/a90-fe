import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import { ErrorState, Skeleton } from '../components/common/Feedback';
import { FormAlert, SelectField, SubmitButton, TextArea, TextField } from '../components/common/Form';
import { useCategories } from '../hooks/queries';
import {
  useAiModels,
  useCreateCreative,
  useCreatorCreative,
  useCreatorProfile,
  useUpdateCreative,
} from '../hooks/creatorQueries';
import PromptInstructions, {
  serializeInstructions,
  usePromptInstructions,
  validateInstructions,
} from '../components/store/PromptInstructions';

// Khớp backend (CreativeRequest, CreativeImageController)
const MAX_TITLE = 150;
const MAX_DESCRIPTION = 5000;
// Backend cho tối đa 10 ảnh, sàn chỉ dùng 4
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';
const EMPTY_FORM = {
  title: '',
  description: '',
  category_id: '',
  model_id: '',
  price_per_image: '',
};

// Backend mặc định 1:1; model không hỗ trợ 1:1 thì lấy tỉ lệ đầu tiên model hỗ trợ
const pickDefaultRatio = (ratios = []) => (ratios.includes('1:1') ? '1:1' : ratios[0]);

const isInt = (v) => /^-?\d+$/.test(String(v).trim());

const validate = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Vui lòng nhập tên sản phẩm.';
  if (!form.model_id) errors.model_id = 'Vui lòng chọn model AI.';
  if (form.price_per_image === '') errors.price_per_image = 'Vui lòng nhập giá mỗi ảnh.';
  else if (!isInt(form.price_per_image) || Number(form.price_per_image) < 0)
    errors.price_per_image = 'Giá phải là số nguyên từ 0 trở lên.';
  return errors;
};

// Creative đã lưu -> giá trị ô nhập của form
const toForm = (c) => ({
  title: c.title ?? '',
  description: c.description ?? '',
  category_id: c.category_id ? String(c.category_id) : '',
  model_id: c.model_id ? String(c.model_id) : '',
  price_per_image: c.price_per_image == null ? '' : String(c.price_per_image),
});

// Số ảnh mỗi lần tạo, tỉ lệ khung hình, tham số model: để backend dùng mặc định
// Câu lệnh gửi thẳng dạng mảng [{ label, value }] trong creative_prompt (cột json ở backend)
const toPayload = (form, model, instructions, creative) => {
  const payload = {
    title: form.title.trim(),
    description: form.description.trim() || null,
    category_id: form.category_id ? Number(form.category_id) : null,
    model_id: Number(form.model_id),
    price_per_image: Number(form.price_per_image),
    creative_prompt: serializeInstructions(instructions),
  };
  // Sửa mà giữ model cũ thì giữ tỉ lệ khung hình đã lưu
  if (!creative || String(creative.model_id) !== String(form.model_id))
    payload.default_aspect_ratio = pickDefaultRatio(model?.supported_aspect_ratios);
  return payload;
};

// Backend trả lỗi validate tiếng Anh -> gom về field và dịch theo field
const SERVER_FIELD_MESSAGES = {
  title: 'Tên sản phẩm không hợp lệ (tối đa 150 ký tự).',
  description: 'Mô tả tối đa 5000 ký tự.',
  category_id: 'Danh mục không còn hoạt động, hãy chọn danh mục khác.',
  model_id: 'Model AI không còn hoạt động, hãy chọn model khác.',
  price_per_image: 'Giá không hợp lệ.',
  creative_prompt: 'Câu lệnh không hợp lệ (tối đa 20 câu lệnh, tiêu đề ≤ 100 và nội dung ≤ 5.000 ký tự).',
  default_aspect_ratio: 'Model AI không hỗ trợ tỉ lệ khung hình mặc định.',
};
const mapServerErrors = (errors = {}) => {
  const out = {};
  Object.entries(errors).forEach(([field, message]) => {
    const key = field.split('.')[0];
    // Lỗi tỉ lệ khung hình đến từ model đang chọn
    const target = key === 'default_aspect_ratio' ? 'model_id' : key;
    out[target] = SERVER_FIELD_MESSAGES[key] ?? message;
  });
  return out;
};

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

/**
 * Ảnh mẫu: ảnh đã lưu { id, url } và ảnh mới chọn { file, url } (upload khi lưu).
 * Ảnh đầu tiên làm ảnh bìa.
 */
function ImagePicker({ images, onChange, onRemove, disabled, error: fieldError }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  const onPick = (e) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    const ok = [];
    let problem = null;
    for (const file of files) {
      if (!ACCEPT.split(',').includes(file.type)) problem = 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.';
      else if (file.size > MAX_IMAGE_BYTES) problem = 'Mỗi ảnh tối đa 10MB.';
      else ok.push({ file, url: URL.createObjectURL(file) });
    }
    const room = MAX_IMAGES - images.length;
    if (ok.length > room) {
      ok.splice(room).forEach((i) => URL.revokeObjectURL(i.url));
      problem = `Tối đa ${MAX_IMAGES} ảnh mẫu.`;
    }
    setError(problem);
    if (ok.length) onChange([...images, ...ok]);
  };

  const remove = (index) => {
    const img = images[index];
    if (img.file) URL.revokeObjectURL(img.url);
    onRemove?.(img);
    onChange(images.filter((_, i) => i !== index));
    setError(null);
  };

  const message = error ?? fieldError;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {images.map((img, i) => (
          <div key={img.id ?? img.url} className="relative aspect-square overflow-hidden rounded-lg bg-surface-container">
            <img src={img.url} alt={`Ảnh mẫu ${i + 1}`} className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded-full bg-primary-container px-1.5 py-0.5 text-[9px] font-bold text-on-primary">
                Ảnh bìa
              </span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Xoá ảnh mẫu ${i + 1}`}
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface hover:text-error"
              >
                <Icon name="close" className="text-sm" />
              </button>
            )}
          </div>
        ))}
        {images.length < MAX_IMAGES && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant text-on-surface-variant hover:border-primary-container hover:text-primary"
          >
            <Icon name="add_photo_alternate" className="text-2xl" />
            <span className="text-[10px] font-semibold">Thêm ảnh</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={onPick} />
      {message ? (
        <p className="text-xs text-error">{message}</p>
      ) : (
        <p className="text-xs text-on-surface-variant">
          {images.length}/{MAX_IMAGES} ảnh · JPG, PNG, WEBP tối đa 10MB. Ảnh đầu tiên làm ảnh bìa. Cần ít nhất 1 ảnh để đăng bán.
        </p>
      )}
    </div>
  );
}

/** Form tạo mới (creative = null) hoặc sửa Creative đã có. */
function ProductForm({ models, creative }) {
  const navigate = useNavigate();
  const categories = useCategories();
  const create = useCreateCreative();
  const update = useUpdateCreative();
  const save = creative ? update : create;

  const [form, setForm] = useState(() => (creative ? toForm(creative) : EMPTY_FORM));
  const [images, setImages] = useState(() => creative?.images?.map(({ id, url }) => ({ id, url })) ?? []);
  // Ảnh đã lưu bị bỏ, xoá trên backend khi bấm lưu
  const [removed, setRemoved] = useState([]);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  // Tạo mới: đã tạo Creative nhưng còn ảnh upload lỗi -> lần bấm sau chỉ upload lại ảnh
  const [created, setCreated] = useState(null);
  // Sửa: đã lưu thông tin nhưng còn ảnh chưa thêm/xoá được
  const [pendingImages, setPendingImages] = useState(0);
  const prompt = usePromptInstructions(creative?.config?.creative_prompt);
  // Lỗi câu lệnh, ảnh chỉ hiện sau lần bấm lưu đầu tiên
  const [checked, setChecked] = useState(false);

  // Giải phóng URL xem trước khi rời trang
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((i) => i.file && URL.revokeObjectURL(i.url)), []);

  const model = models.find((m) => String(m.id) === String(form.model_id));

  const errors = validate(form);
  const shown = (key) => (touched[key] ? errors[key] : undefined) ?? serverErrors[key];
  const promptErrors = checked ? validateInstructions(prompt.groups) : {};
  if (serverErrors.creative_prompt && !promptErrors.list) promptErrors.list = serverErrors.creative_prompt;
  // Backend chặn xoá ảnh cuối cùng của Creative đang bán
  const imageError =
    creative?.status === 'published' && images.length === 0 ? 'Sản phẩm đang bán cần ít nhất 1 ảnh mẫu.' : null;

  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setServerErrors(({ [key]: _, ...rest }) => rest);
  };

  const field = (key) => ({
    value: form[key],
    onChange: (e) => change(key, e.target.value),
    onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
    error: shown(key),
  });

  const onError = (err) => setServerErrors(mapServerErrors(err.errors));

  const submitCreate = (instructions) =>
    create.mutate(
      { payload: toPayload(form, model, instructions), images: images.map((i) => i.file), creative: created },
      {
        onError,
        onSuccess: ({ creative: saved, failed }) => {
          if (!failed.length) {
            navigate('/seller/products', { replace: true });
            return;
          }
          setCreated(saved);
          setImages((list) => {
            list.filter((i) => !failed.includes(i.file)).forEach((i) => URL.revokeObjectURL(i.url));
            return list.filter((i) => failed.includes(i.file));
          });
        },
      },
    );

  const submitUpdate = (instructions) =>
    update.mutate(
      {
        id: creative.id,
        payload: toPayload(form, model, instructions, creative),
        images: images.filter((i) => i.file).map((i) => i.file),
        removed,
      },
      {
        onError,
        onSuccess: ({ uploaded, failed, failedRemovals }) => {
          if (!failed.length && !failedRemovals.length) {
            navigate('/seller/products', { replace: true });
            return;
          }
          // Ảnh đã upload thành ảnh đã lưu; ảnh lỗi giữ nguyên để lần lưu sau thử lại
          const saved = new Map(uploaded.map((u) => [u.file, u.image]));
          setImages((list) =>
            list.map((i) => {
              const image = i.file && saved.get(i.file);
              if (!image) return i;
              URL.revokeObjectURL(i.url);
              return { id: image.id, url: image.url };
            }),
          );
          setRemoved(failedRemovals);
          setPendingImages(failed.length + failedRemovals.length);
        },
      },
    );

  const onSubmit = (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(EMPTY_FORM).map((k) => [k, true])));
    setChecked(true);
    if (created) {
      submitCreate([]);
      return;
    }
    const instructions = prompt.commit();
    if (!instructions || Object.keys(errors).length || Object.keys(validateInstructions(instructions)).length || imageError)
      return;
    setServerErrors({});
    setPendingImages(0);
    if (creative) submitUpdate(instructions);
    else submitCreate(instructions);
  };

  const generalError = save.error && !save.error.errors ? save.error.message : null;
  const locked = !!created || save.isPending;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {created && (
        <div role="status" className="space-y-2 rounded-xl bg-surface-container px-3 py-2.5 text-xs text-on-surface">
          <p className="flex items-center gap-1.5 font-semibold text-primary">
            <Icon name="check_circle" className="text-sm" />
            Đã tạo sản phẩm "{created.title}" (bản nháp).
          </p>
          <p>
            {images.length} ảnh mẫu tải lên chưa được. Bấm "Tải lại ảnh" để thử lại, hoặc về danh sách và thêm ảnh sau.
          </p>
          <Link to="/seller/products" replace className="inline-block font-bold text-primary hover:underline">
            Về danh sách sản phẩm
          </Link>
        </div>
      )}
      {pendingImages > 0 && (
        <div role="status" className="space-y-1 rounded-xl bg-surface-container px-3 py-2.5 text-xs text-on-surface">
          <p className="flex items-center gap-1.5 font-semibold text-primary">
            <Icon name="check_circle" className="text-sm" />
            Đã lưu thông tin sản phẩm.
          </p>
          <p>{pendingImages} thay đổi ảnh mẫu chưa cập nhật được. Bấm "Lưu thay đổi" để thử lại.</p>
        </div>
      )}

      <Section title="Ảnh mẫu" subtitle="Hiển thị trên sàn để người mua xem trước phong cách ảnh.">
        <ImagePicker
          images={images}
          onChange={setImages}
          onRemove={(img) => img.id && setRemoved((list) => [...list, img.id])}
          disabled={save.isPending}
          error={checked ? imageError : null}
        />
      </Section>

      <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
        <Section title="Thông tin sản phẩm">
          <TextField
            label="Tên sản phẩm *"
            icon="title"
            maxLength={MAX_TITLE}
            placeholder="Ví dụ: Ảnh sản phẩm nền studio"
            {...field('title')}
          />
          <TextArea
            label="Mô tả"
            rows={4}
            maxLength={MAX_DESCRIPTION}
            placeholder="Mô tả phong cách ảnh, loại sản phẩm phù hợp, cách dùng..."
            {...field('description')}
          />
          <SelectField
            label="Danh mục"
            {...field('category_id')}
            hint={categories.error ? 'Không tải được danh mục.' : undefined}
          >
            <option value="">Không chọn</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
        </Section>

        <Section title="Model và giá">
          <SelectField
            label="Model AI *"
            {...field('model_id')}
            hint={models.length === 0 ? 'Hiện chưa có model AI nào hoạt động.' : undefined}
          >
            <option value="">Chọn model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.provider.name})
              </option>
            ))}
          </SelectField>
          <TextField
            label="Giá mỗi ảnh (VND) *"
            icon="toll"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="Ví dụ: 2000"
            {...field('price_per_image')}
          />
        </Section>

        <Section title="Câu lệnh *" subtitle="Mỗi câu lệnh gồm tiêu đề và nội dung. Chỉ bạn thấy, người mua chỉ thấy ảnh kết quả.">
          <PromptInstructions state={prompt} errors={promptErrors} disabled={locked} />
        </Section>
      </fieldset>

      {generalError && <FormAlert>{generalError}</FormAlert>}
      {Object.keys(serverErrors).length > 0 && <FormAlert>Vui lòng kiểm tra lại các trường báo lỗi.</FormAlert>}

      <SubmitButton
        loading={save.isPending}
        loadingText={created ? 'Đang tải ảnh...' : creative ? 'Đang lưu...' : 'Đang tạo sản phẩm...'}
        disabled={created && images.length === 0}
      >
        {created ? 'Tải lại ảnh' : creative ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
      </SubmitButton>
      {!created && (
        <p className="text-center text-xs text-on-surface-variant">
          {!creative
            ? 'Sản phẩm được lưu dạng nháp. Đăng bán ở trang Quản lý sản phẩm.'
            : creative.status === 'published'
              ? 'Sản phẩm đang bán: thay đổi có hiệu lực ngay trên sàn.'
              : 'Đăng bán ở trang Quản lý sản phẩm.'}
        </p>
      )}
    </form>
  );
}

/** /seller/products/new (tạo mới) và /seller/products/:id/edit (sửa). */
export default function SellerProductFormPage() {
  const { id } = useParams();
  const isEdit = id != null;
  const { hasProfile, meLoaded } = useCreatorProfile();
  const models = useAiModels(hasProfile);
  const creative = useCreatorCreative(id, hasProfile && isEdit);

  const loading = !meLoaded || (hasProfile && (models.isLoading || (isEdit && creative.isLoading)));
  const error = models.error ?? (isEdit ? creative.error : null);
  const viewable = creative.data?.status === 'published' && !creative.data?.is_hidden;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link
          to="/seller/products"
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-base font-bold text-on-surface">{isEdit ? 'Sửa sản phẩm' : 'Tạo sản phẩm'}</h1>
        {/* Chỉ Creative đang bán mới xem được ở trang công khai */}
        {isEdit && viewable && (
          <Link
            to={`/creatives/${creative.data.slug}`}
            className="mr-2 flex h-8 items-center gap-1 rounded-lg border border-outline-variant/40 px-3 text-xs font-semibold text-on-surface hover:border-primary-container"
          >
            <Icon name="visibility" className="text-base" />
            Xem trên sàn
          </Link>
        )}
      </header>

      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !hasProfile ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Icon name="storefront" className="text-4xl text-outline" />
            <p className="text-sm text-on-surface-variant">
              Bạn cần tạo cửa hàng trước khi {isEdit ? 'quản lý' : 'tạo'} sản phẩm.
            </p>
            <Link to="/seller/settings" className="text-sm font-bold text-primary hover:underline">
              Tạo cửa hàng
            </Link>
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={models.error ? models.refetch : creative.refetch} />
        ) : (
          <ProductForm key={id ?? 'new'} models={models.data} creative={isEdit ? creative.data : null} />
        )}
      </div>
    </>
  );
}
