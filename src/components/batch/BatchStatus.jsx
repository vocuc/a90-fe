import Icon from '../common/Icon';
import { BATCH_STATUS } from '../../api/batches';

/** Đang tạo x/y ảnh hoặc Đã hoàn thành. */
export function BatchStatusBadge({ batch }) {
  const generating = batch.status === BATCH_STATUS.GENERATING;
  const done = batch.imageCount - batch.generatingCount;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
        generating ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      <Icon
        name={generating ? 'progress_activity' : 'check_circle'}
        fill={!generating}
        className={`text-sm ${generating ? 'animate-spin' : ''}`}
      />
      {generating ? `Đang tạo ${done}/${batch.imageCount}` : 'Đã hoàn thành'}
    </span>
  );
}
