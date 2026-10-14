// Giả lập TikTok Content Posting API (Direct Post). Chưa có backend: khi có, thay thân hàm bằng lời gọi
// tới backend, backend giữ access token và gọi TikTok:
// - getCreatorInfo -> POST /v2/post/publish/creator_info/query/
// - publishVideo   -> POST /v2/post/publish/video/init/ (rồi PUT file lên upload_url)
// - publishPhotos  -> POST /v2/post/publish/content/init/ (media_type PHOTO)

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Giới hạn theo tài liệu TikTok
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const VIDEO_MAX_BYTES = 4 * 1024 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/webp'];
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 35;
export const VIDEO_TITLE_MAX = 2200;
export const PHOTO_TITLE_MAX = 90;
export const PHOTO_DESCRIPTION_MAX = 4000;

export const PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: 'Mọi người',
  MUTUAL_FOLLOW_FRIENDS: 'Bạn bè',
  FOLLOWER_OF_CREATOR: 'Người theo dõi',
  SELF_ONLY: 'Chỉ mình tôi',
};

export async function getCreatorInfo() {
  await delay(500);
  return {
    creatorAvatarUrl: null,
    creatorUsername: 'a51.vn',
    creatorNickname: 'A51 Official',
    privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
    commentDisabled: false,
    duetDisabled: false,
    stitchDisabled: false,
    maxVideoPostDurationSec: 600,
  };
}

// Giả lập tải file lên: báo tiến độ 0-100 qua onProgress
async function fakeUpload(onProgress) {
  for (let p = 0; p <= 100; p += 10) {
    onProgress?.(p);
    await delay(150);
  }
}

const publishId = (prefix) => `${prefix}~v2.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** settings: { title, privacyLevel, disableComment, disableDuet, disableStitch, brandOrganic, brandedContent } */
export async function publishVideo(file, settings, onProgress) {
  await delay(300);
  await fakeUpload(onProgress);
  return { publishId: publishId('v_pub_file') };
}

/** settings: { title, description, privacyLevel, disableComment, autoAddMusic, brandOrganic, brandedContent } */
export async function publishPhotos(files, settings, onProgress) {
  await delay(300);
  await fakeUpload(onProgress);
  return { publishId: publishId('p_pub_file') };
}
