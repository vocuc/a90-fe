/*
 * Template prompt (note/template-prompt.txt): các block { title, content, pinned, options[] } ghép thành prompt dùng chung.
 * Creative chọn Template thì prompt cuối = block thường + prompt riêng của Creative + block ghim cuối (tối đa 1).
 * options: biến thể nội dung của block — mỗi lần tạo ảnh backend lấy ngẫu nhiên 1 option nối sau nội dung chính.
 * Xem trước / đếm ký tự dùng option dài nhất (trường hợp xấu nhất), khớp backend PromptTemplate::longestPick.
 * Khớp backend PromptTemplate::compose / merge và CreativeTemplate::mergePrompt.
 */

import { mergePrompt, newUid } from './templateSchema';

export { mergePrompt };

export const MAX_TEMPLATE_TITLE = 150;
export const MAX_BLOCK_TITLE = 200;
export const MAX_BLOCKS = 50;
// Khớp backend PromptTemplate::MAX_OPTIONS / MAX_OPTION_LENGTH
export const MAX_OPTIONS = 20;
export const MAX_OPTION_LENGTH = 2000;

const newOption = (text = '') => ({ _id: newUid(), text });

export const createBlock = (title = '', content = '', pinned = false, options = []) => ({
  _id: newUid(),
  title,
  content,
  pinned,
  options: options.map((o) => newOption(String(o ?? ''))),
});

export const createOption = () => newOption();

/** Option khác rỗng của block (chuỗi đã trim). */
export const blockOptions = (block) => (block.options ?? []).map((o) => (o.text ?? o ?? '').trim()).filter(Boolean);

const longest = (list) => list.reduce((a, b) => (b.length > a.length ? b : a), '');

/** "Tiêu đề\nNội dung\nOption dài nhất", các block cách nhau 1 dòng trống; block trống bị bỏ. */
export const composeBlocks = (blocks = []) =>
  blocks
    .map((b) => {
      const title = (b.title ?? '').trim();
      const body = [(b.content ?? '').trim(), longest(blockOptions(b))].filter(Boolean).join('\n');
      return (title && body ? `${title}\n${body}` : title + body).trim();
    })
    .filter(Boolean)
    .join('\n\n');

/** head: block thường (trước prompt riêng của Creative), tail: block ghim (sau prompt riêng). */
export const templateParts = (blocks = []) => ({
  head: composeBlocks(blocks.filter((b) => !b.pinned)),
  tail: composeBlocks(blocks.filter((b) => b.pinned)),
});

/** Dữ liệu gửi POST/PUT /creator/prompt-templates. */
export const toTemplateBody = ({ title, blocks }) => ({
  title: title.trim(),
  blocks: blocks.map((b) => ({ title: b.title.trim(), content: b.content.trim(), pinned: !!b.pinned, options: blockOptions(b) })),
});

export const fromTemplate = (t) => ({
  title: t?.title ?? '',
  blocks: t?.blocks?.length
    ? t.blocks.map((b) => createBlock(b.title ?? '', b.content ?? '', b.pinned === true, Array.isArray(b.options) ? b.options : []))
    : [createBlock()],
});
