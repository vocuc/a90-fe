/*
 * Template prompt (note/template-prompt.txt): các block { title, content } ghép thành prompt dùng chung.
 * Creative chọn Template thì prompt cuối = prompt Template + prompt riêng của Creative.
 * Khớp backend PromptTemplate::compose và CreativeTemplate::mergePrompt.
 */

import { mergePrompt, newUid } from './templateSchema';

export { mergePrompt };

export const MAX_TEMPLATE_TITLE = 150;
export const MAX_BLOCK_TITLE = 200;
export const MAX_BLOCKS = 50;

export const createBlock = (title = '', content = '') => ({ _id: newUid(), title, content });

/** "Tiêu đề\nNội dung", các block cách nhau 1 dòng trống; block trống bị bỏ. */
export const composeBlocks = (blocks = []) =>
  blocks
    .map((b) => {
      const title = (b.title ?? '').trim();
      const content = (b.content ?? '').trim();
      return (title && content ? `${title}\n${content}` : title + content).trim();
    })
    .filter(Boolean)
    .join('\n\n');


/** Dữ liệu gửi POST/PUT /creator/prompt-templates. */
export const toTemplateBody = ({ title, blocks }) => ({
  title: title.trim(),
  blocks: blocks.map((b) => ({ title: b.title.trim(), content: b.content.trim() })),
});

export const fromTemplate = (t) => ({
  title: t?.title ?? '',
  blocks: t?.blocks?.length ? t.blocks.map((b) => createBlock(b.title ?? '', b.content ?? '')) : [createBlock()],
});
