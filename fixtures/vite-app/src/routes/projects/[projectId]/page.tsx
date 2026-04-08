import { useLoaderData } from 'react-router-dom';

export async function loader({
  params,
}: {
  params: { projectId?: string };
}) {
  return {
    projectId: params.projectId ?? 'unknown',
  };
}

export default function ProjectPage() {
  const data = useLoaderData() as { projectId: string };

  return <h2>Project: {data.projectId}</h2>;
}
