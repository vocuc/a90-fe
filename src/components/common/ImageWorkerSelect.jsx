import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SelectField } from './Form';
import { IMAGE_WORKER_KEYS, listImageWorkers } from '../../api/workers';

/*
 * Chọn worker tạo ảnh khi tạo ảnh / tạo lô / tạo lô tự động (note/chon-worker-tao-anh.txt). Bắt buộc chọn.
 * Mặc định: worker chọn lần trước (localStorage, lỗi / bị chặn thì bỏ qua), không có thì worker online đầu tiên, rồi worker đầu tiên.
 */
const PREF_KEYS = { image: 'a51_image_worker', outfit: 'a51_outfit_worker' };
const readPref = (key) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const savePref = (key, id) => {
  try {
    localStorage.setItem(key, id);
  } catch {
    // bỏ qua
  }
};

export const NO_IMAGE_WORKER = 'Tài khoản chưa được gắn worker tạo ảnh, liên hệ A51 để được gắn.';
export const NO_OUTFIT_WORKER = 'Tài khoản chưa được gắn worker phối đồ, liên hệ A51 để được gắn.';

/** type: 'image' | 'outfit' (worker phối đồ cho lô tự động chế độ Phối đồ, nhớ lựa chọn riêng). */
export function useImageWorker(type = 'image') {
  const prefKey = PREF_KEYS[type] ?? PREF_KEYS.image;
  const query = useQuery({
    queryKey: type === 'outfit' ? IMAGE_WORKER_KEYS.outfit : IMAGE_WORKER_KEYS.all,
    queryFn: () => listImageWorkers(type),
    refetchInterval: 60_000,
  });
  const workers = query.data;
  // null: chưa chọn trên trang này
  const [picked, setPicked] = useState(null);
  const [pref, setPref] = useState(() => readPref(prefKey));
  // Đổi loại worker trên cùng trang: đọc lại lựa chọn đã nhớ của loại đó
  const [prefType, setPrefType] = useState(type);
  if (prefType !== type) {
    setPrefType(type);
    setPicked(null);
    setPref(readPref(prefKey));
  }
  const exists = (id) => !!id && workers?.some((w) => String(w.id) === String(id));
  const fallback = workers?.find((w) => w.online) ?? workers?.[0];
  const workerId = String([picked, pref].find(exists) ?? fallback?.id ?? '');
  const setWorkerId = (id) => {
    setPicked(id);
    savePref(prefKey, id);
  };
  // Lỗi khi bấm tạo mà chưa chọn được worker; null = hợp lệ
  const missingError = workerId
    ? null
    : query.isLoading
      ? 'Đang tải danh sách worker, vui lòng chờ.'
      : query.error
        ? 'Không tải được danh sách worker, tải lại trang để thử lại.'
        : type === 'outfit'
          ? NO_OUTFIT_WORKER
          : NO_IMAGE_WORKER;
  return { type, workers, isLoading: query.isLoading, error: query.error, workerId, setWorkerId, missingError };
}

/** Ô chọn worker tạo ảnh; worker = useImageWorker(). */
export default function ImageWorkerSelect({ worker, error, onChange }) {
  const { workers, isLoading } = worker;
  const outfit = worker.type === 'outfit';
  const none = outfit ? NO_OUTFIT_WORKER : NO_IMAGE_WORKER;
  return (
    <SelectField
      label={outfit ? 'Worker phối đồ' : 'Worker tạo ảnh'}
      value={worker.workerId}
      onChange={(e) => {
        worker.setWorkerId(e.target.value);
        onChange?.(e.target.value);
      }}
      disabled={isLoading || !workers?.length}
      error={error}
      hint={
        worker.error
          ? 'Không tải được danh sách worker, tải lại trang để thử lại.'
          : !isLoading && !workers?.length
            ? none
            : 'Worker được chọn sẽ tạo các ảnh này. Worker offline thì ảnh chờ tới khi worker bật lại.'
      }
    >
      {isLoading ? (
        <option value="">Đang tải worker...</option>
      ) : !workers?.length ? (
        <option value="">Chưa có worker</option>
      ) : (
        workers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.online ? '' : ' (offline)'}
          </option>
        ))
      )}
    </SelectField>
  );
}
