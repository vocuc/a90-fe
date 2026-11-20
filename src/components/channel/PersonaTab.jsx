import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormAlert, SubmitButton, TextField } from '../common/Form';
import SuccessDialog from '../common/SuccessDialog';
import { CHANNEL_KEYS, PERSONA_LABELS, updateChannel } from '../../api/channels';
import Section from './Section';

/** Tab Chân dung khách hàng: chủ shop sửa. Kênh chưa có thì lệnh /lap-ke-hoach tự soạn từ sản phẩm của shop. */
export default function PersonaTab({ channel }) {
  const queryClient = useQueryClient();
  const fields = channel.limits.persona_fields;
  const [form, setForm] = useState(channel.persona);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(channel.persona), [channel]);
  const mutation = useMutation({
    mutationFn: (persona) => updateChannel(channel.id, { persona }),
    onSuccess: (c) => {
      queryClient.setQueryData(CHANNEL_KEYS.detail(channel.id), c);
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all });
      setSaved(true);
    },
  });

  return (
    <form
      className="mx-auto max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <Section
        title="Chân dung khách hàng"
        subtitle="Kế hoạch chọn hook, giọng văn theo chân dung này. Để trống thì đội A51 tự soạn từ sản phẩm của shop khi lập kế hoạch."
      >
        <div className="grid gap-3 md:grid-cols-2">
        {fields.map((key) => (
          <TextField
            key={key}
            label={PERSONA_LABELS[key] ?? key}
            // Ô tự cao lên theo nội dung (chân dung thường dài hơn 1 dòng)
            multiline
            value={form[key] ?? ''}
            maxLength={channel.limits.persona_field}
            onChange={(e) => {
              setForm((f) => ({ ...f, [key]: e.target.value }));
              setSaved(false);
            }}
          />
        ))}
        </div>
      </Section>
      {mutation.error && <FormAlert>{mutation.error.message}</FormAlert>}
      {saved && <SuccessDialog title="Đã lưu chân dung" message={`Chân dung khách hàng của kênh "${channel.name}" đã được cập nhật.`} onClose={() => setSaved(false)} />}
      <SubmitButton loading={mutation.isPending} loadingText="Đang lưu...">
        Lưu chân dung
      </SubmitButton>
    </form>
  );
}
