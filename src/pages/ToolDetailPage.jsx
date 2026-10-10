import useSeo from '../hooks/useSeo';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/common/Icon';
import CollageTool from '../components/tools/CollageTool';
import LogoTool from '../components/tools/LogoTool';
import { findTool } from '../components/tools/tools';
import PlaceholderPage from './PlaceholderPage';

export default function ToolDetailPage() {
  const { slug } = useParams();
  const tool = findTool(slug);
  useSeo({ title: tool?.title, description: tool?.description });

  if (!tool) return <PlaceholderPage title="Không tìm thấy công cụ" icon="error" backTo="/tools" />;

  return (
    <>
      <header className="sticky top-[60px] z-30 flex items-center gap-2 border-b border-surface-container bg-surface-container-lowest/90 px-2 py-2 backdrop-blur-md">
        <Link
          to="/tools"
          aria-label="Quay lại"
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-container"
        >
          <Icon name="arrow_back" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-on-surface">{tool.title}</h1>
          <p className="truncate text-xs text-on-surface-variant">{tool.description}</p>
        </div>
      </header>
      {/* key: đổi công cụ thì làm mới toàn bộ trạng thái */}
      {tool.type === 'collage' ? <CollageTool key={tool.slug} tool={tool} /> : <LogoTool key={tool.slug} />}
    </>
  );
}
