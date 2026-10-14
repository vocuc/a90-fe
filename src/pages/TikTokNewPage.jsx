import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import useIdempotencyKey from '../hooks/useIdempotencyKey';
import Icon from '../components/common/Icon';
import ActionBar from '../components/common/ActionBar';
import A51ImagePicker from '../components/tiktok/A51ImagePicker';
import { PHOTO_MAX_COUNT, createPostFromImages } from '../api/tiktok';

/**
 * /tiktok/new: tạo bài từ ảnh đã có trên A51 (lịch sử tạo ảnh), sang trang bài để điền tiêu đề, nội dung và gửi.
 * Tạo ảnh mới nằm ở "Tạo ảnh theo lô" (/batches), mỗi lô có nút "Đăng TikTok" riêng.
 */
export default function TikTokNewPage() {
  useSeo({ title: 'Tạo bài đăng TikTok', noindex: true });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idem = useIdempotencyKey();
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/tiktok', { replace: true }));

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
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className="flex size-9 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold text-on-surface">Tạo bài từ ảnh đã có</h1>
      </header>

      <section className="space-y-3 p-4 lg:py-6">
        <div>
          <h2 className="text-sm font-bold text-on-surface">Chọn ảnh cho bài đăng</h2>
          <p className="text-xs text-on-surface-variant">
            Tối đa {PHOTO_MAX_COUNT} ảnh, ảnh chọn đầu tiên làm ảnh bìa. Chỉ dùng được ảnh đã tạo trên A51. Muốn tạo ảnh
            mới, hãy dùng{' '}
            <Link to="/batches" className="font-semibold text-primary hover:underline">
              Tạo ảnh theo lô
            </Link>
            .
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
        label="Tạo bài đăng"
        icon="post_add"
      />
    </>
  );
}
